// TDEE & nutrition target calculator — Mifflin-St Jeor with full input set.
// Used by both profile.ts (on save) and ai.ts (fresh recalc at generation time).

export interface TDEEInput {
  weightKg:       number;
  heightCm:       number;
  age:            number;
  gender:         string;
  activityLevel:  string;
  dietIntensity:  string | null | undefined;
  primaryGoal:    string;
  // Extended inputs — all optional; profile fields that improve accuracy
  targetWeightKg?:     number | null;   // use target weight for protein (not current)
  healthConditions?:   string[];        // ['hypothyroid','pcos','diabetes','ibs',…]
  eatingWindowHours?:  number | null;   // IF eating window; purely informational
}

export interface NutritionTargets {
  tdee:           number;
  targetCalories: number;
  proteinTarget:  number;
  fatTarget:      number;
  carbTarget:     number;
  fibreTarget:    number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary:          1.2,
  lightly_active:     1.375,
  moderately_active:  1.55,
  very_active:        1.725,
  extra_active:       1.9,    // physical job + hard daily exercise
};

// Weekly fat-loss / muscle-gain rate → daily kcal adjustment
// 1 kg of body fat ≈ 7,700 kcal; divide by 7 for daily deficit
const INTENSITY_KG_PER_WEEK: Record<string, number> = {
  low:      0.25,   // ~275 kcal/day deficit
  moderate: 0.50,   // ~550 kcal/day deficit
  high:     0.75,   // ~825 kcal/day deficit
};

// Protein multipliers (g/kg body weight)
const INTENSITY_PROTEIN: Record<string, number> = {
  high:     2.2,
  moderate: 2.0,
  low:      1.8,
};

const RDA_PROTEIN_PER_KG: Record<string, number> = {
  sedentary:         0.8,
  lightly_active:    1.0,
  moderately_active: 1.2,
  very_active:       1.4,
  extra_active:      1.6,
};

// Goals that drive calorie adjustment via dietIntensity
const DEFICIT_GOALS = new Set(['lose_weight', 'gain_muscle']);
const MAINTENANCE_GOALS = new Set(['maintain', 'improve_fitness', 'manage_health', 'eat_healthy']);

// Conservative metabolic-effect adjustments per health condition.
// Applied as a multiplier on TDEE (negative = lower effective burn).
const HEALTH_ADJUSTMENTS: Record<string, number> = {
  hypothyroid:  -0.08,   // untreated hypothyroid: ~8% lower BMR
  pcos:         -0.05,   // insulin resistance: modest reduction
  diabetes:     -0.03,   // type 2: modest adjustment
  ibs:           0,      // no direct metabolic effect
};

// Safety floors — never go below these values regardless of deficit
const SAFETY_FLOOR: Record<string, number> = {
  male:   1400,
  female: 1200,
  other:  1300,
};

export function calculateTDEE(input: TDEEInput): NutritionTargets {
  const {
    weightKg, heightCm, age, activityLevel,
    dietIntensity, primaryGoal,
    targetWeightKg, healthConditions, eatingWindowHours,
  } = input;
  const gender = input.gender.toLowerCase();

  // ── Step 1: BMR via Mifflin-St Jeor ────────────────────────────────────────
  let bmr: number;
  if (gender === 'female') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  } else if (gender === 'male') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    // 'other' / 'prefer_not_to_say': average of both
    const m = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    const f = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    bmr = (m + f) / 2;
  }

  // ── Step 2: Activity multiplier → TDEE ────────────────────────────────────
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.375;
  let tdee = bmr * multiplier;

  // ── Step 3: Age-based metabolic slowdown (beyond Mifflin baseline) ────────
  // After 35, add ~1% per decade reduction on top of the formula
  if (age > 35) {
    const decadesOver35 = Math.floor((age - 35) / 10);
    const slowdown = 1 - (decadesOver35 * 0.01);
    tdee = tdee * slowdown;
  }

  // ── Step 4: Health-condition TDEE adjustments ─────────────────────────────
  if (healthConditions && healthConditions.length > 0) {
    for (const raw of healthConditions) {
      const key = raw.toLowerCase().trim();
      const adj = HEALTH_ADJUSTMENTS[key];
      if (adj) {
        tdee = tdee * (1 + adj);
      }
    }
  }

  const roundedTDEE = Math.round(tdee);

  // ── Step 5: Calorie target from goal ──────────────────────────────────────
  let targetCalories: number;

  if (DEFICIT_GOALS.has(primaryGoal)) {
    // Physiology-based deficit: kg/week × 7,700 kcal/kg ÷ 7 days
    const kgPerWeek   = INTENSITY_KG_PER_WEEK[dietIntensity ?? 'moderate'] ?? 0.5;
    const dailyDelta  = Math.round((kgPerWeek * 7700) / 7);

    if (primaryGoal === 'gain_muscle') {
      targetCalories = Math.round(tdee + dailyDelta);
    } else {
      // lose_weight
      targetCalories = Math.round(tdee - dailyDelta);
    }
  } else {
    // Maintenance / improve_fitness / manage_health / eat_healthy
    const bonus = primaryGoal === 'improve_fitness' ? 150 : 0;
    targetCalories = Math.round(tdee + bonus);
  }

  // Round to nearest 50 for cleaner meal planning targets
  targetCalories = Math.round(targetCalories / 50) * 50;

  // Apply safety floor
  const floor = SAFETY_FLOOR[gender] ?? 1200;
  targetCalories = Math.max(floor, targetCalories);

  // ── Step 6: Protein target ────────────────────────────────────────────────
  // Use targetWeightKg (goal body weight) for protein when available:
  // It's more accurate to size protein for the body you're building, not the one you have.
  const referenceWeightKg = (targetWeightKg && targetWeightKg > 20)
    ? targetWeightKg
    : weightKg;

  let proteinPerKg: number;
  if (DEFICIT_GOALS.has(primaryGoal)) {
    proteinPerKg = INTENSITY_PROTEIN[dietIntensity ?? 'moderate'] ?? 2.0;
  } else if (primaryGoal === 'improve_fitness') {
    proteinPerKg = 1.6;
  } else if (primaryGoal === 'manage_health') {
    proteinPerKg = 1.0;
  } else {
    proteinPerKg = RDA_PROTEIN_PER_KG[activityLevel] ?? 0.8;
  }
  const proteinTarget = Math.round(referenceWeightKg * proteinPerKg);

  // ── Step 7: Fat target — 25–30% of calories ───────────────────────────────
  const fatPct       = DEFICIT_GOALS.has(primaryGoal) ? 0.27 : 0.28;
  const fatCalories  = targetCalories * fatPct;
  const fatTarget    = Math.round(fatCalories / 9);

  // ── Step 8: Carb target — remainder, min 50g ──────────────────────────────
  const proteinCalories   = proteinTarget * 4;
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbTarget        = Math.max(50, Math.round(remainingCalories / 4));

  // ── Step 9: Fibre — gender-appropriate (WHO/ICMR) ─────────────────────────
  const fibreTarget = gender === 'male' ? 30 : 25;

  return {
    tdee:           roundedTDEE,
    targetCalories,
    proteinTarget,
    fatTarget,
    carbTarget,
    fibreTarget,
  };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
