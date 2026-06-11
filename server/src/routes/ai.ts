import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { calculateTDEE } from '../utils/tdee';
import { callLLM } from '../services/llmClient';
import {
  normaliseMealType,
  checkDayBudget,
  getMealMacroTargets,
  buildDayLevelCorrectionPrompt,
  MAX_CLAUDE_ATTEMPTS_PER_DAY,
  CN_FAST_TRACK_THRESHOLD,
} from '../services/macroValidation';
import { logMealValidation, MealValidationEntry } from '../services/macroValidationLogger';
import { perUserLimiter } from '../middleware/perUserLimiter';
import {
  SYSTEM_PROMPT_7,
  SYSTEM_PROMPT_14,
  buildUserPrompt,
} from '../services/promptBuilder';
import {
  CN_ENABLED,
  checkRateLimit,
  checkAndIncrementGenerationLimit,
  MealLogData,
  DayBudgetAnnotation,
  validateAndFinaliseMeal,
  CLAUDE_MODEL,
} from '../services/mealPlanGenerator';

const router = Router();

// POST /api/ai/generate-meal-plan (SSE streaming)
router.post('/generate-meal-plan', requireAuth, perUserLimiter({ windowMs: 60_000, max: 5, keyPrefix: 'ai-generate-meal-plan' }), async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: 'Rate limit exceeded. Maximum 3 meal plan generations per day.' });
    return;
  }

  // Monthly limit: only applies to regeneration by users who have completed onboarding.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingDone: true } });
  if (user?.onboardingDone) {
    const check = await checkAndIncrementGenerationLimit(userId);
    if (!check.allowed) {
      res.status(429).json({
        error:    'monthly_limit_reached',
        message:  `You've used ${check.used} of ${check.limit} plan regenerations this month.`,
        resetsOn: check.resetsOn,
        used:     check.used,
        limit:    check.limit,
      });
      return;
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'No LLM provider configured. Set ANTHROPIC_API_KEY in server/.env' });
    return;
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: 'User profile not found. Complete onboarding first.' });
    return;
  }

  const planDuration: number = (profile as any).planDuration === 14 ? 14 : 7;
  const systemPrompt = planDuration === 14 ? SYSTEM_PROMPT_14 : SYSTEM_PROMPT_7;
  const maxTokens = planDuration === 14 ? 12000 : 8000;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // SSE heartbeat — declared outside try/catch so clearHeartbeat is always in scope.
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const clearHeartbeat = () => {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  };

  try {
    // ── Compute fresh targets BEFORE building the prompt ──────────────────────
    const freshTargets = calculateTDEE({
      weightKg:               profile.weightKg,
      heightCm:               profile.heightCm,
      age:                    profile.age,
      gender:                 profile.gender,
      activityLevel:          profile.activityLevel,
      dietIntensity:          (profile as any).dietIntensity        ?? null,
      primaryGoal:            profile.primaryGoal,
      targetWeightKg:         (profile as any).targetWeightKg       ?? null,
      healthConditions:       JSON.parse((profile as any).healthConditions ?? '[]'),
      eatingWindowHours:      (profile as any).eatingWindowHours    ?? null,
      trainingType:           (profile as any).trainingType          ?? 'none',
      trainingDaysPerWeek:    (profile as any).trainingDaysPerWeek   ?? 3,
      trainingDurationMins:   (profile as any).trainingDurationMins  ?? 45,
      cardioSessionsPerWeek:  (profile as any).cardioSessionsPerWeek ?? 0,
      dailySteps:             (profile as any).dailySteps            ?? 5000,
      occupationType:         (profile as any).occupationType        ?? 'desk_job',
      insulinSensitivity:     (profile as any).insulinSensitivity    ?? 'average',
    });

    const promptDailyTargets = {
      calories: freshTargets.targetCalories,
      proteinG: freshTargets.proteinTarget,
      carbsG:   freshTargets.carbTarget,
      fatG:     freshTargets.fatTarget,
      fibreG:   freshTargets.fibreTarget,
    };

    // Sync profile targets in background — never blocks generation
    prisma.userProfile.update({
      where: { userId },
      data: {
        targetCalories: freshTargets.targetCalories,
        proteinTarget:  freshTargets.proteinTarget,
        carbTarget:     freshTargets.carbTarget,
        fatTarget:      freshTargets.fatTarget,
        fibreTarget:    freshTargets.fibreTarget,
      },
    }).catch((err: any) => console.warn('[TDEE] Profile target sync failed:', err.message));

    const userPrompt = buildUserPrompt(profile, promptDailyTargets);

    const hasCustomInstructions = !!(profile.mealPlanCustomInstructions || '').trim();
    if (hasCustomInstructions) {
      sendEvent('progress', { step: 'Applying your custom preferences...' });
    }
    sendEvent('progress', { step: `Generating your ${planDuration}-day personalised meal plan...` });

    let planData: any = null;
    const startTime = Date.now();

    console.log(`AI generation starting with model ${CLAUDE_MODEL}, planDuration=${planDuration}...`);
    sendEvent('progress', { step: 'Generating plan with AI...', tokens: 0 });

    const aiText = await callLLM(userPrompt, {
      system: systemPrompt,
      maxTokens: maxTokens,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`AI response in ${elapsed}s (${aiText.length} chars)`);

    sendEvent('progress', { step: 'Plan generated, validating macros...', tokens: aiText.length });

    try {
      let raw = aiText.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      }
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        raw = raw.substring(jsonStart, jsonEnd + 1);
      }
      planData = JSON.parse(raw);
    } catch (parseErr) {
      console.error(`JSON parse failed (${aiText.length} chars)`);
      sendEvent('error', { error: 'AI returned malformed data. Please try again.' });
      res.end();
      return;
    }

    // ── Normalise meal type strings immediately after parse ───────────────────
    {
      const mealsPerDayInPlan = planData.days?.[0]?.meals?.length ?? profile.mealsPerDay ?? 4;
      planData.days = (planData.days ?? []).map((day: any) => ({
        ...day,
        meals: (day.meals ?? []).filter((meal: any) => meal != null).map((meal: any, mealIndex: number) => ({
          ...meal,
          type: normaliseMealType(meal.type, mealIndex, mealsPerDayInPlan),
        })),
      }));
      const sample = planData.days[0]?.meals?.map((m: any) => m.type);
      console.log('[Generation] Meal types after normalisation (Day 1):', sample);
    }

    const expectedDays = planDuration;
    if (!planData.days || !Array.isArray(planData.days) || planData.days.length !== expectedDays) {
      console.error(`AI returned ${planData.days?.length} days, expected ${expectedDays}`);
      sendEvent('error', { error: `AI returned an incomplete meal plan (${planData.days?.length}/${expectedDays} days). Please try again.` });
      res.end();
      return;
    }

    const avgCalories = planData.weekSummary?.avgCalories || 0;
    if (Math.abs(avgCalories - profile.targetCalories) > 100) {
      console.warn(`AI plan calories (${avgCalories}) differ from target (${profile.targetCalories}) by >100 kcal`);
    }

    // ── MACRO VERIFICATION PIPELINE ──────────────────────────────────────────
    const dailyTargets = promptDailyTargets;

    let cnChecksTotal      = 0;
    let cnCorrectionsTotal = 0;

    let pendingLogEntries: Array<{
      dayIdx:   number;
      mealIdx:  number;
      origMeal: any;
      logData:  MealLogData;
      dayBudgetResult?: DayBudgetAnnotation;
      dayLevelExtra?: {
        wasDayLevelReplacement:    boolean;
        dayTotalBeforeReplacement: number;
        dayTotalAfterReplacement:  number;
      };
    }> | undefined;

    // Start heartbeat now that we're entering the slow CN verification phase
    heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      }
    }, 10000);

    try {
    if (CN_ENABLED) {
      sendEvent('progress', { step: 'Validating meal macros...' });

      const mealsPerDay   = planData.days[0]?.meals?.length ?? profile.mealsPerDay ?? 4;
      const daysToValidate = planData.days.length;

      console.log(
        `[CN Pipeline] Starting — ${daysToValidate}-day plan,` +
        ` mealsPerDay=${mealsPerDay}, targetCalories=${dailyTargets.calories}`,
      );

      pendingLogEntries = [];

      const cnSlotFailures: Record<number, number> = {};

      for (let dayIdx = 0; dayIdx < daysToValidate; dayIdx++) {
        const day            = planData.days[dayIdx];
        const attemptsUsed   = { count: 0 };
        const cnFailureCount: Record<number, number> = {};

        day.meals = (day.meals as any[]).map((meal: any, i: number) => ({
          ...meal,
          type: normaliseMealType(meal.type, i, mealsPerDay),
        }));

        const finalisedMeals: any[] = [];

        for (let mealIdx = 0; mealIdx < (day.meals as any[]).length; mealIdx++) {
          const origMeal = day.meals[mealIdx];
          const result   = await validateAndFinaliseMeal({
            originalMeal: origMeal,
            mealIndex:    mealIdx,
            mealsPerDay,
            dailyTargets,
            userProfile:  profile,
            dayIdx,
            attemptsUsed,
            cnFailureCount,
            cnSlotFailures,
          });

          finalisedMeals.push(result.meal);
          cnChecksTotal++;
          pendingLogEntries.push({ dayIdx, mealIdx, origMeal, logData: result.logData });

          console.log(
            `[MealTarget] Day${dayIdx+1} Meal${mealIdx+1}` +
            ` type="${result.meal.type}" outcome=${result.outcome}` +
            ` final=${result.meal.calories}kcal`,
          );
        }

        if (finalisedMeals.length !== mealsPerDay) {
          console.error(
            `[Plan] Day${dayIdx+1} has ${finalisedMeals.length} meals,` +
            ` expected ${mealsPerDay}. Filling missing slots with originals.`,
          );
          for (let i = 0; i < mealsPerDay; i++) {
            if (!finalisedMeals[i]) {
              finalisedMeals[i] = day.meals[i];
              console.error(`[Plan] Filled missing slot ${i} with original Claude meal`);
            }
          }
        }

        cnCorrectionsTotal += attemptsUsed.count;
        day.meals = finalisedMeals;

        const dayBudget = checkDayBudget(day.meals, dailyTargets);

        console.log(
          `[DayBudget] Day${dayIdx+1}:` +
          ` total=${dayBudget.dayTotalCalories}` +
          ` target=${dayBudget.targetCalories}` +
          ` dev=${dayBudget.deviationPct}%` +
          ` valid=${dayBudget.isValid}`,
        );

        let finalDayBudget = dayBudget;

        if (!dayBudget.isValid) {
          sendEvent('progress', { step: `Adjusting Day ${dayIdx + 1} calorie budget...` });

          const largestMeal       = day.meals[dayBudget.largestMealIndex];
          const largestMealTarget = getMealMacroTargets(
            dailyTargets, mealsPerDay,
            largestMeal.type, dayBudget.largestMealIndex,
          );

          if (attemptsUsed.count < MAX_CLAUDE_ATTEMPTS_PER_DAY) {
            const dayPrompt = buildDayLevelCorrectionPrompt(
              largestMeal,
              largestMealTarget,
              dayBudget.dayTotalCalories,
              dayBudget.targetCalories,
              profile,
            );

            try {
              attemptsUsed.count++;

              const dayText = await callLLM(dayPrompt, { maxTokens: 600 });
              const dayMeal = JSON.parse(dayText.replace(/```json|```/g, '').trim());
              dayMeal.type  = normaliseMealType(
                dayMeal.type, dayBudget.largestMealIndex, mealsPerDay,
              );

              const dayResult = await validateAndFinaliseMeal({
                originalMeal: dayMeal,
                mealIndex:    dayBudget.largestMealIndex,
                mealsPerDay,
                dailyTargets,
                userProfile:  profile,
                dayIdx,
                attemptsUsed,
                cnFailureCount,
                cnSlotFailures,
              });

              day.meals[dayBudget.largestMealIndex] = dayResult.meal;

              finalDayBudget = checkDayBudget(day.meals, dailyTargets);
              console.log(
                `[DayBudget] Day${dayIdx+1} after replacement:` +
                ` total=${finalDayBudget.dayTotalCalories} valid=${finalDayBudget.isValid}`,
              );
              if (!finalDayBudget.isValid) {
                console.log(`[DayBudget] Day${dayIdx+1} still unresolved — accepting best result`);
              }

              pendingLogEntries.push({
                dayIdx,
                mealIdx:  dayBudget.largestMealIndex,
                origMeal: largestMeal,
                logData:  dayResult.logData,
                dayLevelExtra: {
                  wasDayLevelReplacement:    true,
                  dayTotalBeforeReplacement: dayBudget.dayTotalCalories,
                  dayTotalAfterReplacement:  finalDayBudget.dayTotalCalories,
                },
              });

            } catch (err: any) {
              console.error(`[DayBudget] Day${dayIdx+1} replacement failed:`, err.message);
            }
          } else {
            console.log(`[DayBudget] Day${dayIdx+1} — no attempts left for day-level correction`);
          }
        }

        planData.days[dayIdx].meals         = day.meals;
        planData.days[dayIdx].totalCalories = day.meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
        planData.days[dayIdx].totalProtein  = day.meals.reduce((s: number, m: any) => s + (m.protein  || 0), 0);
        planData.days[dayIdx].totalCarbs    = day.meals.reduce((s: number, m: any) => s + (m.carbs    || 0), 0);
        planData.days[dayIdx].totalFat      = day.meals.reduce((s: number, m: any) => s + (m.fat      || 0), 0);
        planData.days[dayIdx].totalFibre    = day.meals.reduce((s: number, m: any) => s + (m.fibre    || 0), 0);

        const dayAnnotation: DayBudgetAnnotation = {
          dayTotalCalories: planData.days[dayIdx].totalCalories,
          dayTotalProtein:  planData.days[dayIdx].totalProtein,
          dayTotalCarbs:    planData.days[dayIdx].totalCarbs,
          dayTotalFat:      planData.days[dayIdx].totalFat,
          deviationPct:     finalDayBudget.deviationPct,
          isValid:          finalDayBudget.isValid,
        };
        for (const e of pendingLogEntries) {
          if (e.dayIdx === dayIdx && !e.dayBudgetResult) {
            e.dayBudgetResult = dayAnnotation;
          }
        }
      }

      const failedSlots = Object.entries(cnSlotFailures);
      if (failedSlots.length > 0) {
        console.log('[CN] Plan-level slot failure summary:');
        failedSlots.forEach(([slot, count]) => {
          const status = count >= CN_FAST_TRACK_THRESHOLD
            ? `fast-tracked from failure ${CN_FAST_TRACK_THRESHOLD + 1} onwards`
            : `${CN_FAST_TRACK_THRESHOLD - count} more failure(s) before fast-track triggers`;
          console.log(`  Slot ${slot}: ${count} failure(s) — ${status}`);
        });
      } else {
        console.log('[CN] No slot failures recorded — CN validated all meal slots successfully');
      }

      sendEvent('progress', { step: 'Macro validation complete...' });
      console.log(
        `[CN Summary] ${planDuration}-day plan: ${cnChecksTotal} meal checks,` +
        ` ${cnCorrectionsTotal} Claude regeneration attempts`,
      );

    } else {
      console.log('[Validation] CalorieNinjas not configured — skipping macro verification');
    }
    } catch (cnErr: any) {
      console.error('[CalorieNinjas] Verification pipeline failed — skipping, using Claude estimates:', cnErr.message);
    } finally {
      clearHeartbeat();
    }

    sendEvent('progress', { step: 'Saving your meal plan...' });

    await prisma.mealPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });

    const weekStartDate = new Date();
    weekStartDate.setHours(0, 0, 0, 0);

    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId,
        weekStartDate,
        weekSummary: JSON.stringify(planData.weekSummary || {}),
        isActive: true,
        planDuration,
        cnChecks:      cnChecksTotal,
        cnCorrections: cnCorrectionsTotal,
        mealPrepGuide: planData.mealPrepGuide ?? null
      }
    });

    if (pendingLogEntries && pendingLogEntries.length > 0) {
      const logTimeout = new Promise<void>(resolve => setTimeout(resolve, 8000));
      await Promise.race([
        Promise.allSettled(
          pendingLogEntries.map(({ dayIdx, mealIdx, origMeal, logData, dayBudgetResult, dayLevelExtra }) => {
            const entry: MealValidationEntry = {
              userId,
              mealPlanId:   mealPlan.id,
              planDuration,
              dayIndex:     dayIdx,
              mealIndex:    mealIdx,
              iteration:    logData.iteration,
              cnAttempted:  logData.cnAttempted,
              mealsPerDay:  planData.days[0]?.meals?.length ?? 4,
              mealType:     origMeal.type ?? 'unknown',

              claudeMeal: {
                name:        origMeal.name        ?? '',
                calories:    origMeal.calories     ?? 0,
                protein:     origMeal.protein      ?? 0,
                carbs:       origMeal.carbs        ?? 0,
                fat:         origMeal.fat          ?? 0,
                fibre:       origMeal.fibre        ?? 0,
                ingredients: Array.isArray(origMeal.ingredients) ? origMeal.ingredients : [],
              },

              cn: {
                queryString:  logData.cnQueryString,
                success:      logData.cnSuccess,
                statusCode:   logData.cnStatusCode,
                calories:     logData.cnCalories,
                protein:      logData.cnProtein,
                carbs:        logData.cnCarbs,
                fat:          logData.cnFat,
                fibre:        logData.cnFibre,
                itemsMatched: logData.cnItemsMatched,
              },

              targets: {
                dailyCalories: dailyTargets.calories,
                dailyProtein:  dailyTargets.proteinG,
                dailyCarbs:    dailyTargets.carbsG,
                dailyFat:      dailyTargets.fatG,
              },

              withinTolerance: logData.withinTolerance,

              dayTotals: dayBudgetResult ? {
                calories:         dayBudgetResult.dayTotalCalories,
                protein:          dayBudgetResult.dayTotalProtein,
                carbs:            dayBudgetResult.dayTotalCarbs,
                fat:              dayBudgetResult.dayTotalFat,
                validationPassed: dayBudgetResult.isValid,
              } : undefined,

              finalOutcome: logData.finalOutcome,
              finalMacros:  {
                calories: logData.finalCalories,
                protein:  logData.finalProtein,
                carbs:    logData.finalCarbs,
                fat:      logData.finalFat,
                fibre:    logData.finalFibre,
              },

              deviationPct:           logData.deviationPct,
              deviationAction:        logData.deviationAction,
              partialMatchGuard:      logData.partialMatchGuard,
              calDeviationPct:        logData.calDeviationPct,
              protDeviationPct:       logData.protDeviationPct,
              carbDeviationPct:       logData.carbDeviationPct,
              fatDeviationPct:        logData.fatDeviationPct,
              triggerMacro:           logData.triggerMacro,
              scalingApplied:         logData.scalingApplied,
              scaleFactor:            logData.scaleFactor,
              postScaleCnCalories:    logData.postScaleCnCalories,
              postScaleDeviation:     logData.postScaleDeviation,
              scalingResolved:        logData.scalingResolved,
              calScaleFactor:         logData.calScaleFactor,
              protScaleFactor:        logData.protScaleFactor,
              carbScaleFactor:        logData.carbScaleFactor,
              blendedScaleFactor:     logData.blendedScaleFactor,
              mealTargetCheckPassed:  logData.mealTargetCheckPassed,
              mealTargetDeviationPct: logData.mealTargetDeviationPct,
              attemptsUsedAtThisMeal: logData.attemptsUsedAtThisMeal,
              wasDayLevelReplacement:    dayLevelExtra?.wasDayLevelReplacement   ?? false,
              dayTotalBeforeReplacement: dayLevelExtra?.dayTotalBeforeReplacement,
              dayTotalAfterReplacement:  dayLevelExtra?.dayTotalAfterReplacement,
              initialDeviationAction:  logData.initialDeviationAction,
              cnIngredientsSentCount:  logData.cnIngredientsSentCount,
              scalingSanityFailed:     logData.scalingSanityFailed,
              dayMealCount:            planData.days[0]?.meals?.length ?? 4,
              cnSlotFailCountAtSkip:   logData.cnSlotFailCountAtSkip,
              correction: logData.correctionTriggered ? {
                triggered:      true,
                targetMealType: origMeal.type ?? 'unknown',
                reason:         logData.correctionReason ?? '',
                gapKcal:        (logData.correctedCalories ?? 0) - (origMeal.calories ?? 0),
                correctedMeal: logData.correctedMealName ? {
                  name:     logData.correctedMealName,
                  calories: logData.correctedCalories ?? 0,
                  protein:  logData.correctedProtein  ?? 0,
                  carbs:    logData.correctedCarbs    ?? 0,
                  fat:      logData.correctedFat      ?? 0,
                  fibre:    logData.correctedFibre    ?? 0,
                } : undefined,
              } : undefined,
            };
            return logMealValidation(entry);
          })
        ).then((results: PromiseSettledResult<void>[]) => {
          const ok = results.filter(r => r.status === 'fulfilled').length;
          console.log(`[ValidationLog] Wrote ${ok}/${results.length} entries`);
        }),
        logTimeout.then(() => {
          console.warn('[ValidationLog] 8s ceiling hit — some entries may be missing');
        }),
      ]);
    }

    await Promise.all(planData.days.map((dayData: any) =>
      prisma.mealPlanDay.create({
        data: {
          mealPlanId: mealPlan.id,
          dayIndex: dayData.dayIndex,
          dayName: dayData.dayName,
          totalCalories: dayData.totalCalories || 0,
          totalProtein: dayData.totalProtein || 0,
          totalCarbs: dayData.totalCarbs || 0,
          totalFat: dayData.totalFat || 0,
          totalFibre: dayData.totalFibre || 0,
          meals: JSON.stringify(dayData.meals || [])
        }
      })
    ));

    const shoppingList = await prisma.generatedShoppingList.create({
      data: {
        userId,
        mealPlanId: mealPlan.id,
        categories: JSON.stringify(planData.shoppingList || []),
        peopleCount: 1
      }
    });

    await prisma.shoppingItem.deleteMany({ where: { userId } });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Meal plan saved in ${totalTime}s total`);

    sendEvent('done', {
      success:       true,
      mealPlanId:    mealPlan.id,
      shoppingListId: shoppingList.id,
      weekSummary:   planData.weekSummary,
      daysCount:     planData.days.length,
      cnChecks:      cnChecksTotal,
      cnCorrections: cnCorrectionsTotal,
    });
    res.end();
  } catch (err: any) {
    clearHeartbeat();
    console.error('AI generation error:', err?.message || err, err?.status, err?.error);
    let errorMsg = 'Failed to generate meal plan. Please try again.';
    if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
      errorMsg = 'AI generation timed out. Please try again.';
    } else if (err?.status === 402 || err.message?.includes('insufficient_quota') || err.message?.includes('insufficient_credits')) {
      errorMsg = 'Service temporarily unavailable. Please try again later.';
    } else if (err?.status === 401 || err.message?.includes('auth')) {
      errorMsg = 'AI API authentication failed. Check ANTHROPIC_API_KEY.';
    } else if (err?.status === 404 || err.message?.includes('not_found')) {
      errorMsg = `Model "${CLAUDE_MODEL}" not found. Check CLAUDE_MODEL env var.`;
    }
    sendEvent('error', { error: errorMsg });
    res.end();
  }
});

export default router;
