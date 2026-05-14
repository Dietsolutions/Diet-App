// Macro validation logic for the CalorieNinjas verification pipeline.
// Implements the full per-meal deviation / scaling / attempt-budget flow.

// ── Deviation thresholds ──────────────────────────────────────────────────────
export const DEVIATION_ACCEPT_PCT    = 15   // under this → accept CN, no action
export const DEVIATION_SCALE_MAX_PCT = 35   // 15–35 → proportional scaling
                                            // above 35 → regenerate meal

// ── Secondary macro routing thresholds ───────────────────────────────────────
// Fat is excluded from routing — CN fat estimates are too noisy for Indian
// cooking (tiny ghee/oil quantities cause large percentage swings).
export const PROTEIN_REGEN_PCT  = 50   // protein >50% off → escalate to regenerate
export const PROTEIN_SCALE_PCT  = 30   // protein >30% off → escalate to scale
export const CARB_SCALE_PCT     = 40   // carbs >40% off → escalate to scale

// ── Proportional scaling cap ──────────────────────────────────────────────────
export const SCALE_UP_MAX_FACTOR     = 1.20  // never scale ingredients above 120% of original

// ── Post-scaling acceptance ───────────────────────────────────────────────────
// After scaling + CN re-check, accept if deviation is now under this
export const POST_SCALE_ACCEPT_PCT   = 35

// ── Scaling sanity check ──────────────────────────────────────────────────────
// If post-scale CN calories > this multiplier × original Claude estimate,
// the scaled ingredient string was corrupted — accept Claude estimate instead
export const SCALING_SANITY_MAX_MULTIPLIER = 3.0

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

// ── Plan-level CN slot failure fast-track ─────────────────────────────────────
// Once a meal slot (by mealIndex) accumulates this many confirmed CN failures
// across the entire plan, all future meals at that slot skip CN entirely and
// accept Claude's estimate. Prevents burning Claude regeneration attempts on
// food types that CN consistently cannot validate (e.g. Indian fish preparations).
export const CN_FAST_TRACK_THRESHOLD = 2

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
  // Per-macro deviation percentages (absolute %)
  calDeviationPct:  number;
  protDeviationPct: number;
  carbDeviationPct: number;
  fatDeviationPct:  number;    // captured but NOT used for routing — CN fat is too noisy

  direction:    'over' | 'under' | 'none';  // CN vs Claude on calories

  // Routing decision (priority: cn_failure > regenerate > scale > accept_cn)
  action:       'accept_cn' | 'scale' | 'regenerate' | 'cn_failure' | 'partial_match_failure';

  // Which macro was the deciding trigger
  triggerMacro: 'calories' | 'protein' | 'carbs' | 'cn_failure' | 'partial_match' | 'none';

  // Backward-compat alias for existing callers that read deviation.deviationPct
  deviationPct: number;   // = calDeviationPct
}

export function computeDeviation(
  claude: {
    calories: number;
    protein:  number;
    carbs:    number;
    fat:      number;
  },
  cn: {
    calories:     number;
    protein:      number;
    carbs:        number;
    fat:          number;
    success:      boolean;
    itemsMatched: number;
  },
): DeviationResult {
  // ── CN failure checks ─────────────────────────────────────────────────────
  if (!cn.success || cn.calories === 0) {
    return {
      calDeviationPct: 0, protDeviationPct: 0,
      carbDeviationPct: 0, fatDeviationPct: 0,
      direction: 'none', action: 'cn_failure', triggerMacro: 'cn_failure',
      deviationPct: 0,
    };
  }

  // Partial match guard: CN total < 50% of Claude estimate AND < 3 items matched
  if (cn.calories < claude.calories * PARTIAL_MATCH_RATIO && cn.itemsMatched < PARTIAL_MATCH_MIN_ITEMS) {
    return {
      calDeviationPct: 0, protDeviationPct: 0,
      carbDeviationPct: 0, fatDeviationPct: 0,
      direction: 'none', action: 'partial_match_failure', triggerMacro: 'partial_match',
      deviationPct: 0,
    };
  }

  // ── Per-macro deviation (absolute %) ─────────────────────────────────────
  const calDev  = Math.abs(cn.calories - claude.calories) / claude.calories * 100;
  const protDev = claude.protein > 0
    ? Math.abs(cn.protein - claude.protein) / claude.protein * 100 : 0;
  const carbDev = claude.carbs > 0
    ? Math.abs(cn.carbs   - claude.carbs)   / claude.carbs   * 100 : 0;
  const fatDev  = claude.fat > 0
    ? Math.abs(cn.fat     - claude.fat)     / claude.fat     * 100 : 0;

  const direction = cn.calories > claude.calories ? 'over' : 'under';

  // ── Routing — priority hierarchy ──────────────────────────────────────────
  // 1. Calorie deviation > 35% → regenerate (strictly above, so 35.0 → scale)
  if (calDev > DEVIATION_SCALE_MAX_PCT) {
    return {
      calDeviationPct: calDev, protDeviationPct: protDev,
      carbDeviationPct: carbDev, fatDeviationPct: fatDev,
      direction, action: 'regenerate', triggerMacro: 'calories',
      deviationPct: calDev,
    };
  }
  // 2. Protein deviation > 50% → regenerate
  if (protDev > PROTEIN_REGEN_PCT) {
    return {
      calDeviationPct: calDev, protDeviationPct: protDev,
      carbDeviationPct: carbDev, fatDeviationPct: fatDev,
      direction, action: 'regenerate', triggerMacro: 'protein',
      deviationPct: calDev,
    };
  }
  // 3. Calorie deviation >= 15% → scale
  if (calDev >= DEVIATION_ACCEPT_PCT) {
    return {
      calDeviationPct: calDev, protDeviationPct: protDev,
      carbDeviationPct: carbDev, fatDeviationPct: fatDev,
      direction, action: 'scale', triggerMacro: 'calories',
      deviationPct: calDev,
    };
  }
  // 4. Protein deviation > 30% → scale
  if (protDev > PROTEIN_SCALE_PCT) {
    return {
      calDeviationPct: calDev, protDeviationPct: protDev,
      carbDeviationPct: carbDev, fatDeviationPct: fatDev,
      direction, action: 'scale', triggerMacro: 'protein',
      deviationPct: calDev,
    };
  }
  // 5. Carb deviation > 40% → scale
  if (carbDev > CARB_SCALE_PCT) {
    return {
      calDeviationPct: calDev, protDeviationPct: protDev,
      carbDeviationPct: carbDev, fatDeviationPct: fatDev,
      direction, action: 'scale', triggerMacro: 'carbs',
      deviationPct: calDev,
    };
  }
  // 6. All within tolerance → accept CN values
  return {
    calDeviationPct: calDev, protDeviationPct: protDev,
    carbDeviationPct: carbDev, fatDeviationPct: fatDev,
    direction, action: 'accept_cn', triggerMacro: 'none',
    deviationPct: calDev,
  };
}

export function computeProportionalScaleFactor(
  claude: { calories: number; protein: number; carbs: number },
  cn:     { calories: number; protein: number; carbs: number },
): {
  scaleFactor:  number;   // blended + clamped — the value to pass to applyScaleToIngredients
  calFactor:    number;   // calorie-only scale factor
  protFactor:   number;   // protein-only scale factor
  carbFactor:   number;   // carb-only scale factor
  blendedRaw:   number;   // weighted blend before clamping (for logging)
} {
  // Per-macro factors: target / actual (how much to multiply ingredients)
  // Default 1.0 when CN returned 0 to avoid collapsing the blend.
  const calFactor  = cn.calories > 0 ? claude.calories / cn.calories : 1.0;
  const protFactor = cn.protein  > 0 ? claude.protein  / cn.protein  : 1.0;
  const carbFactor = cn.carbs    > 0 ? claude.carbs    / cn.carbs    : 1.0;

  // Weighted blend: calories 50%, protein 35%, carbs 15%
  // Fat excluded — CN fat estimates are too noisy for Indian cooking.
  const blendedRaw = (calFactor * 0.50) + (protFactor * 0.35) + (carbFactor * 0.15);

  // Clamp: never scale below 50% or above 120% of original
  const scaleFactor = Math.min(Math.max(blendedRaw, 0.50), SCALE_UP_MAX_FACTOR);

  return { scaleFactor, calFactor, protFactor, carbFactor, blendedRaw };
}

// ── Count-to-gram normaliser for CN queries ───────────────────────────────────
// Indian bread items are often described as "2 rotis" in the Claude output.
// CN cannot look up "2 rotis" — it needs "80g whole wheat roti". This converts
// count-based descriptions to gram-only ONLY for the CN query string; the
// original ingredients stored in the plan and shown in the app are never changed.

const UNIT_GRAM_MAP: Record<string, number> = {
  'whole wheat roti': 40,
  'wheat roti':       40,
  'roti':             40,
  'chapati':          40,
  'chapatti':         40,
  'phulka':           30,
  'paratha':          60,
  'naan':             90,
  'puri':             25,
  'bhatura':          80,
  'thepla':           45,
  'idli':             40,
  'dosa':             80,
  'uttapam':          90,
};

export function normaliseIngredientForCN(ingredient: string): string {
  const lower = ingredient.toLowerCase();

  // Pattern: optional leading count e.g. "2 whole wheat rotis (80g)" or "2 rotis"
  // Group 1 = count, Group 2 = food description, Group 3 = optional gram hint
  const countPattern = /^(\d+(?:\.\d+)?)\s+(.+?)(?:\s*\((\d+(?:\.\d+)?)g\))?$/i;
  const match        = ingredient.match(countPattern);
  if (!match) return ingredient;    // no leading count — return unchanged

  const count     = parseFloat(match[1]);
  const foodDesc  = match[2].trim();
  const hintGrams = match[3] ? parseFloat(match[3]) : null;

  // If the string already contains a gram hint in parentheses, use it
  // "2 whole wheat rotis (80g)" → "160g whole wheat roti"
  if (hintGrams) {
    const totalGrams = Math.round(hintGrams * count);
    const cleanName  = foodDesc
      .replace(/rotis?\s*$/i, 'roti')
      .replace(/chapatis?\s*$/i, 'chapati')
      .replace(/chapattis?\s*$/i, 'chapatti')
      .replace(/idlis?\s*$/i, 'idli')
      .replace(/parathas?\s*$/i, 'paratha')
      .replace(/puris?\s*$/i, 'puri')
      .replace(/naans?\s*$/i, 'naan')
      .replace(/dosas?\s*$/i, 'dosa')
      .trim();
    return `${totalGrams}g ${cleanName}`;
  }

  // No gram hint — check if food name matches a known item in UNIT_GRAM_MAP
  for (const [keyword, gramsPerUnit] of Object.entries(UNIT_GRAM_MAP)) {
    if (lower.includes(keyword)) {
      const totalGrams = Math.round(count * gramsPerUnit);
      return `${totalGrams}g ${keyword}`;
    }
  }

  // No match — return unchanged to avoid corrupting unrecognised ingredients
  return ingredient;
}

export function normaliseIngredientsForCN(ingredients: string[]): string[] {
  return ingredients.map(normaliseIngredientForCN);
}

export function applyScaleToIngredients(
  ingredients: string[],
  scaleFactor: number,
): string[] {
  // Clamp factor — never below 0.5 (never halve a meal) or above 1.2 (hard cap).
  // This prevents runaway scaling from corrupted query strings.
  const clampedFactor = Math.min(Math.max(scaleFactor, 0.50), 1.20);

  return ingredients.map(ing =>
    ing.replace(
      /(\d+(?:\.\d+)?)\s*(g|ml|kg|l)\b/gi,
      (fullMatch, numStr, unit) => {
        const original = parseFloat(numStr);
        if (isNaN(original) || original <= 0) return fullMatch; // leave unchanged

        const scaled    = original * clampedFactor;
        const unitLower = unit.toLowerCase();

        // g/ml → round to nearest integer (most common; avoids "94.625g" noise)
        // kg/l → round to 2 decimal places (small numbers need more precision)
        const rounded = (unitLower === 'kg' || unitLower === 'l')
          ? Math.round(scaled * 100) / 100
          : Math.round(scaled);

        // Never produce zero — floor at 1g or 0.01kg/0.01l
        const safe = (unitLower === 'kg' || unitLower === 'l')
          ? Math.max(0.01, rounded)
          : Math.max(1, rounded);

        return `${safe}${unit}`;
      },
    )
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

export interface FailedAttempt {
  mealName:     string;
  claudeCal:    number;
  cnCal:        number;
  deviationPct: number;
  triggerMacro: string;
}

export function buildMealCorrectionPrompt(
  originalMeal:     any,
  mealTarget:       { calories: number; proteinG: number; carbsG: number; fatG: number },
  rejectionReason:  string,
  userProfile:      any,
  attemptNumber:    number        = 1,
  previousAttempts: FailedAttempt[] = [],
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

  // Build rejection history block so Claude knows exactly what it already tried
  const historyBlock = previousAttempts.length > 0
    ? `\nPREVIOUS ATTEMPTS THAT FAILED MACRO VALIDATION (do NOT generate these again):\n` +
      previousAttempts.map((a, i) =>
        `  Attempt ${i + 1}: "${a.mealName}" — ${a.triggerMacro} was ${Math.round(a.deviationPct)}% off` +
        ` (Claude estimated ${a.claudeCal} kcal, nutrition database measured ${a.cnCal} kcal)`
      ).join('\n')
    : '';

  // Escalation instruction on attempt 3+: force a fundamentally different dish
  const escalationBlock = attemptNumber >= 3
    ? `\nATTENTION — attempt ${attemptNumber}: all previous suggestions failed validation. ` +
      `You MUST generate a COMPLETELY DIFFERENT type of dish: different protein source ` +
      `(e.g. switch from fish/prawn to chicken/eggs/paneer), different cooking method, ` +
      `and different cuisine style. Do not regenerate variations of what was already tried.`
    : '';

  return `You are correcting a meal in a diet plan. Attempt ${attemptNumber}.
${historyBlock}${escalationBlock}

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
The replacement MUST be different from "${originalMeal.name}"${previousAttempts.length > 0 ? ' and from all previous attempts listed above' : ''}.
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
    1,   // attemptNumber — day-level correction is always a single shot
    [],  // previousAttempts — no prior history for day-level corrections
  );
}
