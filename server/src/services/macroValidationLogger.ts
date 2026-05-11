import prisma from '../lib/prisma';

export interface MealValidationEntry {
  userId:        string;
  mealPlanId:    string;
  planDuration:  number;
  dayIndex:      number;
  mealIndex:     number;
  iteration:     number;
  mealsPerDay:   number;

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

  finalOutcome: 'passed_first_check' | 'passed_after_correction' | 'max_iterations_reached' | 'cn_unavailable';
  finalMacros: {
    calories: number;
    protein:  number;
    carbs:    number;
    fat:      number;
    fibre:    number;
  };
}

export async function logMealValidation(entry: MealValidationEntry): Promise<void> {
  try {
    const mealTarget = {
      calories: entry.targets.dailyCalories / entry.mealsPerDay,
      protein:  entry.targets.dailyProtein  / entry.mealsPerDay,
      carbs:    entry.targets.dailyCarbs    / entry.mealsPerDay,
      fat:      entry.targets.dailyFat      / entry.mealsPerDay,
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
      }
    });

    console.log(
      `[ValidationLog] Day ${entry.dayIndex + 1} Meal ${entry.mealIndex + 1}` +
      ` iter=${entry.iteration} outcome=${entry.finalOutcome}` +
      ` cnCal=${entry.cn.calories ?? 'N/A'} target=${Math.round(mealTarget.calories)}` +
      ` delta=${delta ? Math.round(delta.calories) : 'N/A'}kcal`
    );
  } catch (err: any) {
    // Logging must NEVER crash plan generation
    console.error('[ValidationLog] Failed to write log entry:', err.message);
  }
}

// ── Batch write — call via setImmediate so it never blocks the response ───────
// Writes all buffered entries sequentially with a 50ms pause between each to
// stay gentle on the Neon connection pool. Any per-entry failure is swallowed
// and logged; the loop always continues to the next entry.
export async function batchLogValidation(entries: MealValidationEntry[]): Promise<void> {
  if (entries.length === 0) return;
  let written = 0;
  for (const entry of entries) {
    try {
      await logMealValidation(entry);
      written++;
      // Small breathing room between DB inserts — keeps Neon pooler happy
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

  const iter0 = logs.filter(l => l.iteration === 0);
  const totalMeals         = iter0.length;
  const cnSuccess          = logs.filter(l => l.cnApiSuccess).length;
  const passedFirstCheck   = iter0.filter(l => l.finalOutcome === 'passed_first_check').length;
  const passedAfterCorrect = iter0.filter(l => l.finalOutcome === 'passed_after_correction').length;
  const maxIterationsHit   = iter0.filter(l => l.finalOutcome === 'max_iterations_reached').length;
  const cnUnavailable      = iter0.filter(l => l.finalOutcome === 'cn_unavailable').length;

  const deltaPcts = iter0.filter(l => l.deltaPctCalories !== null).map(l => l.deltaPctCalories!);
  const avgDeltaPct = deltaPcts.length ? deltaPcts.reduce((s, v) => s + v, 0) / deltaPcts.length : 0;

  const accuracyDeltas = logs.filter(l => l.accuracyDeltaKcal !== null).map(l => l.accuracyDeltaKcal!);
  const avgAccuracy = accuracyDeltas.length ? accuracyDeltas.reduce((s, v) => s + v, 0) / accuracyDeltas.length : 0;

  return {
    mealPlanId,
    totalMeals,
    cnApiSuccessRate:           `${cnSuccess}/${logs.length}`,
    passedFirstCheck:           `${passedFirstCheck}/${totalMeals}`,
    passedAfterCorrection:      passedAfterCorrect,
    maxIterationsHit,
    cnUnavailable,
    avgCalorieDeltaPct:         Math.round(avgDeltaPct * 10) / 10,
    avgAccuracyImprovementKcal: Math.round(avgAccuracy),
  };
}
