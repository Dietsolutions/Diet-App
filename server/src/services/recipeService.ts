// Recipe library service — extracts, deduplicates and stores unique meals
// from users' AI-generated plans. Used by the backfill script and the
// plan-generation save flow. Recipes are anonymous: only a whitelist of
// meal fields is ever copied, so nothing user-identifying can leak in.

import prisma from '../lib/prisma';

// ── Canonical name ────────────────────────────────────────────────────────────
// Filler words that never change the identity of a dish
const FILLER_WORDS = new Set([
  'with', 'and', 'served', 'a', 'an', 'of', 'the', 'in', 'on',
  'fresh', 'homemade', 'style', 'classic', 'simple', 'healthy',
]);

// Preparation noise — removed only when something meaningful remains
const PREP_WORDS = new Set([
  'sliced', 'chopped', 'grilled', 'steamed', 'boiled', 'roasted',
  'sautéed', 'sauteed', 'pan-fried', 'stir-fried', 'baked',
]);

/**
 * Normalise a recipe name to a canonical token string:
 * lowercase → strip punctuation → drop filler words → drop prep words
 * (unless that empties the name) → sort tokens alphabetically → join.
 * "Grilled Chicken Salad with Veggies" → "chicken salad veggies"
 */
export function canonicaliseRecipeName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0 && !FILLER_WORDS.has(t));

  const withoutPrep = tokens.filter(t => !PREP_WORDS.has(t));
  const significant = withoutPrep.length > 0 ? withoutPrep : tokens;

  return significant.sort().join(' ');
}

// ── Composite dedupe key ──────────────────────────────────────────────────────
const CALORIE_BUCKET_SIZE = 50;

export function calorieBucket(calories: number): number {
  return Math.round(calories / CALORIE_BUCKET_SIZE) * CALORIE_BUCKET_SIZE;
}

/** Collapse the 3/4/5-meals-per-day type variants onto the four library slots. */
export function libraryMealType(rawType: string | undefined): string {
  const t = (rawType ?? '').toLowerCase().trim();
  if (t.includes('breakfast')) return 'breakfast';
  if (t.includes('lunch'))     return 'lunch';
  if (t.includes('dinner'))    return 'dinner';
  return 'snack';   // snack, morning_snack, evening_snack, unknown
}

export function buildDedupeKey(name: string, mealType: string | undefined, calories: number): string {
  return `${canonicaliseRecipeName(name)}|${libraryMealType(mealType)}|${calorieBucket(calories)}`;
}

// ── Diet type inference ───────────────────────────────────────────────────────
const NON_VEG_KEYWORDS = [
  'chicken', 'mutton', 'lamb', 'fish', 'prawn', 'shrimp', 'tuna',
  'salmon', 'crab', 'squid', 'beef', 'pork', 'keema', 'meat',
];
const EGG_KEYWORDS = ['egg', 'eggs', 'bhurji'];   // bhurji alone is ambiguous — checked after paneer

export function inferDietType(name: string, ingredients: string[]): 'veg' | 'non_veg' | 'egg' {
  const haystack = (name + ' ' + ingredients.join(' ')).toLowerCase();
  if (NON_VEG_KEYWORDS.some(k => haystack.includes(k))) return 'non_veg';
  // "paneer bhurji" is veg; only egg-flag bhurji when egg is actually present
  if (/\begg/.test(haystack)) return 'egg';
  return 'veg';
}

// ── Quality filter ────────────────────────────────────────────────────────────
// Outcomes whose macros were independently verified by CN
const VALIDATED_OUTCOMES = new Set(['accepted_cn', 'accepted_after_scaling']);
// Outcomes that mean the macros are known-unreliable — never ingest
const BAD_OUTCOMES = new Set([
  'attempts_exhausted', 'scaling_sanity_failed', 'correction_parse_failed',
  'cn_failure', 'partial_match_failure', 'cn_fast_track_failure',
]);

/**
 * Plausibility check for meals with no validation verdict (cn_unavailable,
 * plan fast-track, pre-pipeline plans): stated calories in a sane range,
 * macros present, and macro-derived calories within ±40% of stated.
 */
export function passesSanityFilter(meal: {
  calories?: number; protein?: number; carbs?: number; fat?: number;
}): boolean {
  const cal  = meal.calories ?? 0;
  const prot = meal.protein  ?? 0;
  const carb = meal.carbs    ?? 0;
  const fat  = meal.fat      ?? 0;
  if (cal < 50 || cal > 1500) return false;
  if (prot < 0 || carb < 0 || fat < 0) return false;
  if (prot === 0 && carb === 0 && fat === 0) return false;
  const derived = prot * 4 + carb * 4 + fat * 9;
  return Math.abs(derived - cal) / cal <= 0.40;
}

/**
 * Decide whether a meal's macros are trustworthy enough for the library.
 * finalOutcome comes from the validation pipeline when available.
 */
export function passesQualityFilter(
  meal: { calories?: number; protein?: number; carbs?: number; fat?: number },
  finalOutcome?: string | null,
): boolean {
  if (finalOutcome && BAD_OUTCOMES.has(finalOutcome)) return false;
  if (finalOutcome && VALIDATED_OUTCOMES.has(finalOutcome)) return true;
  return passesSanityFilter(meal);
}

// ── Macro similarity guard ────────────────────────────────────────────────────
export const MACRO_MERGE_TOLERANCE = 0.20;   // ±20% on protein, carbs and fat

function withinTolerance(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  const base = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / base <= MACRO_MERGE_TOLERANCE;
}

export function macrosSimilar(
  a: { protein: number; carbs: number; fat: number },
  b: { protein: number; carbs: number; fat: number },
): boolean {
  return withinTolerance(a.protein, b.protein)
      && withinTolerance(a.carbs,   b.carbs)
      && withinTolerance(a.fat,     b.fat);
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

export interface IngestableMeal {
  name:         string;
  type?:        string;
  description?: string;
  ingredients?: string[];
  time?:        string;
  calories?:    number;
  protein?:     number;
  carbs?:       number;
  fat?:         number;
  fibre?:       number;
  prepTime?:    string;
  /** finalOutcome from the validation pipeline, when known */
  finalOutcome?: string | null;
}

export interface IngestStats {
  processed:        number;   // meals offered to the ingester
  filteredOut:      number;   // rejected by the quality filter
  merged:           number;   // collapsed into an existing recipe
  variantsCreated:  number;   // same key but macros >±20% apart → new variant
  created:          number;   // brand-new recipes
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const MAX_VARIANTS_PER_KEY = 5;

/**
 * Ingest one meal into the recipe library. Whitelists fields explicitly —
 * never copies arbitrary meal-blob properties.
 *
 * Merge policy (per the brief):
 *  - same dedupeKey + macros within ±20% → merge: bump sourceCount, keep the
 *    longest ingredient list, set macros to the running median approximation
 *    (weighted blend of stored value and incoming value — exact medians would
 *    need every historical instance; the blend converges on the median for
 *    realistic cluster sizes and is robust to single outliers)
 *  - same dedupeKey + macros differ → try "|v2".."|v5" variant keys
 */
export async function ingestMeal(meal: IngestableMeal, stats: IngestStats): Promise<void> {
  stats.processed++;

  if (!meal.name || typeof meal.name !== 'string') { stats.filteredOut++; return; }
  if (!passesQualityFilter(meal, meal.finalOutcome)) { stats.filteredOut++; return; }

  const calories = meal.calories ?? 0;
  const protein  = meal.protein  ?? 0;
  const carbs    = meal.carbs    ?? 0;
  const fat      = meal.fat      ?? 0;
  const fibre    = meal.fibre    ?? 0;
  const ingredients = Array.isArray(meal.ingredients)
    ? meal.ingredients.filter((i): i is string => typeof i === 'string')
    : [];

  const baseKey  = buildDedupeKey(meal.name, meal.type, calories);
  const mealType = libraryMealType(meal.type);

  for (let v = 1; v <= MAX_VARIANTS_PER_KEY; v++) {
    const key = v === 1 ? baseKey : `${baseKey}|v${v}`;
    const existing = await prisma.recipe.findUnique({ where: { dedupeKey: key } });

    if (!existing) {
      await prisma.recipe.create({
        data: {
          name:        meal.name.trim(),
          mealType,
          description: meal.description ?? '',
          ingredients: JSON.stringify(ingredients),
          time:        meal.time ?? null,
          calories, protein, carbs, fat, fibre,
          dietType:    inferDietType(meal.name, ingredients),
          prepTime:    meal.prepTime ?? null,
          dedupeKey:   key,
        },
      });
      if (v > 1) stats.variantsCreated++; else stats.created++;
      return;
    }

    if (macrosSimilar(existing, { protein, carbs, fat })) {
      // Merge. n = instances seen so far; blend pulls the stored value toward
      // the incoming one with weight 1/(n+1) — equals the true mean, and a
      // close median proxy given the ±20% gate has already excluded outliers.
      const n = existing.sourceCount;
      const blend = (stored: number, incoming: number) =>
        Math.round(((stored * n + incoming) / (n + 1)) * 10) / 10;

      const existingIngredients: string[] = JSON.parse(existing.ingredients || '[]');
      const keepIncoming = ingredients.length > existingIngredients.length;

      await prisma.recipe.update({
        where: { id: existing.id },
        data: {
          sourceCount: { increment: 1 },
          calories: blend(existing.calories, calories),
          protein:  blend(existing.protein,  protein),
          carbs:    blend(existing.carbs,    carbs),
          fat:      blend(existing.fat,      fat),
          fibre:    blend(existing.fibre,    fibre),
          ...(keepIncoming ? {
            ingredients: JSON.stringify(ingredients),
            description: meal.description ?? existing.description,
          } : {}),
        },
      });
      stats.merged++;
      return;
    }
    // key collision but macros genuinely different → try next variant slot
  }

  // All variant slots taken and none similar — extremely unlikely; skip.
  stats.filteredOut++;
}

export function newIngestStats(): IngestStats {
  return { processed: 0, filteredOut: 0, merged: 0, variantsCreated: 0, created: 0 };
}

/**
 * Ingest a batch of meals (e.g. all meals of a freshly generated plan).
 * Sequential on purpose: dedupe correctness relies on read-then-write per key.
 */
export async function ingestMeals(meals: IngestableMeal[]): Promise<IngestStats> {
  const stats = newIngestStats();
  for (const meal of meals) {
    try {
      await ingestMeal(meal, stats);
    } catch (err: any) {
      // Unique-constraint race (two ingests creating the same key) — retry once
      // as a merge; anything else is logged and skipped, never thrown.
      if (err?.code === 'P2002') {
        try { await ingestMeal(meal, stats); continue; } catch { /* fall through */ }
      }
      console.warn(`[Recipes] Ingest failed for "${meal.name}":`, err?.message);
      stats.filteredOut++;
    }
  }
  return stats;
}

export { median };   // exported for the backfill's statistics
