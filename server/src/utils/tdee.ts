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
  // Group A — TDEE inputs (training detail + NEAT + insulin sensitivity)
  trainingType?:           string | null;  // 'strength' | 'endurance' | 'crossfit' | 'mixed' | 'none'
  trainingDaysPerWeek?:    number | null;
  trainingDurationMins?:   number | null;
  cardioSessionsPerWeek?:  number | null;
  dailySteps?:             number | null;
  occupationType?:         string | null;  // 'desk_job' | 'active_job' | 'manual_labour'
  insulinSensitivity?:     string | null;  // 'good' | 'average' | 'poor'
}

// Full derivation snapshot, captured during calculateTDEE for the audit log.
// Capture only — the math below is unchanged.
export interface TdeeBreakdown {
  inputs: {
    age?: number; sex?: string; heightCm?: number; weightKg?: number;
    bodyFatPct?: number | null; activityLevel?: string; trainingType?: string | null;
    trainingDaysPerWeek?: number | null; dailySteps?: number | null;
    occupationType?: string | null; insulinSensitivity?: string | null;
    goal?: string; dietIntensity?: string | null;
  };
  bmrFormula: string;
  bmrValue: number;
  activityMultiplier: number;
  tdeeBeforeAdjust: number;    // BMR × activity (raw, pre age/health/goal)
  neatAdjustment: number;      // steps + occupation + training kcal adjustments
  goalAdjustment: number;      // deficit/surplus/bonus from the goal
  tdeeAfterAdjust: number;     // targetCalories after all adjustments, pre-floor
  safetyFloorApplied: boolean;
  safetyFloorType: string | null;   // 'calorie_<n>' | 'fat_30g' | null
  finalCalories: number;
  finalProteinG: number;
  finalCarbsG: number;
  finalFatG: number;
  finalFibreG: number;
  proteinBasis: string;        // e.g. '2.2g_per_kg'
  fatBasis: string;            // e.g. '0.8g_per_kg' | '30g_floor'
  carbsBasis: string;          // 'remainder'
  // anything not captured in columns
  ageSlowdownApplied?: boolean;
  healthAdjustments?: string[];
}

export interface NutritionTargets {
  tdee:           number;
  targetCalories: number;
  proteinTarget:  number;
  fatTarget:      number;
  carbTarget:     number;
  fibreTarget:    number;
  breakdown:      TdeeBreakdown;   // full step-by-step derivation for the audit log
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

// Goals that drive calorie adjustment via dietIntensity
const DEFICIT_GOALS = new Set(['lose_weight', 'gain_muscle']);

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
    targetWeightKg, healthConditions,
  } = input;
  const gender = input.gender.toLowerCase();

  // ── Audit capture (does not affect the math below) ────────────────────────
  const _healthAdj: string[] = [];
  const _bd: Partial<TdeeBreakdown> = {
    inputs: {
      age, sex: input.gender, heightCm, weightKg, bodyFatPct: null,
      activityLevel, trainingType: input.trainingType ?? null,
      trainingDaysPerWeek: input.trainingDaysPerWeek ?? null,
      dailySteps: input.dailySteps ?? null,
      occupationType: input.occupationType ?? null,
      insulinSensitivity: input.insulinSensitivity ?? null,
      goal: primaryGoal, dietIntensity: dietIntensity ?? null,
    },
    bmrFormula: 'mifflin_st_jeor',
  };

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

  _bd.bmrValue = Math.round(bmr);

  // ── Step 2: Activity multiplier → TDEE ────────────────────────────────────
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.375;
  let tdee = bmr * multiplier;
  _bd.activityMultiplier = multiplier;
  _bd.tdeeBeforeAdjust = Math.round(bmr * multiplier);

  // ── Step 3: Age-based metabolic slowdown (beyond Mifflin baseline) ────────
  // After 35, add ~1% per decade reduction on top of the formula
  if (age > 35) {
    const decadesOver35 = Math.floor((age - 35) / 10);
    const slowdown = 1 - (decadesOver35 * 0.01);
    tdee = tdee * slowdown;
    _bd.ageSlowdownApplied = decadesOver35 > 0;
  }

  // ── Step 4: Health-condition TDEE adjustments ─────────────────────────────
  if (healthConditions && healthConditions.length > 0) {
    for (const raw of healthConditions) {
      const key = raw.toLowerCase().trim();
      const adj = HEALTH_ADJUSTMENTS[key];
      if (adj) {
        tdee = tdee * (1 + adj);
        _healthAdj.push(`${key}:${adj}`);
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

  // Capture goal calorie delta (vs the activity-adjusted TDEE) for the audit log
  _bd.goalAdjustment = targetCalories - roundedTDEE;
  const _goalTargetCalories = targetCalories;   // baseline before NEAT/occ/training

  // ── Step 6 (A): Protein — protein-first, goal-specific g/kg ─────────────
  // Reference weight = targetWeightKg if set (protein sized for the goal body).
  const referenceWeightKg = (targetWeightKg && targetWeightKg > 20)
    ? targetWeightKg
    : weightKg;

  // Goal-specific protein rates (ISSN Position Stand on protein and exercise)
  const proteinPerKgByGoal: Record<string, number> = {
    lose_weight:     2.2,   // higher during deficit to preserve lean mass
    gain_muscle:     1.7,
    maintain:        1.8,
    improve_fitness: 1.8,
    manage_health:   1.0,
    eat_healthy:     1.6,
  };
  let proteinTarget = Math.round(
    referenceWeightKg * (proteinPerKgByGoal[primaryGoal] ?? 1.8)
  );
  _bd.proteinBasis = `${proteinPerKgByGoal[primaryGoal] ?? 1.8}g_per_kg`;

  // ── Step 7 (B): Fat — goal-specific g/kg, supports hormonal function ─────
  // Not a % of calories — sized to body weight for predictability.
  const fatMultiplierByGoal: Record<string, number> = {
    lose_weight:     0.7,   // reduced but above hormonal floor
    gain_muscle:     0.9,
    maintain:        0.8,
    improve_fitness: 0.8,
    manage_health:   0.8,
    eat_healthy:     0.8,
  };
  let fatTarget = Math.round(
    weightKg * (fatMultiplierByGoal[primaryGoal] ?? 0.8)
  );
  _bd.fatBasis = `${fatMultiplierByGoal[primaryGoal] ?? 0.8}g_per_kg`;
  _bd.carbsBasis = 'remainder';

  // ── Step 8 (C): Carbs — fill remaining calories, min 50g ─────────────────
  let proteinCalories = proteinTarget * 4;
  let fatCalories     = fatTarget * 9;
  let carbKcal        = targetCalories - proteinCalories - fatCalories;
  let carbTarget      = Math.max(50, Math.round(carbKcal / 4));

  // Safety: if carbs < 200 kcal remaining, reduce fat to make room
  if (carbKcal < 200) {
    fatTarget  = Math.max(20, Math.round((targetCalories - proteinCalories - 800) / 9));
    carbTarget = Math.max(50, Math.round((targetCalories - (proteinTarget * 4) - (fatTarget * 9)) / 4));
  }

  // ── Step 8b: Supported TDEE adjustments ──────────────────────────────────
  // Only adjustments with established physiological basis are applied.
  // Behavioural inputs (sleep, stress, recovery, hunger, energy) are NOT
  // applied here — they are passed to the Claude meal plan prompt as context.

  // 1. NEAT — daily steps (Non-Exercise Activity Thermogenesis)
  //    Baseline: 5,000 steps already embedded in the activity multiplier.
  //    Each 1,000 extra steps ≈ +40 kcal; each 1,000 missing ≈ −30 kcal.
  //    Source: established MET-based step-calorie research.
  const steps = input.dailySteps ?? 5000;
  if (steps > 5000) {
    const neatBonus  = Math.round(((steps - 5000) / 1000) * 40);
    targetCalories  += neatBonus;
    carbTarget       = Math.max(50, carbTarget + Math.round(neatBonus / 16));
  } else if (steps < 5000) {
    const neatPenalty = Math.round(((5000 - steps) / 1000) * 30);
    targetCalories   -= neatPenalty;
    carbTarget        = Math.max(50, carbTarget - Math.round(neatPenalty / 16));
  }

  // 2. Occupation type — occupational MET above desk-job baseline
  //    Source: Ainsworth et al. Compendium of Physical Activities (2011)
  const occ = (input.occupationType ?? 'desk_job').toLowerCase();
  if (occ === 'manual_labour') {
    targetCalories += 150;
    carbTarget      = Math.max(50, carbTarget + 50);
  } else if (occ === 'active_job') {
    targetCalories += 75;
    carbTarget      = Math.max(50, carbTarget + 25);
  }

  // 3. Training type — sport-specific macro demands
  //    Source: ISSN Position Stand on macronutrients for performance
  const tType = (input.trainingType ?? 'none').toLowerCase();
  if (tType === 'endurance') {
    carbTarget     = Math.max(50, carbTarget + 75);   // high CHO demand for endurance
    fatTarget      = Math.max(20, fatTarget - 5);
    targetCalories += 200;
  } else if (tType === 'crossfit') {
    carbTarget     = Math.max(50, carbTarget + 40);   // moderate CHO for HIIT
    targetCalories += 100;
  }

  // Training volume adjustment beyond the activity-multiplier baseline
  // Baseline assumed: 3 sessions × 45 min + 0 cardio = 135 min/wk
  const sessionsPerWeek    = input.trainingDaysPerWeek   ?? 3;
  const minsPerSession     = input.trainingDurationMins  ?? 45;
  const cardioPerWeek      = input.cardioSessionsPerWeek ?? 0;
  const actualVolumeMins   = (sessionsPerWeek * minsPerSession) + (cardioPerWeek * 30);
  const baselineVolumeMins = 3 * 45;  // 135 min/wk
  const volumeDeltaMins    = actualVolumeMins - baselineVolumeMins;
  if (Math.abs(volumeDeltaMins) > 45) {
    const volumeCalAdj  = Math.round(volumeDeltaMins * 0.8);
    const volumeCarbAdj = Math.round(volumeCalAdj / 16);
    targetCalories += volumeCalAdj;
    carbTarget = Math.max(50, carbTarget + volumeCarbAdj);
  }

  // 4. Insulin sensitivity — macro redistribution (no net calorie change)
  //    Source: ADA Standards of Medical Care; low-carb intervention studies;
  //            clinical nutrition guidelines for insulin resistance & PCOS.
  const insulin = (input.insulinSensitivity ?? 'average').toLowerCase();
  if (insulin === 'poor') {
    carbTarget    = Math.max(50, carbTarget - 40);  // reduce CHO tolerance
    proteinTarget += 10;
    fatTarget     += 10;
  } else if (insulin === 'good') {
    carbTarget    = Math.max(50, carbTarget + 20);  // higher CHO tolerance
    fatTarget     = Math.max(20, fatTarget - 5);
  }

  // ── Minimum fat floor ─────────────────────────────────────────────────────
  // Indian cooking uses ghee, coconut oil, paneer, dairy; below 30g/day fat
  // is clinically unsafe for hormonal function and nutritionally incompatible
  // with this cuisine style.  Applied AFTER all per-input adjustments so no
  // single pathway can push fat below this level.
  const FAT_FLOOR_GRAMS = 30;
  let _fatFloorApplied = false;
  if (fatTarget < FAT_FLOOR_GRAMS) {
    _fatFloorApplied = true;
    const preFatTarget  = fatTarget;
    fatTarget           = FAT_FLOOR_GRAMS;
    _bd.fatBasis = '30g_floor';
    // Offset the extra fat calories by reducing carbs (keeps total kcal stable)
    const fatKcalAdded  = (FAT_FLOOR_GRAMS - preFatTarget) * 9;
    carbTarget          = Math.max(50, carbTarget - Math.round(fatKcalAdded / 4));
    // fat floor adjustment applied silently
  }

  // Capture pre-floor totals for the audit log
  _bd.tdeeAfterAdjust = Math.round(targetCalories);
  _bd.neatAdjustment = Math.round(targetCalories - _goalTargetCalories);

  // ── Re-apply safety floor + round to nearest 25 after all adjustments ────
  const adjustedFloor = SAFETY_FLOOR[gender] ?? 1200;
  const _calorieFloorApplied = targetCalories < adjustedFloor;
  targetCalories = Math.max(adjustedFloor, targetCalories);
  targetCalories = Math.round(targetCalories / 25) * 25;
  // Priority: a calorie floor is the headline; otherwise note the fat floor.
  _bd.safetyFloorApplied = _calorieFloorApplied || _fatFloorApplied;
  _bd.safetyFloorType = _calorieFloorApplied ? `calorie_${adjustedFloor}`
                       : _fatFloorApplied ? 'fat_30g' : null;

  // ── Step 9: Fibre — gender-appropriate (WHO/ICMR) ─────────────────────────
  const fibreTarget = gender === 'male' ? 30 : 25;

  // ── Finalise the audit breakdown ──────────────────────────────────────────
  _bd.finalCalories = targetCalories;
  _bd.finalProteinG = proteinTarget;
  _bd.finalCarbsG   = carbTarget;
  _bd.finalFatG     = fatTarget;
  _bd.finalFibreG   = fibreTarget;
  _bd.healthAdjustments = _healthAdj;
  const breakdown = _bd as TdeeBreakdown;

  return {
    tdee:           roundedTDEE,
    targetCalories,
    proteinTarget,
    fatTarget,
    carbTarget,
    fibreTarget,
    breakdown,
  };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
