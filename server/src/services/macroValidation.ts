// Macro validation logic for the CalorieNinjas verification pipeline.
// Compares CN-verified daily totals against user targets and builds
// correction prompts for out-of-range macros.

import { CNMacros } from './calorieNinjasService';

// ── Weighted meal calorie distributions ──────────────────────────────────────
// A snack should NOT be held to the same target as lunch.
// These weights reflect typical meal energy proportions.
export const MEAL_WEIGHT_DISTRIBUTIONS: Record<number, Record<string, number>> = {
  3: { breakfast: 0.30, lunch: 0.40, dinner: 0.30 },
  4: { breakfast: 0.25, lunch: 0.35, snack: 0.10, dinner: 0.30 },
  5: { breakfast: 0.25, 'mid-morning snack': 0.10, lunch: 0.30, 'evening snack': 0.15, dinner: 0.20 },
};

/**
 * Return the fraction of daily calories expected for `mealType` given `mealsPerDay`.
 * Falls back to equal split for unrecognised meal types.
 */
export function getMealWeightPct(mealType: string, mealsPerDay: number): number {
  const dist = MEAL_WEIGHT_DISTRIBUTIONS[mealsPerDay] ?? MEAL_WEIGHT_DISTRIBUTIONS[4];
  const key  = (mealType ?? '').toLowerCase();
  return dist[key] ?? (1 / mealsPerDay);
}

interface DailyTargets {
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  fibreG:   number;
}

export interface DailyGap {
  macro:  string;
  actual: number;
  target: number;
  delta:  number; // negative = short, positive = over
  pct:    number; // actual / target × 100
}

export interface ValidationResult {
  isValid:        boolean;
  gaps:           DailyGap[];
  totalVerified:  DailyTargets;
}

// Acceptable tolerance per macro.
// Deliberately generous — a meal plan that is ±12% on calories is fine.
// Protein tolerance is asymmetric (being over is acceptable; being short triggers correction).
const TOLERANCE: Record<string, { min: number; max: number }> = {
  calories: { min: 0.88, max: 1.12 }, // ±12%
  proteinG: { min: 0.85, max: 1.20 }, // −15% to +20%
  carbsG:   { min: 0.80, max: 1.20 }, // ±20%
  fatG:     { min: 0.80, max: 1.20 }, // ±20%
};

export function validateDayMacros(
  verifiedMacros: CNMacros[],
  targets:        DailyTargets,
): ValidationResult {
  // Sum CN-verified macros across all meals for this day
  const total = verifiedMacros.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      carbsG:   acc.carbsG   + (m.carbsG   ?? 0),
      fatG:     acc.fatG     + (m.fatG     ?? 0),
      fibreG:   acc.fibreG   + (m.fibreG   ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
  );

  // ── TRACE: log verified day totals vs targets ───────────────────────────
  console.log('[macroValidation] Day totals (CN-verified):', {
    calories: `${Math.round(total.calories)} / ${targets.calories} (${targets.calories ? Math.round((total.calories / targets.calories) * 100) : '?'}%)`,
    proteinG: `${Math.round(total.proteinG)} / ${targets.proteinG} (${targets.proteinG ? Math.round((total.proteinG / targets.proteinG) * 100) : '?'}%)`,
    carbsG:   `${Math.round(total.carbsG)}   / ${targets.carbsG}   (${targets.carbsG   ? Math.round((total.carbsG   / targets.carbsG)   * 100) : '?'}%)`,
    fatG:     `${Math.round(total.fatG)}     / ${targets.fatG}     (${targets.fatG     ? Math.round((total.fatG     / targets.fatG)     * 100) : '?'}%)`,
  });

  const gaps:    DailyGap[] = [];
  let   isValid              = true;

  for (const [macro, tol] of Object.entries(TOLERANCE)) {
    const actual = (total  as any)[macro] as number;
    const target = (targets as any)[macro] as number;
    if (!target || target <= 0) continue;

    const pct = actual / target;

    // ── TRACE: log per-macro deviation check ─────────────────────────────
    const status = pct < tol.min ? '❌ LOW' : pct > tol.max ? '❌ HIGH' : '✅ OK';
    console.log(
      `[macroValidation]   ${macro.padEnd(10)} actual=${Math.round(actual).toString().padStart(5)}` +
      `  target=${Math.round(target).toString().padStart(5)}  pct=${Math.round(pct * 100)}%` +
      `  window=[${Math.round(tol.min * 100)}%–${Math.round(tol.max * 100)}%]  ${status}`
    );

    if (pct < tol.min || pct > tol.max) {
      isValid = false;
      gaps.push({
        macro,
        actual: Math.round(actual),
        target: Math.round(target),
        delta:  Math.round(actual - target),
        pct:    Math.round(pct * 100),
      });
    }
  }

  console.log(`[macroValidation] Result: isValid=${isValid}, gaps=[${gaps.map(g => g.macro).join(', ')}]`);

  return { isValid, gaps, totalVerified: total as DailyTargets };
}

// ── Per-meal CN-vs-Claude accuracy check ─────────────────────────────────────
/**
 * Returns { accurate: true } if the CN-verified calorie count is within
 * `threshold` fraction of Claude's own estimate for that meal.
 *
 * When accurate, it means Claude correctly sized the meal — keep Claude's
 * numbers (which respect the weighted meal-calorie distribution).
 * When inaccurate, Claude was significantly wrong — use CN's numbers instead.
 */
export function evaluateMealAccuracy(
  cnCalories:     number,
  claudeCalories: number,
  threshold:      number = 0.25,
): { accurate: boolean } {
  if (claudeCalories <= 0) return { accurate: false };
  const diff = Math.abs(cnCalories - claudeCalories);
  return { accurate: (diff / claudeCalories) <= threshold };
}

// ── Day-budget validation on finalized (arbitrated) meal macros ───────────────
/**
 * Same tolerance bands as validateDayMacros, but accepts the post-arbitration
 * meal objects (calories/protein/carbs/fat/fibre) instead of raw CNMacros[].
 * Call this AFTER running evaluateMealAccuracy() on each meal.
 */
export function validateDayBudget(
  finalMeals: Array<{ calories: number; protein: number; carbs: number; fat: number; fibre?: number }>,
  targets:    DailyTargets,
): ValidationResult {
  const total = finalMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      proteinG: acc.proteinG + (m.protein  ?? 0),
      carbsG:   acc.carbsG   + (m.carbs    ?? 0),
      fatG:     acc.fatG     + (m.fat      ?? 0),
      fibreG:   acc.fibreG   + ((m as any).fibre ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
  );

  console.log('[macroValidation] Day budget (arbitrated macros):', {
    calories: `${Math.round(total.calories)} / ${targets.calories} (${targets.calories ? Math.round((total.calories / targets.calories) * 100) : '?'}%)`,
    proteinG: `${Math.round(total.proteinG)} / ${targets.proteinG}`,
    carbsG:   `${Math.round(total.carbsG)}   / ${targets.carbsG}`,
    fatG:     `${Math.round(total.fatG)}     / ${targets.fatG}`,
  });

  const gaps:  DailyGap[] = [];
  let  isValid              = true;

  for (const [macro, tol] of Object.entries(TOLERANCE)) {
    const actual = (total   as any)[macro] as number;
    const target = (targets as any)[macro] as number;
    if (!target || target <= 0) continue;

    const pct    = actual / target;
    const status = pct < tol.min ? '❌ LOW' : pct > tol.max ? '❌ HIGH' : '✅ OK';
    console.log(
      `[macroValidation]   ${macro.padEnd(10)} actual=${Math.round(actual).toString().padStart(5)}` +
      `  target=${Math.round(target).toString().padStart(5)}  pct=${Math.round(pct * 100)}%` +
      `  window=[${Math.round(tol.min * 100)}%–${Math.round(tol.max * 100)}%]  ${status}`
    );

    if (pct < tol.min || pct > tol.max) {
      isValid = false;
      gaps.push({
        macro,
        actual: Math.round(actual),
        target: Math.round(target),
        delta:  Math.round(actual - target),
        pct:    Math.round(pct * 100),
      });
    }
  }

  console.log(`[macroValidation] Budget result: isValid=${isValid}, gaps=[${gaps.map(g => g.macro).join(', ')}]`);
  return { isValid, gaps, totalVerified: total as DailyTargets };
}

export function buildCorrectionPrompt(
  gaps:        DailyGap[],
  currentMeals: any[],
  userProfile:  any,
): string {
  const gapDescriptions = gaps.map(g => {
    const direction = g.delta < 0 ? 'short' : 'over';
    const amount    = Math.abs(g.delta);
    const unit      = g.macro === 'calories' ? 'kcal' : 'g';
    return `${g.macro}: ${amount}${unit} ${direction} (at ${g.pct}% of target)`;
  }).join('\n');

  const totalCalorieGap = Math.abs(
    gaps.find(g => g.macro === 'calories')?.delta ?? 0
  );

  // Gap-aware meal targeting:
  // Large gap (>250 kcal) — a snack cannot close it; target lunch or dinner.
  // Small gap — snack adjustment is sufficient.
  const mealToReplace = (() => {
    if (totalCalorieGap > 250) {
      return (
        currentMeals.find(m => m.type === 'lunch')  ??
        currentMeals.find(m => m.type === 'dinner') ??
        currentMeals[1]
      );
    }
    return (
      currentMeals.find(m => m.type === 'snack') ??
      currentMeals.find(m => m.type === 'lunch') ??
      currentMeals[1]
    );
  })();

  return `You are adjusting a meal plan to better meet daily macro targets.

CURRENT MEALS:
${currentMeals.map((m, i) =>
  `${i + 1}. ${m.type}: ${m.name} — ${m.calories}kcal P:${m.protein}g C:${m.carbs}g F:${m.fat}g`
).join('\n')}

MACRO GAPS (verified by CalorieNinjas database):
${gapDescriptions}

MEAL TO REPLACE: ${mealToReplace.name} (${mealToReplace.type})

USER PREFERENCES:
Diet: ${userProfile.mealPreference || 'non_vegetarian'}
Cuisine: ${(JSON.parse(userProfile.cuisinePreferences || '[]') as string[]).join(', ') || 'Indian'}
Allergies: ${(JSON.parse(userProfile.allergies || '[]') as string[]).join(', ') || 'None'}
Custom instructions: ${userProfile.mealPlanCustomInstructions || 'None'}

The calorie gap is ${totalCalorieGap} kcal. ${totalCalorieGap > 250
  ? 'This is a large gap — generate a substantial meal, not a snack.'
  : 'This is a small gap — a light meal or snack adjustment is appropriate.'}

INGREDIENT QUANTITIES — MANDATORY:
- EVERY item in the ingredients array MUST include a numeric quantity (e.g. "150g chicken", "1g turmeric")
- Oils/ghee: grams only, never ml (e.g. "10g ghee")
- Spice reference: turmeric 1-2g · red chili powder 2-3g · coriander powder 3-5g · cumin seeds 2-3g · garam masala 2g · salt 2g
- Proteins: 80–200g · Grains (raw): 60–100g · Vegetables: 50–150g

Generate ONE replacement meal for ${mealToReplace.type} that:
1. Addresses the macro gaps listed above
2. Brings the daily total within acceptable range of targets
3. Respects all user preferences and allergies
4. Is different from the current "${mealToReplace.name}"
5. Is appropriate for ${mealToReplace.type} at ${mealToReplace.time || ''}
6. Has EVERY ingredient quantified (see mandatory rule above)

Respond ONLY with valid JSON — no explanation, no preamble:
{
  "name": "<meal name>",
  "type": "${mealToReplace.type}",
  "time": "${mealToReplace.time || ''}",
  "description": "<brief cooking instructions with gram quantities>",
  "ingredients": ["150g chicken breast", "80g onion", "1g turmeric", "2g red chili powder", "5g ghee"],
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>,
  "fibre": <number>,
  "prepTime": "<e.g. 10 min>"
}`;
}
