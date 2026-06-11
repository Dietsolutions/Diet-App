import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { calculateBMI, calculateTDEE } from '../utils/tdee';
import { getMealMacrosFromCalorieNinjas, normaliseMl } from '../services/calorieNinjasService';
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
import { ingestMeals, type IngestableMeal } from '../services/recipeService';

const router = Router();

// Use Haiku for speed (3-5x faster than Sonnet for structured JSON)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// Module-level CN toggle — evaluated once at startup
const CN_ENABLED = !!process.env.CALORIE_NINJAS_API_KEY;

// Rate limit: 3 calls per user per day (in-memory, dev/legacy guard)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// In-flight generation guard — blocks concurrent duplicate generations for the
// same user (double-click, client retry, duplicate SSE fire). In-memory, so on
// serverless this is best-effort: parallel invocations landing on different
// instances can still slip through, but warm-instance duplicates (the common
// case behind byte-identical twin plans at the same timestamp) are stopped.
const activeGenerations = new Set<string>();

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

// Full CN query preparation: count→gram + name simplification (normaliser),
// then ml→g conversion. CN reads "10ml ghee" as 100g ghee (~900 kcal) — the
// same inflation class as the roti bug, so both steps must run on EVERY CN
// query, including the post-scale recheck.
function prepareCnIngredients(ingredients: string[]): string[] {
  return normaliseIngredientsForCN(ingredients).map(normaliseMl);
}

function getMealTypes(mealsPerDay: number): string[] {
  if (mealsPerDay === 3) return ['Breakfast', 'Lunch', 'Dinner'];
  if (mealsPerDay === 5) return ['Breakfast', 'Mid-Morning Snack', 'Lunch', 'Evening Snack', 'Dinner'];
  return ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
}

// Static system prompt — cacheable across requests
const SYSTEM_PROMPT_7 = `You are a professional nutritionist. Generate a 7-day meal plan as pure JSON.

RULES:
- Respect ALL allergies strictly
- Use preferred ingredients
- Easy meals (<30 min)
- Vary meals across the week
- Day totals within ±50 kcal of target
- Short descriptions with gram quantities (e.g. "Sauté 150g chicken, 100g onions, serve with 80g rice")
- ONLY valid JSON, no markdown

INGREDIENT QUANTITIES — MANDATORY:
- EVERY item in the ingredients array MUST include a numeric quantity — no bare names like "turmeric" or "oil"
- Proteins: 80–200g · Grains (raw): 60–100g · Vegetables: 50–150g · Legumes (raw): 60–80g
- Oils and ghee: use grams, never ml (e.g. "10g ghee", "8g oil")
- Spice reference — use these real-world cooking amounts:
  turmeric 1-2g · red chili powder 2-3g · coriander powder 3-5g · cumin seeds 2-3g
  mustard seeds 3-5g · curry leaves 5g · ginger 5g · garlic 5g
  garam masala 2g · sambar powder 5g · tamarind paste 10g · salt 2g
- Liquids: coconut milk 50-150ml · lemon juice 10ml · water 100-200ml
- Discrete items are fine as count with weight: "2 eggs (100g)" · "1 whole wheat roti (40g)"

JSON STRUCTURE (use exactly this shape):
{"weekSummary":{"avgCalories":0,"avgProtein":0,"avgCarbs":0,"avgFat":0,"avgFibre":0},"days":[{"dayIndex":0,"dayName":"Monday","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFibre":0,"meals":[{"mealIndex":0,"type":"breakfast","time":"8:00 AM","name":"meal name","description":"brief instructions with gram quantities","ingredients":["150g chicken breast","80g onion","1g turmeric","2g red chili powder","3g coriander powder","5g ghee"],"calories":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"shoppingList":[{"category":"Proteins","items":[{"name":"Chicken breast","quantity":"1","unit":"kg"}]}],"mealPrepGuide":{"estimatedMinutes":45,"intro":"Do these tasks on Sunday to set yourself up for the week.","sections":[{"category":"Proteins","emoji":"🥩","tasks":[{"instruction":"Marinate 600g chicken in curd and spices. Use Mon–Wed.","usedOn":"Mon, Tue, Wed"}]}]}}

MEAL TYPE VALUES — use ONLY these exact lowercase strings in the "type" field:
- 3 meals/day: "breakfast", "lunch", "dinner"
- 4 meals/day: "breakfast", "lunch", "snack", "dinner"
- 5 meals/day: "breakfast", "morning_snack", "lunch", "evening_snack", "dinner"
Do NOT use "Breakfast", "Morning Snack", "Snack 1", or any other variant.

Keep descriptions under 20 words. Include mealPrepGuide with practical weekly prep tasks. Be concise.`;

const SYSTEM_PROMPT_14 = `You are a professional nutritionist. Generate a 14-day meal plan as pure JSON.

RULES:
- Respect ALL allergies strictly
- Use preferred ingredients
- Easy meals (<30 min)
- Maximise variety — Week 2 must have completely different meals from Week 1
- Day totals within ±50 kcal of target
- Short descriptions with gram quantities
- ONLY valid JSON, no markdown
- Generate ALL 14 days (dayIndex 0-13)

INGREDIENT QUANTITIES — MANDATORY:
- EVERY item in the ingredients array MUST include a numeric quantity — no bare names like "turmeric" or "oil"
- Proteins: 80–200g · Grains (raw): 60–100g · Vegetables: 50–150g · Legumes (raw): 60–80g
- Oils and ghee: use grams, never ml (e.g. "10g ghee", "8g oil")
- Spice reference — use these real-world cooking amounts:
  turmeric 1-2g · red chili powder 2-3g · coriander powder 3-5g · cumin seeds 2-3g
  mustard seeds 3-5g · curry leaves 5g · ginger 5g · garlic 5g
  garam masala 2g · sambar powder 5g · tamarind paste 10g · salt 2g
- Liquids: coconut milk 50-150ml · lemon juice 10ml · water 100-200ml
- Discrete items are fine as count with weight: "2 eggs (100g)" · "1 whole wheat roti (40g)"

JSON STRUCTURE (same as 7-day but with 14 days in the days array):
{"weekSummary":{"avgCalories":0,"avgProtein":0,"avgCarbs":0,"avgFat":0,"avgFibre":0},"days":[{"dayIndex":0,"dayName":"Day 1","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFibre":0,"meals":[{"mealIndex":0,"type":"breakfast","time":"8:00 AM","name":"meal name","description":"brief instructions","ingredients":["150g chicken breast","80g onion","1g turmeric","2g red chili powder","5g oil"],"calories":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"shoppingList":[{"category":"Proteins","items":[{"name":"Chicken breast","quantity":"1.5","unit":"kg"}]}],"mealPrepGuide":{"estimatedMinutes":60,"intro":"Do these tasks on Sunday to set yourself up for two full weeks.","sections":[{"category":"Proteins","emoji":"🥩","tasks":[{"instruction":"Prep instruction with quantities.","usedOn":"Days 1–5"}]}]}}

MEAL TYPE VALUES — use ONLY these exact lowercase strings in the "type" field:
- 3 meals/day: "breakfast", "lunch", "dinner"
- 4 meals/day: "breakfast", "lunch", "snack", "dinner"
- 5 meals/day: "breakfast", "morning_snack", "lunch", "evening_snack", "dinner"
Do NOT use "Breakfast", "Morning Snack", "Snack 1", or any other variant.

Keep descriptions under 20 words. Be concise.`;

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
  cnIngredientsSentCount: number;   // # ingredients in the original CN query
  // Deviation routing
  initialDeviationAction: string;   // action from FIRST CN check, before any escalation
  deviationPct:           number;
  deviationAction:        string;   // final routing action
  partialMatchGuard:      boolean;
  // Per-macro deviation detail
  calDeviationPct?:   number;
  protDeviationPct?:  number;
  carbDeviationPct?:  number;
  fatDeviationPct?:   number;
  triggerMacro?:      string;   // which macro triggered the routing action
  // Scaling
  scalingApplied:         boolean;
  scaleFactor?:           number;
  postScaleCnCalories?:   number;
  postScaleDeviation?:    number;
  scalingResolved?:       boolean;
  scalingSanityFailed?:   boolean;  // true = post-scale CN > 3× original Claude estimate
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
  // Was hardcoded to 0 in older rows; new writes capture the real count.
  iteration:        number;
  // True iff getMealMacrosFromCalorieNinjas was called at least once for this meal.
  // False only for the three "skipped" paths: CN not enabled, plan-level fast-track,
  // and any pre-loop early return. Used by the summary to compute a real CN attempt rate.
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
// Fix 2: Flat loop eliminates meal-log mismatch (Issue 4) and missing meal
//   index bugs (Issue 5), and makes the attempt counter snapshot reliable.
// Fix 5: cnFailureCount tracks per-meal-index CN failures for fast-tracking.
async function validateAndFinaliseMeal(params: {
  originalMeal:   any;        // Claude's original — never mutated inside
  mealIndex:      number;
  mealsPerDay:    number;
  dailyTargets:   { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
  userProfile:    any;
  dayIdx:         number;
  attemptsUsed:   { count: number };            // shared mutable counter for this day
  cnFailureCount: Record<number, number>;        // shared per-meal-index failure tracker (per-day)
  cnSlotFailures: Record<number, number>;        // plan-level slot failure tracker (persists across days)
}): Promise<{ meal: any; outcome: string; logData: MealLogData }> {
  const {
    originalMeal, mealIndex, mealsPerDay, dailyTargets,
    userProfile, dayIdx, attemptsUsed, cnFailureCount, cnSlotFailures,
  } = params;

  const mealTarget             = getMealMacroTargets(dailyTargets, mealsPerDay, originalMeal.type, mealIndex);
  const attemptsAtStart        = attemptsUsed.count;  // snapshot BEFORE any work on this meal
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
  // Fires BEFORE the while loop so no CN call or attempt budget is consumed.
  // Triggers when this meal slot has accumulated CN_FAST_TRACK_THRESHOLD confirmed
  // failures across ALL previous days of this plan (e.g. fish dinner, Day 3+).
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
  // Track how many CN-check rounds this meal goes through — persisted to the log
  // as `iteration` so the DB row tells you whether this was a 1-shot accept or
  // a 5-round grind. Was previously hardcoded to 0.
  let iterationCount = 0;
  // OR-accumulate partial-match-guard hits across iterations. Was previously
  // read from `initialAction` only, so a partial_match failure that fired
  // AFTER a successful first CN check was silently underreported.
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
        // synthesise minimal result so log fields aren't undefined
        cnInitialResult = { success: false, macros: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 }, queryString: '', itemsMatched: 0 } as any;
        initialAction   = 'cn_fast_track_failure';
      }
      resolved = true;
      break;
    }

    // ── 1. CN call ────────────────────────────────────────────────────────
    // Normalise count-based ingredients (e.g. "2 rotis" → "80g roti") for CN only.
    // The original ingredients array shown in the app is never changed.
    const originalIngredients = Array.isArray(currentMeal.ingredients)
      ? currentMeal.ingredients : [];
    const cnIngredients = prepareCnIngredients(
      originalIngredients.length > 0
        ? originalIngredients
        : [currentMeal.description || currentMeal.name],
    );

    // Log any normalisation changes (once per changed ingredient, first occurrence only)
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

    if (!cnInitialResult) cnInitialResult = cnResult;   // save first result for log

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
      // Track this CN failure for fast-track detection on future iterations
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
      // ── Proportional scaling — weighted blend: cal 50%, prot 35%, carb 15% ──
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
      // Store blend components for logging
      logScaleComponents = { calFactor, protFactor, carbFactor, blendedRaw };

      console.log(
        `[Scale] D${dayIdx+1}M${mealIndex+1} "${currentMeal.name}"` +
        ` calF=${calFactor.toFixed(3)} protF=${protFactor.toFixed(3)} carbF=${carbFactor.toFixed(3)}` +
        ` blend=${blendedRaw.toFixed(3)} → clamped=${sf.toFixed(3)}`,
      );

      // Recheck MUST go through the same normalisation as the initial call —
      // scaled strings still contain count-based items ("2 whole wheat rotis
      // (96g)") that CN mis-reads at default serving weights if sent raw.
      const cnRecheck = await getMealMacrosFromCalorieNinjas(
        currentMeal.name,
        prepareCnIngredients(scaledIngredients.length > 0 ? scaledIngredients : [currentMeal.name]),
      );
      await new Promise(r => setTimeout(r, 50));

      postScaleCnCalories   = cnRecheck.success ? cnRecheck.macros.calories : undefined;
      postScaleDeviationPct = cnRecheck.success
        ? Math.abs(cnRecheck.macros.calories - originalMeal.calories) / Math.max(originalMeal.calories, 1) * 100
        : 999;

      // Sanity check: if post-scale CN is >3× original Claude estimate the
      // ingredient string was corrupted by the scale — accept Claude estimate.
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
      // Record this failed attempt BEFORE the correction call so the next
      // Claude prompt knows exactly what was tried and why it was rejected.
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
          // Inject mealIndex — Claude's correction response does not include it.
          corrMeal.mealIndex = mealIndex;
          corrMeal.type  = normaliseMealType(corrMeal.type, mealIndex, mealsPerDay);

          // Track for logging — last corrected meal overwrites on each iteration
          lastCorrectionReason = corrReason;
          lastCorrectedMeal    = corrMeal;

          // Update currentMeal and loop back — next iteration CN-checks this meal
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
  // These outcomes mean CN cannot validate this food type; future meals at the
  // same slot will fast-track after CN_FAST_TRACK_THRESHOLD failures.
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
  // Pure maths: no Claude call, no CN re-check, just adjust portion toward
  // the weighted meal budget. This replaces the old regeneration-on-miss logic.
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

  // Re-check after budget scaling for log accuracy
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
    // Per-macro deviation detail (from first CN check)
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
    // Weighted blend components
    calScaleFactor:         logScaleComponents?.calFactor,
    protScaleFactor:        logScaleComponents?.protFactor,
    carbScaleFactor:        logScaleComponents?.carbFactor,
    blendedScaleFactor:     logScaleComponents?.blendedRaw,
    // Correction data — only populated when at least one Claude regeneration fired
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
    attemptsUsedAtThisMeal: attemptsAtStart,  // snapshot at START of this meal
    iteration:              iterationCount,
    cnAttempted:            true,  // we reached the main loop, so CN was tried at least once
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

const GOAL_LABELS: Record<string, string> = {
  lose_weight:     'Lose fat (calorie deficit)',
  gain_muscle:     'Gain muscle (calorie surplus)',
  maintain:        'Maintain weight',
  improve_fitness: 'Improve athletic fitness',
  manage_health:   'Manage health condition',
  eat_healthy:     'General healthy eating — balanced nutrition based on daily RDA',
};

function goalLabel(goal: string): string {
  return GOAL_LABELS[goal] ?? goal;
}

// ── Per-meal target section for the Claude prompt ────────────────────────────
// Computes the weighted per-meal macro targets and formats them as a prompt
// section so Claude sizes every meal correctly. Calls getMealMacroTargets so
// both the prompt and the validation pipeline use the same arithmetic.
function buildMealTargetsSection(
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number },
  mealsPerDay:  number,
): string {
  const canonical = CANONICAL_MEAL_TYPES[mealsPerDay as 3 | 4 | 5] ?? [];

  if (canonical.length === 0) {
    const perMeal = Math.round(dailyTargets.calories / mealsPerDay);
    return `Each of the ${mealsPerDay} meals should contain approximately ${perMeal} kcal.`;
  }

  const mealLabels: Record<string, string> = {
    breakfast:     'Breakfast',
    lunch:         'Lunch',
    snack:         'Snack',
    morning_snack: 'Morning snack',
    evening_snack: 'Evening snack',
    dinner:        'Dinner',
  };

  const lines = canonical.map((typeKey, index) => {
    const t = getMealMacroTargets(dailyTargets, mealsPerDay, typeKey, index);
    return (
      `  - ${mealLabels[typeKey] ?? typeKey} (${Math.round(t.weight * 100)}%):` +
      ` ~${t.calories} kcal · Protein ${t.proteinG}g · Carbs ${t.carbsG}g · Fat ${t.fatG}g`
    );
  });

  return (
    `PER-MEAL MACRO TARGETS — follow all four macros precisely, not equal splits:\n` +
    lines.join('\n') + '\n\n' +
    `Daily total: ${dailyTargets.calories} kcal · Protein ${dailyTargets.proteinG}g` +
    ` · Carbs ${dailyTargets.carbsG}g · Fat ${dailyTargets.fatG}g`
  );
}

// ── Lifestyle context block — Group B inputs (not TDEE; passed as Claude guidance) ──
// These inform meal *composition* and *timing* suggestions, not calorie targets.
function buildLifestyleContext(profile: any): string {
  const lines: string[] = [];

  const sleepQuality     = profile.sleepQuality     ?? 'average';
  const stressLevel      = profile.stressLevel      ?? 'medium';
  const recoveryCapacity = profile.recoveryCapacity ?? 'average';
  const hungerLevel      = profile.hungerLevel      ?? 'medium';
  const energyLevel      = profile.energyLevel      ?? 'moderate';
  const trainingType     = profile.trainingType     ?? 'none';
  const steps            = profile.dailySteps       ?? 5000;

  // Only emit the block when there are non-default values worth mentioning
  const hasNonDefault =
    sleepQuality !== 'average' || stressLevel !== 'medium' ||
    recoveryCapacity !== 'average' || hungerLevel !== 'medium' ||
    energyLevel !== 'moderate' || trainingType !== 'none' || steps !== 5000;

  if (!hasNonDefault) return '';

  lines.push('\nLIFESTYLE CONTEXT (use to improve meal composition and timing, not to change calorie targets):');

  if (sleepQuality === 'poor') {
    lines.push('- Sleep: poor — include magnesium-rich foods (nuts, leafy greens, legumes) and minimise high-sugar evening snacks that disrupt sleep.');
  } else if (sleepQuality === 'good') {
    lines.push('- Sleep: good — recovery is well-supported; no sleep-specific adjustments needed.');
  }

  if (stressLevel === 'high') {
    lines.push('- Stress: high — include adaptogens if relevant (ashwagandha in warm milk), B-vitamin-rich foods (whole grains, eggs), and avoid excess caffeine.');
  } else if (stressLevel === 'low') {
    lines.push('- Stress: low — standard meal variety is fine.');
  }

  if (recoveryCapacity === 'poor') {
    lines.push('- Recovery: poor — emphasise anti-inflammatory foods (turmeric, fatty fish, berries, leafy greens) and ensure post-workout protein within 2h.');
  } else if (recoveryCapacity === 'excellent') {
    lines.push('- Recovery: excellent — standard nutrient timing is sufficient.');
  }

  if (hungerLevel === 'high') {
    lines.push('- Hunger: high — include high-volume, high-fibre meals (lentils, vegetables, whole grains) and a protein-rich breakfast to sustain satiety.');
  } else if (hungerLevel === 'low') {
    lines.push('- Hunger: low — keep portions moderate and flavourful; do not force large meals.');
  }

  if (energyLevel === 'low') {
    lines.push('- Energy: low — prioritise slow-digesting complex carbs (oats, brown rice, sweet potato) pre-workout and iron-rich foods (spinach, lentils, tofu) if vegetarian/vegan.');
  } else if (energyLevel === 'high') {
    lines.push('- Energy: high — performance-focused fuelling is appropriate; emphasise pre- and post-workout nutrition.');
  }

  if (trainingType === 'endurance') {
    lines.push(`- Training: endurance, ~${steps.toLocaleString()} steps/day — schedule higher-carb meals on training days; ensure electrolyte-containing foods (banana, coconut water, yogurt).`);
  } else if (trainingType === 'strength') {
    lines.push(`- Training: strength, ~${steps.toLocaleString()} steps/day — post-workout meal must be protein-forward (≥30g) within 90 min; include creatine-friendly foods (red meat or vegetarian alternatives).`);
  } else if (trainingType === 'crossfit') {
    lines.push(`- Training: CrossFit/HIIT, ~${steps.toLocaleString()} steps/day — mix of fast and slow carbs around sessions; adequate protein for muscle repair.`);
  } else if (trainingType !== 'none') {
    lines.push(`- Training: ${trainingType}, ~${steps.toLocaleString()} steps/day — standard nutrient timing applies.`);
  } else if (steps > 8000) {
    lines.push(`- Activity: ~${steps.toLocaleString()} steps/day — schedule energising lunch with complex carbs to sustain afternoon activity.`);
  }

  return lines.join('\n');
}

function buildUserPrompt(
  profile:      any,
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number },
): string {
  const bmi = calculateBMI(profile.weightKg, profile.heightCm);
  const cuisines = JSON.parse(profile.cuisinePreferences);
  const allergies = JSON.parse(profile.allergies);
  const preferred = JSON.parse(profile.preferredIngredients);
  const avoidRaw = JSON.parse(profile.avoidIngredients);
  const avoid = avoidRaw.filter((a: string) => a !== '__none__');
  const health = JSON.parse(profile.healthConditions);
  const equipment = JSON.parse(profile.kitchenEquipment);

  const profileAny = profile as any;
  const mealPref = profile.mealPreference?.toLowerCase() || '';
  const nonVegItems = ['chicken', 'fish', 'tuna', 'prawns', 'mutton'];
  const nonVeganItems = [...nonVegItems, 'eggs', 'paneer', 'whey protein', 'curd/yogurt', 'milk', 'cheese', 'butter', 'ghee', 'buttermilk'];

  let filteredPreferred = preferred;
  if (mealPref === 'vegan') {
    filteredPreferred = preferred.filter((i: string) => !nonVeganItems.some(nv => i.toLowerCase().includes(nv)));
  } else if (mealPref === 'vegetarian') {
    filteredPreferred = preferred.filter((i: string) => !nonVegItems.some(nv => i.toLowerCase().includes(nv)));
  } else if (mealPref === 'eggetarian') {
    filteredPreferred = preferred.filter((i: string) => !nonVegItems.some(nv => i.toLowerCase().includes(nv)));
  } else if (mealPref === 'pescatarian') {
    const landMeat = ['chicken', 'mutton'];
    filteredPreferred = preferred.filter((i: string) => !landMeat.some(nv => i.toLowerCase().includes(nv)));
  }

  const mealTypes = getMealTypes(profile.mealsPerDay);

  const customInstructions = (profile.mealPlanCustomInstructions || '').trim();
  const customBlock = customInstructions ? `

USER CUSTOMISATION INSTRUCTIONS (highest priority — follow these exactly):
"${customInstructions}"

These are specific instructions from the user to modify their meal plan.
Apply these on top of their profile preferences. If an instruction
conflicts with a dietary restriction or allergy, ignore the instruction
and keep the restriction. Otherwise, honour these instructions precisely.` : '';

  const planDays = profileAny.planDuration === 14 ? 14 : 7;
  const dayRange = planDays === 14
    ? 'Generate exactly 14 days (Day 1 through Day 14). Week 2 must use completely different meals from Week 1.'
    : 'Generate exactly 7 days (Monday through Sunday).';

  const lifestyleContext   = buildLifestyleContext(profile);
  const mealTargetsSection = buildMealTargetsSection(dailyTargets, profile.mealsPerDay ?? 4);
  const canonicalTypes     = CANONICAL_MEAL_TYPES[profile.mealsPerDay as 3 | 4 | 5]
    ?? CANONICAL_MEAL_TYPES[4];

  // ── Verification: log proportional per-meal macro targets so we can confirm
  //    protein/carbs/fat are weighted (not equal-split) in Vercel logs.
  {
    const mealsPerDayV = profile.mealsPerDay ?? 4;
    const verifyLines  = canonicalTypes.map((t, i) => {
      const mt = getMealMacroTargets(dailyTargets, mealsPerDayV, t, i);
      return `  ${t}: ${mt.calories}kcal P${mt.proteinG}g C${mt.carbsG}g F${mt.fatG}g (×${(mt.weight * 100).toFixed(0)}%)`;
    });
    console.log('[MealTargets] Per-meal proportional split:\n' + verifyLines.join('\n'));
  }

  return `${dayRange}

Profile: ${profile.name}, ${profile.age}y ${profile.gender}, ${profile.city} ${profile.country}
${profile.weightKg}kg${profile.targetWeightKg != null ? ` → ${profile.targetWeightKg}kg` : ''}, ${profile.heightCm}cm, BMI ${bmi}
Goal: ${goalLabel(profile.primaryGoal)}${profile.dietIntensity ? `, Intensity: ${profile.dietIntensity}` : ''}
Activity: ${profile.activityLevel}, Diet: ${profile.mealPreference}
Cuisines: ${cuisines.join(', ') || 'Any'}
${profile.mealsPerDay} meals/day: ${mealTypes.join(', ')}
Window: ${(profile.eatingWindow === 'intermittent_fasting' || profile.eatingWindow === '16_8' || profile.eatingWindow === '18_6')
    ? `Intermittent Fasting — eating ${profileAny.eatingWindowHours || (profile.eatingWindow === '18_6' ? 6 : 8)}h (${profileAny.eatingStartTime || '07:00'}–${profileAny.eatingEndTime || (profile.eatingWindow === '18_6' ? '13:00' : '15:00')}), fasting ${profileAny.fastingWindowHours || (profile.eatingWindow === '18_6' ? 18 : 16)}h. Schedule all meals within the eating window.`
    : 'Standard (no fasting)'}, Wake: ${profile.wakeUpTime || '07:00'}, Sleep: ${profile.sleepTime || '23:00'}
Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'None'}
Preferred: ${filteredPreferred.length > 0 ? filteredPreferred.join(', ') : 'Any'}
Avoid: ${avoid.length > 0 ? avoid.join(', ') : 'None'}
Health: ${health.length > 0 ? health.join(', ') : 'None'}
Cooking: ${profile.cookingStyle || 'home'}, Equipment: ${equipment.length > 0 ? equipment.join(', ') : 'Stovetop'}
${profile.weeklyBudget ? `Budget: ${profile.budgetCurrency} ${profile.weeklyBudget}/week` : ''}

DAILY NUTRITION TARGETS:
${mealTargetsSection}
Daily total: ${dailyTargets.calories} kcal · P ${dailyTargets.proteinG}g · C ${dailyTargets.carbsG}g · F ${dailyTargets.fatG}g · Fibre ${dailyTargets.fibreG}g

CRITICAL RULES FOR MACRO DISTRIBUTION:
1. Size each meal according to its per-meal target above — NOT as equal splits
2. Snacks must be genuinely light (fruit, nuts, yoghurt, or a small dish ≤ ~${Math.round(dailyTargets.calories * 0.12)} kcal)
3. Lunch and dinner carry the bulk of daily calories and protein
4. The "type" field in your JSON must be EXACTLY one of: ${JSON.stringify(canonicalTypes)}
5. Do not use "Breakfast", "Morning Snack", "Snack 1", or any other variant${lifestyleContext}${customBlock}`;
}

// POST /api/ai/generate-meal-plan (SSE streaming)
router.post('/generate-meal-plan', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: 'Rate limit exceeded. Maximum 3 meal plan generations per day.' });
    return;
  }

  // Reject concurrent duplicates BEFORE the monthly counter increments, so a
  // double-fire doesn't burn the user's quota. Cleanup is on response close,
  // which fires on success, error, and client abort alike.
  if (activeGenerations.has(userId)) {
    res.status(409).json({
      error:   'generation_in_progress',
      message: 'A meal plan generation is already running for your account. Please wait for it to finish.',
    });
    return;
  }
  activeGenerations.add(userId);
  res.once('close', () => activeGenerations.delete(userId));

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

<    // ── Feed validated meals into the recipe library (fire-and-forget) ───────
    // Per-meal finalOutcome from the validation pass gates ingestion: only
    // meals with trustworthy macros enter the library. Never blocks the
    // response — recipe ingestion failures are logged and swallowed.
    {
      const verdictByMeal = new Map<string, string>();
      for (const e of pendingLogEntries ?? []) {
        verdictByMeal.set(`${e.dayIdx}|${e.mealIdx}`, e.logData.finalOutcome);
      }
      const libraryMeals: IngestableMeal[] = [];
      planData.days.forEach((day: any, dayIdx: number) => {
        (day.meals ?? []).forEach((m: any, mealIdx: number) => {
          libraryMeals.push({
            name:         m.name,
            type:         m.type,
            description:  m.description,
            ingredients:  m.ingredients,
            time:         m.time,
            calories:     m.calories,
            protein:      m.protein,
            carbs:        m.carbs,
            fat:          m.fat,
            fibre:        m.fibre,
            prepTime:     m.prepTime,
            finalOutcome: verdictByMeal.get(`${dayIdx}|${mealIdx}`) ?? null,
          });
        });
      });
      ingestMeals(libraryMeals)
        .then(s => console.log(
          `[Recipes] Plan ${mealPlan.id}: ${s.processed} meals → ` +
          `${s.created} new, ${s.merged} merged, ${s.variantsCreated} variants, ${s.filteredOut} filtered`,
        ))
        .catch(err => console.warn('[Recipes] Plan ingest failed:', err?.message));
    }

    // Reset shopping items for the new plan (ticking off old items is irrelevant).
    // IMPORTANT: MealLog, WaterLog, AdditionalMealLog, MealReplacement, WeightLog,
    // and MealCookingInstructions are NEVER deleted — they are permanent user records
    // that must survive plan regeneration so history, streaks, and adherence remain intact.
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
