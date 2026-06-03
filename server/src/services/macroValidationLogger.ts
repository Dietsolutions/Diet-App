import prisma from '../lib/prisma';
import { getMealWeightPct } from './macroValidation';

export interface MealValidationEntry {
  userId:        string;
  mealPlanId:    string;
  planDuration:  number;
  dayIndex:      number;
  mealIndex:     number;
  iteration:     number;
  mealsPerDay:   number;
  mealType:      string;   // canonical underscore-separated type name

  claudeMeal: {
    name:        string;
    calories:    number;
    protein:     number;
    carbs:       number;
    fat:         number;
    fibre:       number;
    ingredients: string[];
  };

  cn: {
    queryString:   string;
    success:       boolean;
    statusCode?:   number;
    calories?:     number;
    protein?:      number;
    carbs?:        number;
    fat?:          number;
    fibre?:        number;
    itemsMatched?: number;
  };

  targets: {
    dailyCalories: number;
    dailyProtein:  number;
    dailyCarbs:    number;
    dailyFat:      number;
  };

  withinTolerance: boolean;

  dayTotals?: {
    calories:         number;
    protein:          number;
    carbs:            number;
    fat:              number;
    validationPassed: boolean;
  };

  correction?: {
    triggered:      boolean;
    targetMealType: string;
    reason:         string;
    gapKcal:        number;
    correctedMeal?: {
      name:     string;
      calories: number;
      protein:  number;
      carbs:    number;
      fat:      number;
      fibre:    number;
    };
    recheck?: {
      calories:        number;
      protein:         number;
      carbs:           number;
      fat:             number;
      withinTolerance: boolean;
    };
  };

  // Widened from strict union to include new pipeline outcomes
  finalOutcome: string;

  finalMacros: {
    calories: number;
    protein:  number;
    carbs:    number;
    fat:      number;
    fibre:    number;
  };

  // ── New: deviation routing ─────────────────────────────────────────────
  deviationPct?:          number;   // |CN - Claude| / Claude × 100
  deviationAction?:       string;   // accept_cn | scale | regenerate | cn_failure | partial_match_failure
  partialMatchGuard?:     boolean;  // true if partial match guard triggered

  // ── New: scaling details ───────────────────────────────────────────────
  scalingApplied?:        boolean;
  scaleFactor?:           number;   // e.g. 0.78 = scaled to 78% of original
  postScaleCnCalories?:   number;   // CN result after scaling
  postScaleDeviation?:    number;   // deviation % after scaling
  scalingResolved?:       boolean;  // true = scaling brought it within threshold

  // ── New: secondary meal target check ──────────────────────────────────
  mealTargetCheckPassed?:   boolean;  // final meal within ±15% of weighted meal budget
  mealTargetDeviationPct?:  number;   // how far final result is from meal budget target (%)

  // ── New: attempt tracking ──────────────────────────────────────────────
  attemptsUsedAtThisMeal?:  number;   // value of attempt counter when this meal was processed

  // ── New: day-level correction ──────────────────────────────────────────
  wasDayLevelReplacement?:     boolean;
  dayTotalBeforeReplacement?:  number;  // day calorie total before this replacement
  dayTotalAfterReplacement?:   number;  // day calorie total after replacement

  // ── New: extended pipeline observability ───────────────────────────────
  initialDeviationAction?:  string;   // routing at first CN check, before escalation
  cnIngredientsSentCount?:  number;   // # ingredients in the original CN query
  scalingSanityFailed?:     boolean;  // true = post-scale CN > 3× original Claude estimate
  dayMealCount?:            number;   // total meals in this day

  // ── New: plan-level slot fast-track ────────────────────────────────────
  cnSlotFailCountAtSkip?:   number;   // slot failure count that triggered plan fast-track

  // ── Was CN actually attempted for this meal? ──────────────────────────
  cnAttempted?:             boolean;  // false when CN was skipped (not enabled, fast-track, etc.)

  // ── New: per-macro deviation detail ────────────────────────────────────────
  calDeviationPct?:    number;   // calorie deviation %
  protDeviationPct?:   number;   // protein deviation %
  carbDeviationPct?:   number;   // carb deviation %
  fatDeviationPct?:    number;   // fat deviation % (captured, not used for routing)
  triggerMacro?:       string;   // which macro triggered routing

  // ── New: weighted blend scale factor components ─────────────────────────────
  calScaleFactor?:     number;   // calorie-only scale factor
  protScaleFactor?:    number;   // protein-only scale factor
  carbScaleFactor?:    number;   // carb-only scale factor
  blendedScaleFactor?: number;   // raw blend before clamping
}

export async function logMealValidation(entry: MealValidationEntry): Promise<void> {
  try {
    // Use weighted calorie target per meal type (snack ≠ lunch ≠ dinner).
    const mealCalPct = getMealWeightPct(entry.mealType, entry.mealsPerDay, entry.mealIndex);
    const mealTarget = {
      calories: Math.round(entry.targets.dailyCalories * mealCalPct),
      protein:  entry.targets.dailyProtein / entry.mealsPerDay,
      carbs:    entry.targets.dailyCarbs   / entry.mealsPerDay,
      fat:      entry.targets.dailyFat     / entry.mealsPerDay,
    };

    const delta = entry.cn.success ? {
      calories: (entry.cn.calories ?? 0) - mealTarget.calories,
      protein:  (entry.cn.protein  ?? 0) - mealTarget.protein,
      carbs:    (entry.cn.carbs    ?? 0) - mealTarget.carbs,
      fat:      (entry.cn.fat      ?? 0) - mealTarget.fat,
    } : null;

    const deltaPct = delta && mealTarget.calories > 0 ? {
      calories: ((entry.cn.calories ?? 0) / mealTarget.calories) * 100,
      protein:  mealTarget.protein > 0 ? ((entry.cn.protein ?? 0) / mealTarget.protein) * 100 : null,
      carbs:    mealTarget.carbs   > 0 ? ((entry.cn.carbs   ?? 0) / mealTarget.carbs)   * 100 : null,
      fat:      mealTarget.fat     > 0 ? ((entry.cn.fat     ?? 0) / mealTarget.fat)     * 100 : null,
    } : null;

    const accuracyDeltaKcal = entry.cn.success
      ? entry.finalMacros.calories - entry.claudeMeal.calories
      : null;
    const accuracyDeltaPct = (accuracyDeltaKcal !== null && entry.claudeMeal.calories > 0)
      ? (accuracyDeltaKcal / entry.claudeMeal.calories) * 100
      : null;

    await prisma.macroValidationLog.create({
      data: {
        userId:       entry.userId,
        mealPlanId:   entry.mealPlanId,
        planDuration: entry.planDuration,
        dayIndex:     entry.dayIndex,
        mealIndex:    entry.mealIndex,
        iteration:    entry.iteration,

        claudeMealName:    entry.claudeMeal.name,
        claudeCalories:    entry.claudeMeal.calories,
        claudeProtein:     entry.claudeMeal.protein,
        claudeCarbs:       entry.claudeMeal.carbs,
        claudeFat:         entry.claudeMeal.fat,
        claudeFibre:       entry.claudeMeal.fibre,
        claudeIngredients: JSON.stringify(entry.claudeMeal.ingredients),

        cnQueryString:      entry.cn.queryString,
        cnApiSuccess:       entry.cn.success,
        cnApiStatusCode:    entry.cn.statusCode     ?? null,
        cnReturnedCalories: entry.cn.calories       ?? null,
        cnReturnedProtein:  entry.cn.protein        ?? null,
        cnReturnedCarbs:    entry.cn.carbs          ?? null,
        cnReturnedFat:      entry.cn.fat            ?? null,
        cnReturnedFibre:    entry.cn.fibre          ?? null,
        cnItemsMatched:     entry.cn.itemsMatched   ?? null,

        userTargetCalories: entry.targets.dailyCalories,
        userTargetProtein:  entry.targets.dailyProtein,
        userTargetCarbs:    entry.targets.dailyCarbs,
        userTargetFat:      entry.targets.dailyFat,

        mealTargetCalories: mealTarget.calories,
        mealTargetProtein:  mealTarget.protein,
        mealTargetCarbs:    mealTarget.carbs,
        mealTargetFat:      mealTarget.fat,

        deltaCalories:    delta?.calories    ?? null,
        deltaProtein:     delta?.protein     ?? null,
        deltaCarbs:       delta?.carbs       ?? null,
        deltaFat:         delta?.fat         ?? null,
        deltaPctCalories: deltaPct?.calories ?? null,
        deltaPctProtein:  deltaPct?.protein  ?? null,
        deltaPctCarbs:    deltaPct?.carbs    ?? null,
        deltaPctFat:      deltaPct?.fat      ?? null,

        withinTolerance: entry.withinTolerance,

        dayTotalCnCalories:  entry.dayTotals?.calories        ?? null,
        dayTotalCnProtein:   entry.dayTotals?.protein         ?? null,
        dayTotalCnCarbs:     entry.dayTotals?.carbs           ?? null,
        dayTotalCnFat:       entry.dayTotals?.fat             ?? null,
        dayDeltaCalories:    entry.dayTotals
          ? entry.dayTotals.calories - entry.targets.dailyCalories : null,
        dayDeltaPctCalories: entry.dayTotals && entry.targets.dailyCalories > 0
          ? (entry.dayTotals.calories / entry.targets.dailyCalories) * 100 : null,
        dayValidationPassed: entry.dayTotals?.validationPassed ?? null,

        correctionTriggered:  entry.correction?.triggered      ?? false,
        correctionTargetMeal: entry.correction?.targetMealType ?? null,
        correctionReason:     entry.correction?.reason         ?? null,
        correctionGapKcal:    entry.correction?.gapKcal        ?? null,

        correctedMealName: entry.correction?.correctedMeal?.name     ?? null,
        correctedCalories: entry.correction?.correctedMeal?.calories ?? null,
        correctedProtein:  entry.correction?.correctedMeal?.protein  ?? null,
        correctedCarbs:    entry.correction?.correctedMeal?.carbs    ?? null,
        correctedFat:      entry.correction?.correctedMeal?.fat      ?? null,
        correctedFibre:    entry.correction?.correctedMeal?.fibre    ?? null,

        recheckCalories:        entry.correction?.recheck?.calories        ?? null,
        recheckProtein:         entry.correction?.recheck?.protein         ?? null,
        recheckCarbs:           entry.correction?.recheck?.carbs           ?? null,
        recheckFat:             entry.correction?.recheck?.fat             ?? null,
        recheckWithinTolerance: entry.correction?.recheck?.withinTolerance ?? null,

        finalOutcome:  entry.finalOutcome,
        finalCalories: entry.finalMacros.calories,
        finalProtein:  entry.finalMacros.protein,
        finalCarbs:    entry.finalMacros.carbs,
        finalFat:      entry.finalMacros.fat,
        finalFibre:    entry.finalMacros.fibre,

        accuracyDeltaKcal,
        accuracyDeltaPct,

        // ── New fields ─────────────────────────────────────────────────
        deviationPct:             entry.deviationPct             ?? null,
        deviationAction:          entry.deviationAction          ?? null,
        partialMatchGuard:        entry.partialMatchGuard        ?? false,
        scalingApplied:           entry.scalingApplied           ?? false,
        scaleFactor:              entry.scaleFactor              ?? null,
        postScaleCnCalories:      entry.postScaleCnCalories      ?? null,
        postScaleDeviation:       entry.postScaleDeviation       ?? null,
        scalingResolved:          entry.scalingResolved          ?? null,
        mealTargetCheckPassed:    entry.mealTargetCheckPassed    ?? null,
        mealTargetDeviationPct:   entry.mealTargetDeviationPct   ?? null,
        attemptsUsedAtThisMeal:   entry.attemptsUsedAtThisMeal   ?? null,
        wasDayLevelReplacement:   entry.wasDayLevelReplacement   ?? false,
        dayTotalBeforeReplacement: entry.dayTotalBeforeReplacement ?? null,
        dayTotalAfterReplacement:  entry.dayTotalAfterReplacement  ?? null,

        // ── Extended pipeline observability ────────────────────────────────
        initialDeviationAction: entry.initialDeviationAction ?? null,
        cnIngredientsSentCount: entry.cnIngredientsSentCount ?? null,
        scalingSanityFailed:    entry.scalingSanityFailed    ?? false,
        dayMealCount:           entry.dayMealCount           ?? null,
        // ── Plan-level slot fast-track ──────────────────────────────────────
        cnSlotFailCountAtSkip:  entry.cnSlotFailCountAtSkip  ?? null,
        // ── CN actually attempted? ───────────────────────────────────────────
        cnAttempted:            entry.cnAttempted            ?? false,
        // ── Per-macro deviation detail ────────────────────────────────────────
        calDeviationPct:    entry.calDeviationPct    ?? null,
        protDeviationPct:   entry.protDeviationPct   ?? null,
        carbDeviationPct:   entry.carbDeviationPct   ?? null,
        fatDeviationPct:    entry.fatDeviationPct    ?? null,
        triggerMacro:       entry.triggerMacro       ?? null,
        // ── Weighted blend scale factor components ────────────────────────────
        calScaleFactor:     entry.calScaleFactor     ?? null,
        protScaleFactor:    entry.protScaleFactor    ?? null,
        carbScaleFactor:    entry.carbScaleFactor    ?? null,
        blendedScaleFactor: entry.blendedScaleFactor ?? null,
      }
    });

    console.log(
      `[ValidationLog] Day ${entry.dayIndex + 1} Meal ${entry.mealIndex + 1}` +
      ` outcome=${entry.finalOutcome}` +
      ` action=${entry.deviationAction ?? 'n/a'}` +
      ` dev=${entry.deviationPct !== undefined ? Math.round(entry.deviationPct) + '%' : 'n/a'}` +
      ` final=${entry.finalMacros.calories}kcal`,
    );
  } catch (err: any) {
    // Logging must NEVER crash plan generation
    console.error('[ValidationLog] Failed to write log entry:', err.message);
  }
}

// ── Batch write — sequentially with 50ms pause to stay gentle on Neon pool ──
export async function batchLogValidation(entries: MealValidationEntry[]): Promise<void> {
  if (entries.length === 0) return;
  let written = 0;
  for (const entry of entries) {
    try {
      await logMealValidation(entry);
      written++;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (err: any) {
      console.error('[BatchLog] Entry failed, continuing:', err.message);
    }
  }
  console.log(`[BatchLog] Wrote ${written}/${entries.length} validation log entries`);
}

export async function getValidationSummaryForPlan(mealPlanId: string) {
  const logs = await prisma.macroValidationLog.findMany({
    where:   { mealPlanId },
    orderBy: [{ dayIndex: 'asc' }, { mealIndex: 'asc' }, { iteration: 'asc' }],
  });

  const totalMeals          = logs.length;
  // Denominator = meals where CN was actually attempted (not fast-tracked or skipped).
  // Numerator stays the same: only rows where CN returned a usable result.
  // Old behaviour: denominator was totalMeals, so fast-tracked rows dragged the rate down.
  const cnAttemptedCount    = logs.filter(l => l.cnAttempted).length;
  const cnSuccess           = logs.filter(l => l.cnApiSuccess).length;
  const acceptedCn          = logs.filter(l => l.finalOutcome === 'accepted_cn').length;
  const acceptedAfterScale  = logs.filter(l => l.finalOutcome === 'accepted_after_scaling').length;
  const scalingApplied      = logs.filter(l => l.scalingApplied).length;
  const regenerated         = logs.filter(l => l.deviationAction === 'regenerate').length;
  const partialMatch        = logs.filter(l => l.partialMatchGuard).length;
  const attemptsExhausted   = logs.filter(l => l.finalOutcome === 'attempts_exhausted').length;
  const scalingSanityFailed = logs.filter(l => l.scalingSanityFailed).length;
  const fastTrackFailures   = logs.filter(l => l.finalOutcome === 'cn_fast_track_failure').length;
  const planFastTrack       = logs.filter(l => l.finalOutcome === 'cn_plan_fast_track').length;
  const dayLevelReplaced    = logs.filter(l => l.wasDayLevelReplacement).length;
  const targetCheckFailed   = logs.filter(l => l.mealTargetCheckPassed === false).length;

  const devPcts = logs
    .filter(l => l.deviationPct !== null)
    .map(l => l.deviationPct!);
  const avgDeviationPct = devPcts.length
    ? devPcts.reduce((s, v) => s + v, 0) / devPcts.length
    : 0;

  const accuracyDeltas = logs
    .filter(l => l.accuracyDeltaKcal !== null)
    .map(l => l.accuracyDeltaKcal!);
  const avgAccuracy = accuracyDeltas.length
    ? accuracyDeltas.reduce((s, v) => s + v, 0) / accuracyDeltas.length
    : 0;

  return {
    mealPlanId,
    totalMeals,
    cnApiSuccessRate:       `${cnSuccess}/${cnAttemptedCount}`,
    acceptedCn,
    acceptedAfterScaling:  acceptedAfterScale,
    scalingApplied,
    regenerated,
    partialMatchFailures:  partialMatch,
    attemptsExhausted,
    scalingSanityFailures: scalingSanityFailed,
    fastTrackFailures,
    planLevelFastTracks:   planFastTrack,
    dayLevelReplacements:  dayLevelReplaced,
    targetCheckFailures:   targetCheckFailed,
    avgDeviationPct:       Math.round(avgDeviationPct * 10) / 10,
    avgAccuracyImprovementKcal: Math.round(avgAccuracy),
  };
}
