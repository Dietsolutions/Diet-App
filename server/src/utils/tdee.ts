export interface TDEEInput {
  weightKg:     number;
  heightCm:     number;
  age:          number;
  gender:       string;
  activityLevel: string;
  dietIntensity: string | null | undefined; // null/undefined for goals that don't need a deficit magnitude
  primaryGoal:  string;
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
};

// Only meaningful for lose_weight and gain_muscle
const INTENSITY_DEFICIT: Record<string, number> = {
  low:      300,
  moderate: 500,
  high:     750,
};

// Protein multipliers (g/kg) for goals that use intensity-based targeting
const INTENSITY_PROTEIN: Record<string, number> = {
  high:     2.2,
  moderate: 2.0,
  low:      1.8,
};

// RDA protein (g/kg) for goals that do NOT use an intensity deficit.
// Based on WHO / ICMR guidelines scaled by activity level.
const RDA_PROTEIN_PER_KG: Record<string, number> = {
  sedentary:         0.8,
  lightly_active:    1.0,
  moderately_active: 1.2,
  very_active:       1.4,
};

// Goals that drive calorie adjustment via dietIntensity
const DEFICIT_GOALS = new Set(['lose_weight', 'gain_muscle']);

// Goals that get a TDEE-maintenance calorie budget (no deficit/surplus)
const MAINTENANCE_GOALS = new Set(['maintain', 'improve_fitness', 'manage_health', 'eat_healthy']);

export function calculateTDEE(input: TDEEInput): NutritionTargets {
  const { weightKg, heightCm, age, gender, activityLevel, dietIntensity, primaryGoal } = input;

  // ── BMR (Mifflin-St Jeor) ──────────────────────────────────────────────────
  const bmr = gender.toLowerCase() === 'female'
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.375;
  const tdee       = Math.round(bmr * multiplier);

  // ── Target calories ────────────────────────────────────────────────────────
  let targetCalories: number;

  if (DEFICIT_GOALS.has(primaryGoal)) {
    // lose_weight / gain_muscle — apply intensity-based deficit or surplus
    const deficit   = INTENSITY_DEFICIT[dietIntensity ?? 'moderate'] ?? 500;
    const adjustment = primaryGoal === 'gain_muscle' ? -deficit : deficit;
    targetCalories  = Math.max(1000, Math.round(tdee - adjustment));
  } else {
    // All other goals → maintenance calories
    // improve_fitness gets a small energy top-up (150 kcal) for training fuel
    const bonus     = primaryGoal === 'improve_fitness' ? 150 : 0;
    targetCalories  = Math.max(1000, Math.round(tdee + bonus));
  }

  // ── Protein target ─────────────────────────────────────────────────────────
  let proteinPerKg: number;

  if (DEFICIT_GOALS.has(primaryGoal)) {
    // Intensity-scaled: higher deficit → higher protein to protect muscle
    proteinPerKg = INTENSITY_PROTEIN[dietIntensity ?? 'moderate'] ?? 2.0;
  } else if (primaryGoal === 'improve_fitness') {
    proteinPerKg = 1.6; // Athletic performance — above RDA
  } else if (primaryGoal === 'manage_health') {
    proteinPerKg = 1.0; // Moderate — condition-appropriate
  } else {
    // maintain or eat_healthy → WHO RDA scaled by activity
    proteinPerKg = RDA_PROTEIN_PER_KG[activityLevel] ?? 0.8;
  }

  const proteinTarget = Math.round(weightKg * proteinPerKg);

  // ── Fat target — 25–30 % of calories ──────────────────────────────────────
  // Generic / health goals use a slightly lower fat % to leave more room for carbs
  const fatPct        = DEFICIT_GOALS.has(primaryGoal) ? 0.27 : 0.28;
  const fatCalories   = targetCalories * fatPct;
  const fatTarget     = Math.round(fatCalories / 9);

  // ── Carb target — remainder, minimum 50 g ─────────────────────────────────
  const proteinCalories   = proteinTarget * 4;
  const remainingCalories = targetCalories - proteinCalories - fatCalories;
  const carbTarget        = Math.max(50, Math.round(remainingCalories / 4));

  // ── Fibre — gender-appropriate RDA ────────────────────────────────────────
  // WHO/ICMR: men 30 g, women 25 g (daily minimum)
  const fibreTarget = gender.toLowerCase() === 'male' ? 30 : 25;

  return { tdee, targetCalories, proteinTarget, fatTarget, carbTarget, fibreTarget };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
