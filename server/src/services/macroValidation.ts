// Macro validation logic for the CalorieNinjas verification pipeline.
// Implements the full per-meal deviation / scaling / attempt-budget flow.

// ── Deviation thresholds ──────────────────────────────────────────────────────
export const DEVIATION_ACCEPT_PCT    = 15   // under this → accept CN, no action
// 15% and above → proportional scaling FIRST. CN gives us the meal's true macros,
// so a large CN-vs-Claude gap just means Claude mis-estimated — we can scale the
// real portions toward the target deterministically (no Claude call, no poisoning).
// Scaling is self-limiting: the factor is clamped to [0.5, SCALE_UP_MAX_FACTOR] and
// a post-scale CN re-check (POST_SCALE_ACCEPT_PCT) escalates to regenerate only when
// portions genuinely can't reach the target (e.g. wrong macro RATIO, not magnitude).
// This is why the ceiling is high: scaling, not Claude regeneration, is the reliable
// way to hit a calorie target, and Claude corrections were not converging.
export const DEVIATION_SCALE_MAX_PCT = 200  // 15–200 → scale; only absurd gaps regenerate

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

// ── Plan-level CN slot failure fast-track (DISABLED in the two-pass design) ───
// Legacy from single-pass validation: once a slot accumulated this many CN
// failures, all future meals at that slot skipped CN. In the two-pass pipeline
// (DECISIONS §22) Pass A already CN-checks every meal in a clean invocation, so
// the only failures left are Pass B's poisoned post-correction rechecks — and
// fast-tracking those just cascaded (disabling CN for whole days, keeping the
// uncorrected meal). Set effectively-infinite so the cascade never fires; a
// meal whose recheck fails now falls back individually without poisoning others.
export const CN_FAST_TRACK_THRESHOLD = 9_999_999

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

// ── CN ingredient normaliser ──────────────────────────────────────────────────
// CalorieNinjas tokenises ingredient names and applies default serving weights,
// so passing "80g whole wheat roti" returns ~900 kcal (treats each token as a
// full serving) instead of the correct ~240 kcal. The normaliser converts
// ingredients to the simplest form CN understands — ONLY for the CN query;
// ingredient strings stored in the plan and shown in the app are never changed.

const UNIT_GRAM_MAP: Record<string, number> = {
  'whole wheat roti': 40,
  'multigrain roti':  40,
  'wheat roti':       40,
  'roti':             40,
  'chapati':          40,
  'chapatti':         40,
  'phulka':           30,
  'stuffed paratha':  80,
  'aloo paratha':     100,
  'paratha':          60,
  'naan':             90,
  'puri':             25,
  'bhatura':          80,
  'thepla':           45,
  'idli':             40,
  'dosa':             80,
  'uttapam':          90,
  'bread slice':      30,
  'bread':            30,
};

// Sorted longest-first so "whole wheat roti" matches before bare "roti"
const PER_UNIT_GRAM_KEYS = Object.keys(UNIT_GRAM_MAP).sort((a, b) => b.length - a.length);

// Direct name overrides — maps what the LLM outputs to what CN understands
const CN_NAME_SIMPLIFY: Record<string, string> = {
  'whole wheat roti':    'roti',
  'whole wheat chapati': 'chapati',
  'whole wheat chapatti':'chapatti',
  'multigrain roti':     'roti',
  'wheat roti':          'roti',
  'brown bread':         'wheat bread',
  'whole wheat bread':   'wheat bread',
  'sourdough bread':     'bread',
  'full-fat milk':       'milk',
  'full fat milk':       'milk',
  'skimmed milk':        'skim milk',
  'low-fat milk':        'skim milk',
  'low fat milk':        'skim milk',
  'toned milk':          'milk',
  'double toned milk':   'skim milk',
  'homemade paneer':     'paneer',
  'low-fat paneer':      'paneer',
  'low fat paneer':      'paneer',
  'low fat curd':        'yogurt',
  'low-fat curd':        'yogurt',
  'curd':                'yogurt',
  'dahi':                'yogurt',
};

// Descriptor prefixes to strip when no direct override matches
const STRIP_DESCRIPTORS = [
  'double toned', 'whole wheat', 'whole-wheat',
  'multigrain', 'multi-grain',
  'low-fat', 'low fat',
  'full-fat', 'full fat',
  'homemade', 'fresh', 'organic', 'plain',
  'skimmed', 'toned',
];

export function isBreadItem(lower: string): boolean {
  return PER_UNIT_GRAM_KEYS.some(k => lower.includes(k));
}

export function simplifyFoodName(raw: string): string {
  // Singularise common Indian bread plurals before any lookup
  const singularised = raw.toLowerCase().trim()
    .replace(/\brotis\b/g,     'roti')
    .replace(/\bchapatis\b/g,  'chapati')
    .replace(/\bchapattis\b/g, 'chapatti')
    .replace(/\bidlis\b/g,     'idli')
    .replace(/\bparathas\b/g,  'paratha')
    .replace(/\bpuris\b/g,     'puri')
    .replace(/\bnaans\b/g,     'naan')
    .replace(/\bdosas\b/g,     'dosa');

  // Direct override wins
  if (CN_NAME_SIMPLIFY[singularised]) return CN_NAME_SIMPLIFY[singularised];

  // Strip a leading descriptor phrase (one pass)
  let simplified = singularised;
  for (const desc of STRIP_DESCRIPTORS) {
    if (simplified.startsWith(desc + ' ')) {
      simplified = simplified.slice(desc.length + 1).trim();
      break;
    }
  }

  return simplified;
}

export function normaliseIngredientForCN(ingredient: string): string {
  const trimmed = ingredient.trim();

  // ── Path 1: already has explicit grams — simplify name only ─────────────────
  // "80g whole wheat roti" → "80g roti"   "100g homemade paneer" → "100g paneer"
  const gramsMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*g\s+(.+)$/i);
  if (gramsMatch) {
    const grams      = gramsMatch[1];
    const foodDesc   = gramsMatch[2].trim();
    const simplified = simplifyFoodName(foodDesc);
    return simplified !== foodDesc.toLowerCase()
      ? `${grams}g ${simplified}`
      : trimmed;
  }

  // ── Path 2: already has explicit ml — simplify name only ────────────────────
  // "300ml full-fat milk" → "300ml milk"
  const mlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*ml\s+(.+)$/i);
  if (mlMatch) {
    const ml         = mlMatch[1];
    const foodDesc   = mlMatch[2].trim();
    const simplified = simplifyFoodName(foodDesc);
    return simplified !== foodDesc.toLowerCase()
      ? `${ml}ml ${simplified}`
      : trimmed;
  }

  // ── Path 3: count + bracket gram hint ────────────────────────────────────────
  // "2 whole wheat rotis (80g)" → "80g roti"   "3 idlis (40g)" → "120g idli"
  // The bracket weight is ambiguous: per-unit ("1 roti (40g)") or total
  // ("2 eggs (100g)" — the convention in the generation prompt). When the item
  // has a known per-unit weight, whichever reading sits closer wins; otherwise
  // the hint is read as total, matching the prompt convention.
  const countHintMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+?)\s*\((\d+(?:\.\d+)?)g\)$/i);
  if (countHintMatch) {
    const count      = parseFloat(countHintMatch[1]);
    const foodDesc   = countHintMatch[2].trim();
    const hintGrams  = parseFloat(countHintMatch[3]);

    const lowerDesc = foodDesc.toLowerCase();
    const unitKey   = PER_UNIT_GRAM_KEYS.find(k => lowerDesc.includes(k));
    let totalGrams: number;
    if (unitKey) {
      const perUnit = UNIT_GRAM_MAP[unitKey];
      totalGrams = Math.abs(hintGrams - perUnit) < Math.abs(hintGrams - count * perUnit)
        ? Math.round(hintGrams * count)   // hint ≈ one unit → per-unit weight
        : Math.round(hintGrams);          // hint ≈ count × unit → already total
    } else {
      totalGrams = Math.round(hintGrams); // unknown item → prompt convention: total
    }
    const simplified = simplifyFoodName(foodDesc);
    return `${totalGrams}g ${simplified}`;
  }

  // ── Path 4: count + known bread/unit item (no hint) ──────────────────────────
  // "2 rotis" → "80g roti"   "3 whole wheat rotis" → "120g roti"
  const countMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (countMatch) {
    const count    = parseFloat(countMatch[1]);
    const foodDesc = countMatch[2].trim().toLowerCase();
    for (const key of PER_UNIT_GRAM_KEYS) {
      if (foodDesc.includes(key)) {
        const totalGrams = Math.round(count * UNIT_GRAM_MAP[key]);
        const simplified = simplifyFoodName(key);
        return `${totalGrams}g ${simplified}`;
      }
    }
    // Non-bread count (e.g. "2 eggs") — CN handles these fine as-is
    return trimmed;
  }

  // ── Path 5: fallback — return unchanged ─────────────────────────────────────
  return trimmed;
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
