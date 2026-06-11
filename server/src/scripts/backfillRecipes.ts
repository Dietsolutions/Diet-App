// Backfill the recipe library from all existing MealPlanDay rows.
// Run with: npx ts-node -P tsconfig.json src/scripts/backfillRecipes.ts
//
// Cross-references each meal against macro_validation_logs (by mealPlanId +
// dayIndex + mealIndex, latest row wins) so only meals with trustworthy
// macros enter the library. Meals with no validation row fall back to the
// sanity filter in recipeService.

import prisma from '../lib/prisma';
import {
  ingestMeals, newIngestStats, buildDedupeKey, canonicaliseRecipeName,
  type IngestableMeal,
} from '../services/recipeService';

async function main() {
  console.log('[Backfill] Loading meal plan days…');
  const days = await prisma.mealPlanDay.findMany({
    select: { id: true, mealPlanId: true, dayIndex: true, meals: true },
  });
  console.log(`[Backfill] ${days.length} MealPlanDay rows`);

  // Latest validation verdict per (mealPlanId, dayIndex, mealIndex)
  console.log('[Backfill] Loading validation verdicts…');
  const verdicts = await prisma.macroValidationLog.findMany({
    select: {
      mealPlanId: true, dayIndex: true, mealIndex: true,
      finalOutcome: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  const verdictMap = new Map<string, string>();
  for (const v of verdicts) {
    // ascending order → later rows overwrite, so the map holds the latest
    verdictMap.set(`${v.mealPlanId}|${v.dayIndex}|${v.mealIndex}`, v.finalOutcome);
  }
  console.log(`[Backfill] ${verdicts.length} validation rows → ${verdictMap.size} meal verdicts`);

  // Extract all meals
  const allMeals: IngestableMeal[] = [];
  let unparseable = 0;
  for (const day of days) {
    let meals: any[];
    try {
      meals = JSON.parse(day.meals || '[]');
      if (!Array.isArray(meals)) { unparseable++; continue; }
    } catch { unparseable++; continue; }

    meals.forEach((m, idx) => {
      if (!m || typeof m !== 'object') return;
      const mealIndex = typeof m.mealIndex === 'number' ? m.mealIndex : idx;
      allMeals.push({
        name:         m.name,
        type:         m.type,
        description:  m.description,
        ingredients:  m.ingredients,
        time:         m.time,
        calories:     m.calories,
        protein:      m.protein,
        carbs:        m.carbs,
        fat:          m.fat,
        fibre:        m.fibre,
        prepTime:     m.prepTime,
        finalOutcome: verdictMap.get(`${day.mealPlanId}|${day.dayIndex}|${mealIndex}`) ?? null,
      });
    });
  }
  console.log(`[Backfill] Extracted ${allMeals.length} raw meals (${unparseable} unparseable day blobs)`);

  // Pre-ingest grouping statistics (the brief asks for stage-by-stage counts)
  const namesOnly      = new Set(allMeals.filter(m => m.name).map(m => canonicaliseRecipeName(m.name)));
  const fullKeys       = new Set(allMeals.filter(m => m.name).map(m =>
    buildDedupeKey(m.name, m.type, m.calories ?? 0)));
  console.log(`[Backfill] Unique canonical names: ${namesOnly.size}`);
  console.log(`[Backfill] Unique composite keys (name|type|calBucket): ${fullKeys.size}`);

  // Ingest
  const stats = await ingestMeals(allMeals);

  // Post-ingest statistics
  const totalRecipes = await prisma.recipe.count();
  const largest = await prisma.recipe.findFirst({
    orderBy: { sourceCount: 'desc' },
    select: { name: true, sourceCount: true, dedupeKey: true },
  });

  console.log('\n[Backfill] ── Results ─────────────────────────────────');
  console.log(`  Raw meals processed:        ${stats.processed}`);
  console.log(`  Filtered out (bad macros):  ${stats.filteredOut}`);
  console.log(`  New recipes created:        ${stats.created}`);
  console.log(`  Variants created (>±20%):   ${stats.variantsCreated}`);
  console.log(`  Merged into existing:       ${stats.merged}`);
  console.log(`  Recipe table total:         ${totalRecipes}`);
  if (largest) {
    console.log(`  Largest merge cluster:      "${largest.name}" ×${largest.sourceCount} (${largest.dedupeKey})`);
  }
}

main()
  .catch(err => { console.error('[Backfill] Failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
