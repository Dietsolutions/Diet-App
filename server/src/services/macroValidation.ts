// Macro validation logic for the CalorieNinjas verification pipeline.
// Implements the full per-meal deviation / scaling / attempt-budget flow.

// ── Deviation thresholds ──────────────────────────────────────────────────────
export const DEVIATION_ACCEPT_PCT    = 15   // under this → accept CN, no action
export const DEVIATION_SCALE_MAX_PCT = 35   // 15–35 → proportional scaling
                                            // above 35 → regenerate meal

// ── Proportional scaling cap ──────────────────────────────────────────────────
export const SCALE_UP_MAX_FACTOR     = 1.20  // never scale ingredients above 120% of original

// ── Post-scaling acceptance ───────────────────────────────────────────────────
// After scaling + CN re-check, accept if deviation is now under this
export const POST_SCALE_ACCEPT_PCT   = 35

// ── Partial match guard ───────────────────────────────────────────────────────
// If CN total < this fraction of Claude estimate AND items matched < MIN_ITEMS
// treat as CN failure
export const PARTIAL_MATCH_RATIO     = 0.50  // CN total < 50% of Claude estimate
export const PARTIAL_MATCH_MIN_ITEMS = 3     // and fewer than 3 items matched

// ── Secondary meal target check ───────────────────────────────────────────────
export const MEAL_TARGET_TOLERANCE   = 0.15  // ±15% of weighted meal budget

// ── Day-level budget ──────────────────────────────────────────────────────────
export const DAY_BUDGET_TOLERANCE    = 0.15  // ±15% of daily calorie target

// ── Attempt budget ────────────────────────────────────────────────────────────
export const MAX_CLAUDE_ATTEMPTS_PER_DAY = 5  // Claude regeneration calls per day plan

// ── Canonical meal type names ─────────────────────────────────────────────────
export const CANONICAL_MEAL_TYPES: Record<number, string[]> = {
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'lunch', 'snack', 'dinner'],
  5: ['breakfast', 'morning_snack', 'lunch', 'evening_snack', 'dinner'],
};

// ── Weighted meal calorie distributions ───────────────────────────────────────
// Keys MUST match canonical underscore-separated type names above.
export const MEAL_WEIGHT_DISTRIBUTIONS: Record<number, Record<string, number>> = {
  3: { breakfast: 0.30, lunch: 0.40, dinner: 0.30 },
  4: { breakfast: 0.25, lunch: 0.35, snack: 0.10, dinner: 0.30 },
  5: { breakfast: 0.20, morning_snack: 0.10, lunch: 0.30, evening_snack: 0.10, dinner: 0.30 },
};

// ── Meal type normaliser ──────────────────────────────────────────────────────
/**
 * Maps any Claude-generated meal type string to a canonical lowercase
 * underscore-separated value that matches a key in MEAL_WEIGHT_DISTRIBUTIONS.
 */
export function normaliseMealType(
  rawType:     string | undefined,
  mealIndex:   number,
  mealsPerDay: number,
): string {
  const canonical = CANONICAL_MEAL_TYPES[mealsPerDay as 3 | 4 | 5];

  if (!rawType) return canonical?.[mealIndex] ?? 'snack';

  const t = rawType.toLowerCase().trim()
    .replace(/[-\s]+/g, '_')
    .replace(/[^a-z_]/g, '');

  // Direct canonical match (handles PascalCase after lowercasing)
  if (canonical?.includes(t)) return t;

  // Alias map — exhaustive list of Claude-generated and plausible variants
  const aliases: Record<string, string> = {
    morning_meal:        'breakfast',
    first_meal:          'breakfast',
    am_meal:             'breakfast',
    midday_meal:         'lunch',
    mid_day_meal:        'lunch',
    second_meal:         'lunch',
    snack_1:             'snack',
    mid_morning_snack:   'snack',
    afternoon_snack:     'snack',
    tea_time:            'snack',
    tea:                 'snack',
    snack_2:             'morning_snack',
    pre_lunch_snack:     'morning_snack',
    mid_morning:         'morning_snack',
    morning_break:       'morning_snack',
    post_lunch_snack:    'evening_snack',
    pre_dinner_snack:    'evening_snack',
    evening_bite:        'evening_snack',
    snack_3:             'evening_snack',
    supper:              'dinner',
    evening_meal:        'dinner',
    night_meal:          'dinner',
    last_meal:           'dinner',
  };

  if (aliases[t]) return aliases[t];

  // Contains-based fallback
  if (t.includes('breakfast'))                         return 'breakfast';
  if (t.includes('lunch') || t.includes('midday'))     return 'lunch';
  if (t.includes('dinner') || t.includes('supper'))    return 'dinner';
  if (t.includes('snack')) {
    if (mealsPerDay === 5) return mealIndex <= 2 ? 'morning_snack' : 'evening_snack';
    return 'snack';
  }

  const fallback = canonical?.[mealIndex] ?? 'snack';
  console.warn(`[MealType] Unknown type "${rawType}" at index ${mealIndex} → "${fallback}"`);
  return fallback;
}

/**
 * Return the fraction of daily calories expected for `mealType` given `mealsPerDay`.
 * Used by macroValidationLogger — kept for backward compatibility.
 */
export function getMealWeightPct(
  mealType:    string,
  mealsPerDay: number,
  mealIndex:   number = 0,
): number {
  const dist           = MEAL_WEIGHT_DISTRIBUTIONS[mealsPerDay] ?? MEAL_WEIGHT_DISTRIBUTIONS[4];
  const normalisedType = normaliseMealType(mealType, mealIndex, mealsPerDay);
  return dist[normalisedType] ?? (1 / mealsPerDay);
}

/**
 * Return per-meal macro targets as absolute values.
 * Also returns the normalised type and weight fraction for logging.
 */
export function getMealMacroTargets(
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number },
  mealsPerDay:  number,
  mealType?:    string,
  mealIndex?:   number,
): {
  calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number;
  weight: number; normalisedType: string;
} {
  const idx            = mealIndex ?? 0;
  const normalisedType = normaliseMealType(mealType, idx, mealsPerDay);
  const dist           = MEAL_WEIGHT_DISTRIBUTIONS[mealsPerDay] ?? MEAL_WEIGHT_DISTRIBUTIONS[4];
  const weight         = dist[normalisedType] ?? (1 / mealsPerDay);
  return {
    calories: Math.round(dailyTargets.calories * weight),
    proteinG: Math.round(dailyTargets.proteinG * weight * 10) / 10,
    carbsG:   Math.round(dailyTargets.carbsG   * weight * 10) / 10,
    fatG:     Math.round(dailyTargets.fatG     * weight * 10) / 10,
    fibreG:   Math.round(dailyTargets.fibreG   * weight * 10) / 10,
    weight,
    normalisedType,
  };
}

// ── Core deviation logic ──────────────────────────────────────────────────────

export interface DeviationResult {
  deviationPct: number;
  direction:    'over' | 'under' | 'none';
  action:       'accept_cn' | 'scale' | 'regenerate' | 'cn_failure' | 'partial_match_failure';
}

export function computeDeviation(
  claudeCalories: number,
  cnCalories:     number,
  cnSuccess:      boolean,
  cnItemsMatched: number,
): DeviationResult {
  if (!cnSuccess || cnCalories === 0) {
    return { deviationPct: 0, direction: 'none', action: 'cn_failure' };
  }

  // Partial match guard
  if (
    cnCalories < claudeCalories * PARTIAL_MATCH_RATIO &&
    cnItemsMatched < PARTIAL_MATCH_MIN_ITEMS
  ) {
    return { deviationPct: 0, direction: 'none', action: 'partial_match_failure' };
  }

  const deviationPct = Math.abs(cnCalories - claudeCalories) / claudeCalories * 100;
  const direction    = cnCalories > claudeCalories ? 'over' : 'under';

  let action: DeviationResult['action'];
  if (deviationPct < DEVIATION_ACCEPT_PCT) {
    action = 'accept_cn';
  } else if (deviationPct <= DEVIATION_SCALE_MAX_PCT) {
    action = 'scale';
  } else {
    action = 'regenerate';
  }

  return { deviationPct, direction, action };
}

export function computeProportionalScaleFactor(
  claudeCalories: number,
  cnCalories:     number,
): number {
  // Scale factor brings ingredient quantities so CN would return ~Claude's estimate.
  // Cap scale-up to SCALE_UP_MAX_FACTOR to prevent snack → full meal bloat.
  const raw = claudeCalories / cnCalories;
  return Math.min(raw, SCALE_UP_MAX_FACTOR);
}

export function applyScaleToIngredients(
  ingredients: string[],
  scaleFactor: number,
): string[] {
  // Scales gram/ml quantities found in ingredient strings.
  // e.g. "120g chicken breast" at 0.769 → "92g chicken breast"
  return ingredients.map(ing =>
    ing.replace(/(\d+(?:\.\d+)?)\s*(g|ml|kg|l)\b/gi, (_, num, unit) => {
      const scaled = Math.round(parseFloat(num) * scaleFactor * 10) / 10;
      return `${scaled}${unit}`;
    })
  );
}

// ── Meal target secondary check ───────────────────────────────────────────────

export function checkMealAgainstTarget(
  finalCalories: number,
  mealTarget:    { calories: number },
): { withinTarget: boolean; deviationFromTarget: number } {
  if (!mealTarget.calories || mealTarget.calories === 0) {
    return { withinTarget: true, deviationFromTarget: 0 };
  }
  const dev = Math.abs(finalCalories - mealTarget.calories) / mealTarget.calories;
  return {
    withinTarget:        dev <= MEAL_TARGET_TOLERANCE,
    deviationFromTarget: Math.round(dev * 100),
  };
}

// ── Day-level budget check ────────────────────────────────────────────────────

export interface DayBudgetResult {
  isValid:          boolean;
  dayTotalCalories: number;
  targetCalories:   number;
  deviationPct:     number;
  largestMealIndex: number;
}

export function checkDayBudget(
  meals:        any[],
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number },
): DayBudgetResult {
  const dayTotal = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const dev      = Math.abs(dayTotal - dailyTargets.calories) / dailyTargets.calories;

  const largestMealIndex = meals.reduce(
    (maxIdx, m, i, arr) =>
      (m.calories ?? 0) > (arr[maxIdx].calories ?? 0) ? i : maxIdx,
    0,
  );

  return {
    isValid:          dev <= DAY_BUDGET_TOLERANCE,
    dayTotalCalories: Math.round(dayTotal),
    targetCalories:   dailyTargets.calories,
    deviationPct:     Math.round(dev * 100),
    largestMealIndex,
  };
}

// ── Correction prompt builders ────────────────────────────────────────────────

export function buildMealCorrectionPrompt(
  originalMeal:    any,
  mealTarget:      { calories: number; proteinG: number; carbsG: number; fatG: number },
  rejectionReason: string,
  userProfile:     any,
): string {
  const cuisines = (() => {
    try { return JSON.parse(userProfile.cuisinePreferences || '[]'); } catch { return []; }
  })();
  const allergies = (() => {
    try { return JSON.parse(userProfile.allergies || '[]'); } catch { return []; }
  })();
  const health = (() => {
    try { return JSON.parse(userProfile.healthConditions || '[]'); } catch { return []; }
  })();

  return `You are correcting a meal in a diet plan.

REJECTED MEAL: ${originalMeal.name} (${originalMeal.type})
REASON REJECTED: ${rejectionReason}

MEAL TARGET FOR ${(originalMeal.type ?? 'meal').toUpperCase()}:
  Calories: ~${mealTarget.calories} kcal
  Protein:  ~${mealTarget.proteinG}g
  Carbs:    ~${mealTarget.carbsG}g
  Fat:      ~${mealTarget.fatG}g

USER PREFERENCES:
  Diet: ${userProfile.mealPreference ?? 'non_vegetarian'}
  Cuisine: ${cuisines.join(', ') || 'Indian'}
  Allergies: ${allergies.join(', ') || 'None'}
  Health conditions: ${health.join(', ') || 'None'}
  Custom instructions: ${userProfile.mealPlanCustomInstructions ?? 'None'}

Generate ONE replacement meal for ${originalMeal.type}.
The replacement MUST be different from "${originalMeal.name}".
The replacement MUST hit the calorie and macro targets above.
List specific ingredients with gram quantities so macros can be verified.

Respond ONLY with valid JSON — no preamble:
{
  "name":        "<string>",
  "type":        "${originalMeal.type}",
  "time":        "${originalMeal.time ?? ''}",
  "description": "<string>",
  "ingredients": ["<string>"],
  "calories":    <number>,
  "protein":     <number>,
  "carbs":       <number>,
  "fat":         <number>,
  "fibre":       <number>,
  "prepTime":    "<string>"
}`;
}

export function buildDayLevelCorrectionPrompt(
  mealToReplace: any,
  mealTarget:    { calories: number; proteinG: number; carbsG: number; fatG: number },
  dayTotal:      number,
  dailyTarget:   number,
  userProfile:   any,
): string {
  const gap = Math.round(dayTotal - dailyTarget);
  return buildMealCorrectionPrompt(
    mealToReplace,
    mealTarget,
    `Day total is ${Math.abs(gap)} kcal ${gap > 0 ? 'over' : 'under'} the daily budget of ${dailyTarget} kcal. ` +
    `This meal (${mealToReplace.name}, ${mealToReplace.calories} kcal) is the largest and needs replacing.`,
    userProfile,
  );
}
