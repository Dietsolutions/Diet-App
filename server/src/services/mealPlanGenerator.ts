import prisma from '../lib/prisma';
import { getMealMacrosFromCalorieNinjas } from './calorieNinjasService';
import { callLLM } from './llmClient';
import {
  computeDeviation,
  computeProportionalScaleFactor,
  applyScaleToIngredients,
  normaliseIngredientsForCN,
  checkMealAgainstTarget,
  getMealMacroTargets,
  buildMealCorrectionPrompt,
  normaliseMealType,
  FailedAttempt,
  MAX_CLAUDE_ATTEMPTS_PER_DAY,
  POST_SCALE_ACCEPT_PCT,
  SCALING_SANITY_MAX_MULTIPLIER,
  CN_FAST_TRACK_THRESHOLD,
} from './macroValidation';

// Use Haiku for speed (3-5x faster than Sonnet for structured JSON)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// Module-level CN toggle — evaluated once at startup
const CN_ENABLED = !!process.env.CALORIE_NINJAS_API_KEY;

// Rate limit: 3 calls per user per day (in-memory, dev/legacy guard)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

// Monthly regeneration limit: 2 per calendar month (existing users only)
const MONTHLY_REGEN_LIMIT = 2;

async function checkAndIncrementGenerationLimit(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  resetsOn: string;
}> {
  const now   = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const usage = await prisma.planGenerationUsage.upsert({
    where:  { userId_month: { userId, month } },
    create: { userId, month, count: 0 },
    update: {},
  });

  if (usage.count >= MONTHLY_REGEN_LIMIT) {
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetsOn  = resetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    return { allowed: false, used: usage.count, limit: MONTHLY_REGEN_LIMIT, resetsOn };
  }

  await prisma.planGenerationUsage.update({
    where: { userId_month: { userId, month } },
    data:  { count: { increment: 1 } },
  });

  return { allowed: true, used: usage.count + 1, limit: MONTHLY_REGEN_LIMIT, resetsOn: '' };
}

// ── Log data collected by each validateAndFinaliseMeal call ──────────────────
interface MealLogData {
  // CN initial call
  cnQueryString:          string;
  cnSuccess:              boolean;
  cnStatusCode?:          number;
  cnCalories?:            number;
  cnProtein?:             number;
  cnCarbs?:               number;
  cnFat?:                 number;
  cnFibre?:               number;
  cnItemsMatched:         number;
  cnIngredientsSentCount: number;
  // Deviation routing
  initialDeviationAction: string;
  deviationPct:           number;
  deviationAction:        string;
  partialMatchGuard:      boolean;
  // Per-macro deviation detail
  calDeviationPct?:   number;
  protDeviationPct?:  number;
  carbDeviationPct?:  number;
  fatDeviationPct?:   number;
  triggerMacro?:      string;
  // Scaling
  scalingApplied:         boolean;
  scaleFactor?:           number;
  postScaleCnCalories?:   number;
  postScaleDeviation?:    number;
  scalingResolved?:       boolean;
  scalingSanityFailed?:   boolean;
  // Scale factor components (weighted blend)
  calScaleFactor?:     number;
  protScaleFactor?:    number;
  carbScaleFactor?:    number;
  blendedScaleFactor?: number;
  // Meal target check
  mealTargetCalories:     number;
  mealTargetCheckPassed:  boolean;
  mealTargetDeviationPct: number;
  // Attempt counter SNAPSHOT at START of this meal's processing
  attemptsUsedAtThisMeal: number;
  // Number of CN-check rounds this meal went through (1+ when the main loop ran).
  iteration:        number;
  // True iff getMealMacrosFromCalorieNinjas was called at least once for this meal.
  cnAttempted:      boolean;
  // Final state
  finalCalories:   number;
  finalProtein:    number;
  finalCarbs:      number;
  finalFat:        number;
  finalFibre:      number;
  finalOutcome:    string;
  withinTolerance: boolean;
  // Plan-level slot fast-track — only set when finalOutcome = 'cn_plan_fast_track'
  cnSlotFailCountAtSkip?: number;
  // Correction data — populated whenever at least one Claude regeneration fired
  correctionTriggered?:    boolean;
  correctionReason?:       string;
  correctedMealName?:      string;
  correctedCalories?:      number;
  correctedProtein?:       number;
  correctedCarbs?:         number;
  correctedFat?:           number;
  correctedFibre?:         number;
  recheckCalories?:        number;
  recheckProtein?:         number;
  recheckCarbs?:           number;
  recheckFat?:             number;
  recheckWithinTolerance?: boolean;
}

// ── Day-level budget data annotated onto pending entries after day loop ───────
interface DayBudgetAnnotation {
  dayTotalCalories: number;
  dayTotalProtein:  number;
  dayTotalCarbs:    number;
  dayTotalFat:      number;
  deviationPct:     number;
  isValid:          boolean;
}

// ── Per-meal CN validation — flat while loop, no recursion ───────────────────
async function validateAndFinaliseMeal(params: {
  originalMeal:   any;
  mealIndex:      number;
  mealsPerDay:    number;
  dailyTargets:   { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
  userProfile:    any;
  dayIdx:         number;
  attemptsUsed:   { count: number };
  cnFailureCount: Record<number, number>;
  cnSlotFailures: Record<number, number>;
}): Promise<{ meal: any; outcome: string; logData: MealLogData }> {
  const {
    originalMeal, mealIndex, mealsPerDay, dailyTargets,
    userProfile, dayIdx, attemptsUsed, cnFailureCount, cnSlotFailures,
  } = params;

  const mealTarget             = getMealMacroTargets(dailyTargets, mealsPerDay, originalMeal.type, mealIndex);
  const attemptsAtStart        = attemptsUsed.count;
  const cnIngredientsSentCount = Array.isArray(originalMeal.ingredients)
    ? originalMeal.ingredients.length : 0;

  let currentMeal          = { ...originalMeal };
  let finalOutcome         = 'cn_unavailable';
  let initialAction        = 'cn_unavailable';

  // The first CN result — stored for logging regardless of how many iterations follow
  let cnInitialResult: Awaited<ReturnType<typeof getMealMacrosFromCalorieNinjas>> | null = null;

  let scalingWasApplied    = false;
  let appliedScaleFactor: number | undefined;
  let postScaleCnCalories: number | undefined;
  let postScaleDeviationPct: number | undefined;
  let scalingResolvedFlag: boolean | undefined;
  let scalingSanityFailed  = false;
  // Weighted blend components — set when scaling path is taken
  let logScaleComponents: { calFactor: number; protFactor: number; carbFactor: number; blendedRaw: number } | undefined;
  // Rejection history — accumulated across loop iterations, passed to each correction call
  const previousAttempts: FailedAttempt[] = [];
  // Correction log — records the LAST correction that fired (for DB logging)
  let lastCorrectionReason: string | undefined;
  let lastCorrectedMeal: any | undefined;

  // ── CN not enabled → return Claude estimate with minimal log ─────────────
  if (!CN_ENABLED) {
    const targetCheck = checkMealAgainstTarget(currentMeal.calories, mealTarget);
    return {
      meal:    currentMeal,
      outcome: 'cn_unavailable',
      logData: {
        cnQueryString: '', cnSuccess: false, cnItemsMatched: 0, cnIngredientsSentCount,
        initialDeviationAction: 'cn_unavailable',
        deviationPct: 0, deviationAction: 'cn_unavailable', partialMatchGuard: false,
        scalingApplied: false,
        mealTargetCalories: mealTarget.calories,
        mealTargetCheckPassed: targetCheck.withinTarget,
        mealTargetDeviationPct: targetCheck.deviationFromTarget,
        attemptsUsedAtThisMeal: attemptsAtStart,
        iteration: 1, cnAttempted: false,
        finalCalories: currentMeal.calories, finalProtein: currentMeal.protein ?? 0,
        finalCarbs: currentMeal.carbs ?? 0, finalFat: currentMeal.fat ?? 0,
        finalFibre: currentMeal.fibre ?? 0, finalOutcome: 'cn_unavailable', withinTolerance: false,
      },
    };
  }

  // ── Plan-level slot fast-track check ─────────────────────────────────────
  const planSlotFailCount = cnSlotFailures[mealIndex] ?? 0;
  if (planSlotFailCount >= CN_FAST_TRACK_THRESHOLD) {
    console.log(
      `[CN] Plan-level fast-track Day${dayIdx+1} Meal${mealIndex+1}` +
      ` — slot ${mealIndex} has ${planSlotFailCount} confirmed failures this plan.` +
      ` Accepting Claude estimate without CN call.`,
    );
    const ptc = checkMealAgainstTarget(originalMeal.calories, mealTarget);
    return {
      meal:    { ...originalMeal },
      outcome: 'cn_plan_fast_track',
      logData: {
        cnQueryString: '', cnSuccess: false, cnItemsMatched: 0, cnIngredientsSentCount,
        initialDeviationAction: 'cn_plan_fast_track',
        deviationPct: 0, deviationAction: 'cn_plan_fast_track', partialMatchGuard: false,
        scalingApplied: false,
        mealTargetCalories:     mealTarget.calories,
        mealTargetCheckPassed:  ptc.withinTarget,
        mealTargetDeviationPct: ptc.deviationFromTarget,
        attemptsUsedAtThisMeal: attemptsAtStart,
        iteration: 1, cnAttempted: false,
        finalCalories:  originalMeal.calories,
        finalProtein:   originalMeal.protein  ?? 0,
        finalCarbs:     originalMeal.carbs    ?? 0,
        finalFat:       originalMeal.fat      ?? 0,
        finalFibre:     originalMeal.fibre    ?? 0,
        finalOutcome:   'cn_plan_fast_track',
        withinTolerance: false,
        cnSlotFailCountAtSkip: planSlotFailCount,
      },
    };
  }

  // ── Flat while loop: CN check → route → optionally regenerate and loop ───
  let resolved = false;
  let iterationCount = 0;
  let partialMatchGuardFlag = false;
  while (!resolved) {
    iterationCount++;

    // ── 0. Per-day CN fast-track — skip slots that failed twice within this day ─
    if ((cnFailureCount[mealIndex] ?? 0) >= 2) {
      console.log(
        `[CN] Fast-track Day${dayIdx+1} Meal${mealIndex+1}:` +
        ` ${cnFailureCount[mealIndex]} prior CN failures — accepting Claude estimate`,
      );
      currentMeal  = { ...originalMeal };
      finalOutcome = 'cn_fast_track_failure';
      if (!cnInitialResult) {
        cnInitialResult = { success: false, macros: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 }, queryString: '', itemsMatched: 0 } as any;
        initialAction   = 'cn_fast_track_failure';
      }
      resolved = true;
      break;
    }

    // ── 1. CN call ────────────────────────────────────────────────────────
    const originalIngredients = Array.isArray(currentMeal.ingredients)
      ? currentMeal.ingredients : [];
    const cnIngredients = normaliseIngredientsForCN(
      originalIngredients.length > 0
        ? originalIngredients
        : [currentMeal.description || currentMeal.name],
    );

    if (!cnInitialResult) {
      const changed = originalIngredients.filter((ing: string, i: number) => ing !== cnIngredients[i]);
      if (changed.length > 0) {
        console.log(`[CN Normalise] D${dayIdx+1}M${mealIndex+1} normalised ${changed.length} ingredient(s):`);
        changed.forEach((orig: string) => {
          const idx  = originalIngredients.indexOf(orig);
          console.log(`  "${orig}" → "${cnIngredients[idx]}"`);
        });
      }
    }

    const cnResult = await getMealMacrosFromCalorieNinjas(currentMeal.name, cnIngredients);
    await new Promise(r => setTimeout(r, 50));

    if (!cnInitialResult) cnInitialResult = cnResult;

    const deviation = computeDeviation(
      {
        calories: originalMeal.calories,
        protein:  originalMeal.protein  ?? 0,
        carbs:    originalMeal.carbs    ?? 0,
        fat:      originalMeal.fat      ?? 0,
      },
      {
        calories:     cnResult.macros.calories,
        protein:      cnResult.macros.proteinG  ?? 0,
        carbs:        cnResult.macros.carbsG    ?? 0,
        fat:          cnResult.macros.fatG      ?? 0,
        success:      cnResult.success,
        itemsMatched: cnResult.itemsMatched ?? 0,
      },
    );

    if (initialAction === 'cn_unavailable') initialAction = deviation.action;

    console.log(
      `[CN] Day${dayIdx+1} Meal${mealIndex+1} "${currentMeal.name}"` +
      ` calDev=${Math.round(deviation.calDeviationPct)}%` +
      ` protDev=${Math.round(deviation.protDeviationPct)}%` +
      ` carbDev=${Math.round(deviation.carbDeviationPct)}%` +
      ` trigger=${deviation.triggerMacro} action=${deviation.action}` +
      ` claude=${originalMeal.calories}kcal cn=${Math.round(cnResult.macros.calories)}kcal`,
    );

    // ── 2. Route by deviation action ──────────────────────────────────────
    let needRegeneration = false;

    if (deviation.action === 'cn_failure' || deviation.action === 'partial_match_failure') {
      cnFailureCount[mealIndex] = (cnFailureCount[mealIndex] ?? 0) + 1;
      if (deviation.action === 'partial_match_failure') partialMatchGuardFlag = true;
      currentMeal  = { ...originalMeal };
      finalOutcome = deviation.action;
      resolved     = true;

    } else if (deviation.action === 'accept_cn') {
      currentMeal = {
        ...currentMeal,
        calories: cnResult.macros.calories,
        protein:  cnResult.macros.proteinG,
        carbs:    cnResult.macros.carbsG,
        fat:      cnResult.macros.fatG,
        fibre:    cnResult.macros.fibreG,
      };
      finalOutcome = 'accepted_cn';
      resolved     = true;

    } else if (deviation.action === 'scale') {
      const {
        scaleFactor: sf, calFactor, protFactor, carbFactor, blendedRaw,
      } = computeProportionalScaleFactor(
        {
          calories: originalMeal.calories,
          protein:  originalMeal.protein ?? 0,
          carbs:    originalMeal.carbs   ?? 0,
        },
        {
          calories: cnResult.macros.calories,
          protein:  cnResult.macros.proteinG ?? 0,
          carbs:    cnResult.macros.carbsG   ?? 0,
        },
      );
      const scaledIngredients = applyScaleToIngredients(
        Array.isArray(currentMeal.ingredients) ? currentMeal.ingredients : [],
        sf,
      );
      scalingWasApplied  = true;
      appliedScaleFactor = sf;
      logScaleComponents = { calFactor, protFactor, carbFactor, blendedRaw };

      console.log(
        `[Scale] D${dayIdx+1}M${mealIndex+1} "${currentMeal.name}"` +
        ` calF=${calFactor.toFixed(3)} protF=${protFactor.toFixed(3)} carbF=${carbFactor.toFixed(3)}` +
        ` blend=${blendedRaw.toFixed(3)} → clamped=${sf.toFixed(3)}`,
      );

      const cnRecheck = await getMealMacrosFromCalorieNinjas(
        currentMeal.name,
        scaledIngredients.length > 0 ? scaledIngredients : [currentMeal.name],
      );
      await new Promise(r => setTimeout(r, 50));

      postScaleCnCalories   = cnRecheck.success ? cnRecheck.macros.calories : undefined;
      postScaleDeviationPct = cnRecheck.success
        ? Math.abs(cnRecheck.macros.calories - originalMeal.calories) / Math.max(originalMeal.calories, 1) * 100
        : 999;

      const cnSanityFailed = (postScaleCnCalories ?? 0) > originalMeal.calories * SCALING_SANITY_MAX_MULTIPLIER;

      if (cnSanityFailed) {
        console.warn(
          `[CN] ⚠ Scaling sanity check FAILED Day${dayIdx+1} Meal${mealIndex+1}` +
          ` postScaleCN=${Math.round(postScaleCnCalories ?? 0)} vs original=${originalMeal.calories}` +
          ` — ingredient string corrupted. Accepting Claude estimate.`,
        );
        scalingSanityFailed = true;
        scalingResolvedFlag = false;
        currentMeal         = { ...originalMeal };
        finalOutcome        = 'scaling_sanity_failed';
        resolved            = true;

      } else if (!cnRecheck.success || postScaleDeviationPct > POST_SCALE_ACCEPT_PCT) {
        scalingResolvedFlag = false;
        console.log(
          `[CN] Post-scale dev=${Math.round(postScaleDeviationPct)}% — escalating to regeneration`,
        );
        needRegeneration = true;

      } else {
        scalingResolvedFlag = true;
        currentMeal = {
          ...currentMeal,
          ingredients: scaledIngredients,
          calories:    cnRecheck.macros.calories,
          protein:     cnRecheck.macros.proteinG,
          carbs:       cnRecheck.macros.carbsG,
          fat:         cnRecheck.macros.fatG,
          fibre:       cnRecheck.macros.fibreG,
        };
        finalOutcome = 'accepted_after_scaling';
        resolved     = true;
      }

    } else if (deviation.action === 'regenerate') {
      needRegeneration = true;
    }

    // ── 3. Regeneration ───────────────────────────────────────────────────
    if (needRegeneration && !resolved) {
      previousAttempts.push({
        mealName:     currentMeal.name ?? originalMeal.name,
        claudeCal:    originalMeal.calories,
        cnCal:        Math.round(cnResult.macros.calories),
        deviationPct: deviation.deviationPct,
        triggerMacro: deviation.triggerMacro,
      });

      if (attemptsUsed.count >= MAX_CLAUDE_ATTEMPTS_PER_DAY) {
        console.log(`[CN] Attempts exhausted Day${dayIdx+1} — accepting Claude estimate`);
        currentMeal  = { ...originalMeal };
        finalOutcome = 'attempts_exhausted';
        resolved     = true;
      } else {
        attemptsUsed.count++;
        const attemptNumber = attemptsUsed.count;
        console.log(
          `[CN] Regenerating Day${dayIdx+1} Meal${mealIndex+1}` +
          ` attempt=${attemptNumber}/${MAX_CLAUDE_ATTEMPTS_PER_DAY}` +
          ` trigger=${deviation.triggerMacro}` +
          ` history=${previousAttempts.length - 1} prior failures`,
        );

        const corrReason =
          `trigger=${deviation.triggerMacro} dev=${Math.round(deviation.deviationPct)}%` +
          ` (Claude: ${originalMeal.calories} kcal, CN: ${Math.round(cnResult.macros.calories)} kcal)`;

        const correctionPrompt = buildMealCorrectionPrompt(
          originalMeal,
          mealTarget,
          corrReason,
          userProfile,
          attemptNumber,
          previousAttempts,
        );

        try {
          const corrText = await callLLM(correctionPrompt, { maxTokens: 600 });
          const corrMeal = JSON.parse(corrText.replace(/```json|```/g, '').trim());
          corrMeal.mealIndex = mealIndex;
          corrMeal.type  = normaliseMealType(corrMeal.type, mealIndex, mealsPerDay);

          lastCorrectionReason = corrReason;
          lastCorrectedMeal    = corrMeal;

          currentMeal = corrMeal;

        } catch (err: any) {
          console.error(`[CN] Correction parse failed:`, err.message);
          currentMeal  = { ...originalMeal };
          finalOutcome = 'correction_parse_failed';
          resolved     = true;
        }
      }
    }

    // ── Safety guard — never exceed attempt budget ────────────────────────
    if (!resolved && attemptsUsed.count >= MAX_CLAUDE_ATTEMPTS_PER_DAY) {
      currentMeal  = { ...originalMeal };
      finalOutcome = 'attempts_exhausted';
      resolved     = true;
    }
  } // end while loop

  // ── Increment plan-level slot failure counter for confirmed CN failures ───
  const PLAN_SLOT_FAILURE_OUTCOMES = [
    'cn_failure', 'partial_match_failure', 'scaling_sanity_failed',
    'attempts_exhausted', 'correction_parse_failed', 'cn_fast_track_failure',
  ];
  if (PLAN_SLOT_FAILURE_OUTCOMES.includes(finalOutcome)) {
    cnSlotFailures[mealIndex] = (cnSlotFailures[mealIndex] ?? 0) + 1;
    console.log(
      `[CN] Plan-level slot ${mealIndex} failure count → ${cnSlotFailures[mealIndex]}` +
      ` (fast-track triggers at ${CN_FAST_TRACK_THRESHOLD})`,
    );
  }

  // ── 4. Secondary meal target check — proportional budget scaling only ────
  const preBudgetCheck = checkMealAgainstTarget(currentMeal.calories, mealTarget);
  if (
    !preBudgetCheck.withinTarget &&
    finalOutcome !== 'cn_failure' &&
    finalOutcome !== 'partial_match_failure' &&
    finalOutcome !== 'scaling_sanity_failed' &&
    finalOutcome !== 'cn_fast_track_failure'
  ) {
    const budgetSf        = mealTarget.calories / Math.max(currentMeal.calories, 1);
    const clampedBudgetSf = Math.min(Math.max(budgetSf, 0.75), 1.25);

    if (Math.abs(clampedBudgetSf - 1.0) > 0.05) {
      console.log(
        `[MealTarget] Day${dayIdx+1} Meal${mealIndex+1}` +
        ` final=${currentMeal.calories} target=${mealTarget.calories}` +
        ` off=${preBudgetCheck.deviationFromTarget}% — budget scaling ×${clampedBudgetSf.toFixed(2)}`,
      );
      currentMeal = {
        ...currentMeal,
        ingredients: applyScaleToIngredients(
          Array.isArray(currentMeal.ingredients) ? currentMeal.ingredients : [],
          clampedBudgetSf,
        ),
        calories: Math.round(currentMeal.calories * clampedBudgetSf),
        protein:  Math.round((currentMeal.protein  ?? 0) * clampedBudgetSf * 10) / 10,
        carbs:    Math.round((currentMeal.carbs     ?? 0) * clampedBudgetSf * 10) / 10,
        fat:      Math.round((currentMeal.fat       ?? 0) * clampedBudgetSf * 10) / 10,
        fibre:    Math.round(((currentMeal.fibre    ?? 0) * clampedBudgetSf) * 10) / 10,
      };
    }
  }

  const finalTargetCheck = checkMealAgainstTarget(currentMeal.calories, mealTarget);

  // ── 5. Build log data ──────────────────────────────────────────────────────
  const logData: MealLogData = {
    cnQueryString:          cnInitialResult?.queryString ?? '',
    cnSuccess:              cnInitialResult?.success     ?? false,
    cnStatusCode:           (cnInitialResult as any)?.statusCode,
    cnCalories:             cnInitialResult?.success ? cnInitialResult.macros.calories  : undefined,
    cnProtein:              cnInitialResult?.success ? cnInitialResult.macros.proteinG  : undefined,
    cnCarbs:                cnInitialResult?.success ? cnInitialResult.macros.carbsG    : undefined,
    cnFat:                  cnInitialResult?.success ? cnInitialResult.macros.fatG      : undefined,
    cnFibre:                cnInitialResult?.success ? cnInitialResult.macros.fibreG    : undefined,
    cnItemsMatched:         cnInitialResult?.itemsMatched ?? 0,
    cnIngredientsSentCount,
    initialDeviationAction: initialAction,
    deviationPct:           cnInitialResult?.success
      ? Math.abs(cnInitialResult.macros.calories - originalMeal.calories) / Math.max(originalMeal.calories, 1) * 100
      : 0,
    deviationAction:        finalOutcome === 'accepted_cn' ? 'accept_cn' : initialAction,
    partialMatchGuard:      partialMatchGuardFlag,
    calDeviationPct:        cnInitialResult?.success
      ? Math.abs(cnInitialResult.macros.calories - originalMeal.calories) / Math.max(originalMeal.calories, 1) * 100
      : undefined,
    protDeviationPct:       (cnInitialResult?.success && (originalMeal.protein ?? 0) > 0)
      ? Math.abs((cnInitialResult.macros.proteinG ?? 0) - (originalMeal.protein ?? 0)) / (originalMeal.protein ?? 1) * 100
      : undefined,
    carbDeviationPct:       (cnInitialResult?.success && (originalMeal.carbs ?? 0) > 0)
      ? Math.abs((cnInitialResult.macros.carbsG ?? 0) - (originalMeal.carbs ?? 0)) / (originalMeal.carbs ?? 1) * 100
      : undefined,
    fatDeviationPct:        (cnInitialResult?.success && (originalMeal.fat ?? 0) > 0)
      ? Math.abs((cnInitialResult.macros.fatG ?? 0) - (originalMeal.fat ?? 0)) / (originalMeal.fat ?? 1) * 100
      : undefined,
    scalingApplied:         scalingWasApplied,
    scaleFactor:            appliedScaleFactor,
    postScaleCnCalories,
    postScaleDeviation:     postScaleDeviationPct,
    scalingResolved:        scalingResolvedFlag,
    scalingSanityFailed,
    calScaleFactor:         logScaleComponents?.calFactor,
    protScaleFactor:        logScaleComponents?.protFactor,
    carbScaleFactor:        logScaleComponents?.carbFactor,
    blendedScaleFactor:     logScaleComponents?.blendedRaw,
    correctionTriggered:    previousAttempts.length > 0,
    correctionReason:       lastCorrectionReason,
    correctedMealName:      lastCorrectedMeal?.name,
    correctedCalories:      lastCorrectedMeal?.calories,
    correctedProtein:       lastCorrectedMeal?.protein,
    correctedCarbs:         lastCorrectedMeal?.carbs,
    correctedFat:           lastCorrectedMeal?.fat,
    correctedFibre:         lastCorrectedMeal?.fibre,
    mealTargetCalories:     mealTarget.calories,
    mealTargetCheckPassed:  finalTargetCheck.withinTarget,
    mealTargetDeviationPct: finalTargetCheck.deviationFromTarget,
    attemptsUsedAtThisMeal: attemptsAtStart,
    iteration:              iterationCount,
    cnAttempted:            true,
    finalCalories:  currentMeal.calories,
    finalProtein:   currentMeal.protein  ?? 0,
    finalCarbs:     currentMeal.carbs    ?? 0,
    finalFat:       currentMeal.fat      ?? 0,
    finalFibre:     currentMeal.fibre    ?? 0,
    finalOutcome,
    withinTolerance: finalTargetCheck.withinTarget,
  };

  return { meal: currentMeal, outcome: finalOutcome, logData };
}

export {
  CLAUDE_MODEL,
  CN_ENABLED,
  checkRateLimit,
  checkAndIncrementGenerationLimit,
  validateAndFinaliseMeal,
};

export type { MealLogData, DayBudgetAnnotation };
