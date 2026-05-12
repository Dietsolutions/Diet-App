import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { calculateBMI, calculateTDEE } from '../utils/tdee';
import { getMealMacrosFromCalorieNinjas } from '../services/calorieNinjasService';
import {
  computeDeviation,
  computeProportionalScaleFactor,
  applyScaleToIngredients,
  checkMealAgainstTarget,
  checkDayBudget,
  getMealMacroTargets,
  buildMealCorrectionPrompt,
  buildDayLevelCorrectionPrompt,
  normaliseMealType,
  CANONICAL_MEAL_TYPES,
  MEAL_WEIGHT_DISTRIBUTIONS,
  MAX_CLAUDE_ATTEMPTS_PER_DAY,
  POST_SCALE_ACCEPT_PCT,
} from '../services/macroValidation';
import { logMealValidation, MealValidationEntry } from '../services/macroValidationLogger';

const router = Router();

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

// ── Log data collected by each top-level validateAndFinaliseMeal call ─────────
interface MealLogData {
  // CN initial call
  cnQueryString:    string;
  cnSuccess:        boolean;
  cnStatusCode?:    number;
  cnCalories?:      number;
  cnProtein?:       number;
  cnCarbs?:         number;
  cnFat?:           number;
  cnFibre?:         number;
  cnItemsMatched:   number;
  // Deviation routing
  deviationPct:     number;
  deviationAction:  string;
  partialMatchGuard: boolean;
  // Scaling
  scalingApplied:   boolean;
  scaleFactor?:     number;
  postScaleCnCalories?: number;
  postScaleDeviation?:  number;
  scalingResolved?:     boolean;
  // Meal target check
  mealTargetCalories:      number;
  mealTargetCheckPassed:   boolean;
  mealTargetDeviationPct:  number;
  // Attempt counter at end of this call
  attemptsUsedAtThisMeal: number;
  // Final state
  finalCalories: number;
  finalProtein:  number;
  finalCarbs:    number;
  finalFat:      number;
  finalFibre:    number;
  finalOutcome:  string;
  withinTolerance: boolean;
}

// ── Per-meal CN validation — full deviation/scaling/attempt-budget flow ────────
async function validateAndFinaliseMeal(params: {
  meal:          any;
  mealIndex:     number;
  mealsPerDay:   number;
  dailyTargets:  { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
  userProfile:   any;
  anthropic:     Anthropic;
  dayIdx:        number;
  mealPlanId:    string;
  userId:        string;
  attemptsUsed:  { count: number };  // shared mutable counter for this day
  _isRecursive?: boolean;            // internal: suppress logging in recursive calls
}): Promise<{ meal: any; outcome: string; logData?: MealLogData }> {
  const {
    meal, mealIndex, mealsPerDay, dailyTargets,
    userProfile, anthropic, dayIdx, attemptsUsed,
    _isRecursive = false,
  } = params;

  const mealTarget = getMealMacroTargets(
    dailyTargets, mealsPerDay, meal.type, mealIndex,
  );

  let currentMeal  = { ...meal };
  let finalOutcome = 'cn_unavailable';

  // ── STEP 1: Initial CN call ───────────────────────────────────────────────
  if (!CN_ENABLED) {
    return { meal: currentMeal, outcome: 'cn_unavailable' };
  }

  const cnInitial = await getMealMacrosFromCalorieNinjas(
    currentMeal.name,
    currentMeal.ingredients || [currentMeal.description || currentMeal.name],
  );
  await new Promise(r => setTimeout(r, 50));

  const deviation = computeDeviation(
    currentMeal.calories,
    cnInitial.macros.calories,
    cnInitial.success,
    cnInitial.itemsMatched ?? 0,
  );

  console.log(
    `[CN] Day ${dayIdx + 1} Meal ${mealIndex + 1} "${currentMeal.name}"` +
    ` | dev=${Math.round(deviation.deviationPct)}%` +
    ` | action=${deviation.action}` +
    ` | claude=${currentMeal.calories} CN=${cnInitial.macros.calories}`,
  );

  // ── Scaling tracking variables ────────────────────────────────────────────
  let scalingWasApplied              = false;
  let appliedScaleFactor: number | undefined;
  let postScaleCnCalories: number | undefined;
  let postScaleDeviationPct: number | undefined;
  let scalingResolvedFlag: boolean | undefined;

  // ── STEP 2: Route by deviation action ────────────────────────────────────
  if (deviation.action === 'cn_failure' || deviation.action === 'partial_match_failure') {
    finalOutcome = deviation.action;
    // Keep Claude estimate — no changes

  } else if (deviation.action === 'accept_cn') {
    // CN confirms Claude — use CN values
    currentMeal = {
      ...currentMeal,
      calories: cnInitial.macros.calories,
      protein:  cnInitial.macros.proteinG,
      carbs:    cnInitial.macros.carbsG,
      fat:      cnInitial.macros.fatG,
      fibre:    cnInitial.macros.fibreG,
    };
    finalOutcome = 'accepted_cn';

  } else if (deviation.action === 'scale') {
    // ── Proportional scaling ──────────────────────────────────────────────
    const scaleFactor = computeProportionalScaleFactor(
      currentMeal.calories,
      cnInitial.macros.calories,
    );
    const scaledIngredients = applyScaleToIngredients(
      currentMeal.ingredients || [],
      scaleFactor,
    );

    scalingWasApplied    = true;
    appliedScaleFactor   = scaleFactor;

    console.log(
      `[CN] Scaling Day ${dayIdx + 1} Meal ${mealIndex + 1} by ${Math.round(scaleFactor * 100)}%`,
    );

    // CN re-check with scaled ingredients
    const cnRecheck = await getMealMacrosFromCalorieNinjas(
      currentMeal.name,
      scaledIngredients.length > 0 ? scaledIngredients : [currentMeal.name],
    );
    await new Promise(r => setTimeout(r, 50));

    const recheckDev = computeDeviation(
      currentMeal.calories,
      cnRecheck.macros.calories,
      cnRecheck.success,
      cnRecheck.itemsMatched ?? 0,
    );

    postScaleCnCalories   = cnRecheck.success ? cnRecheck.macros.calories : undefined;
    postScaleDeviationPct = recheckDev.deviationPct;

    if (!cnRecheck.success || recheckDev.deviationPct > POST_SCALE_ACCEPT_PCT) {
      // Scaling did not resolve — escalate to regeneration
      scalingResolvedFlag = false;
      console.log(
        `[CN] Post-scale dev=${Math.round(recheckDev.deviationPct)}% — escalating to regeneration`,
      );
      deviation.action = 'regenerate';
    } else {
      // Scaling resolved — use scaled values
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
    }
  }

  // ── Regeneration (from >35% deviation OR failed scaling) ─────────────────
  if (deviation.action === 'regenerate') {
    if (attemptsUsed.count >= MAX_CLAUDE_ATTEMPTS_PER_DAY) {
      console.log(
        `[CN] Attempts exhausted for day ${dayIdx + 1} — accepting Claude estimate`,
      );
      finalOutcome = 'attempts_exhausted';
    } else {
      attemptsUsed.count++;
      console.log(
        `[CN] Regenerating Day ${dayIdx + 1} Meal ${mealIndex + 1}` +
        ` (attempt ${attemptsUsed.count}/${MAX_CLAUDE_ATTEMPTS_PER_DAY})`,
      );

      const correctionPrompt = buildMealCorrectionPrompt(
        currentMeal,
        mealTarget,
        `CalorieNinjas found ${Math.round(deviation.deviationPct)}% deviation from Claude estimate` +
        ` (Claude: ${currentMeal.calories} kcal, CN: ${Math.round(cnInitial.macros.calories)} kcal)`,
        userProfile,
      );

      try {
        const corrResp = await anthropic.messages.create({
          model:      CLAUDE_MODEL,
          max_tokens: 600,
          messages:   [{ role: 'user', content: correctionPrompt }],
        });

        const corrText = corrResp.content[0].type === 'text'
          ? corrResp.content[0].text : '';
        const corrMeal = JSON.parse(corrText.replace(/```json|```/g, '').trim());

        // Normalise type on the corrected meal
        corrMeal.type = normaliseMealType(corrMeal.type, mealIndex, mealsPerDay);

        // Re-run full CN validation on the corrected meal (recursive — suppress inner logging)
        const recheckResult = await validateAndFinaliseMeal({
          ...params,
          meal:          corrMeal,
          attemptsUsed,
          _isRecursive:  true,
        });

        currentMeal  = recheckResult.meal;
        finalOutcome = recheckResult.outcome;

      } catch (err: any) {
        console.error(`[CN] Correction parse failed:`, err.message);
        finalOutcome = 'correction_parse_failed';
      }
    }
  }

  // ── STEP 3: Secondary meal target check ──────────────────────────────────
  // Even if CN accepted the meal, ensure it's within ±15% of the weighted
  // meal budget. If not, ask Claude for a better-sized replacement.
  const targetCheck = checkMealAgainstTarget(currentMeal.calories, mealTarget);

  if (!targetCheck.withinTarget && attemptsUsed.count < MAX_CLAUDE_ATTEMPTS_PER_DAY) {
    console.log(
      `[CN] Secondary target check failed — meal ${currentMeal.calories} kcal` +
      ` vs target ${mealTarget.calories} kcal (${targetCheck.deviationFromTarget}% off)`,
    );

    attemptsUsed.count++;

    const targetPrompt = buildMealCorrectionPrompt(
      currentMeal,
      mealTarget,
      `Meal macros (${currentMeal.calories} kcal) are ${targetCheck.deviationFromTarget}%` +
      ` from the ${currentMeal.type} budget target of ${mealTarget.calories} kcal`,
      userProfile,
    );

    try {
      const targetResp = await anthropic.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: 600,
        messages:   [{ role: 'user', content: targetPrompt }],
      });

      const targetText = targetResp.content[0].type === 'text'
        ? targetResp.content[0].text : '';
      const targetMeal = JSON.parse(targetText.replace(/```json|```/g, '').trim());
      targetMeal.type  = normaliseMealType(targetMeal.type, mealIndex, mealsPerDay);

      const finalResult = await validateAndFinaliseMeal({
        ...params,
        meal:          targetMeal,
        attemptsUsed,
        _isRecursive:  true,
      });

      currentMeal  = finalResult.meal;
      finalOutcome = finalResult.outcome;

    } catch (err: any) {
      console.warn(`[CN] Target correction parse failed:`, err.message);
    }
  }

  // ── Build log data (top-level calls only) ────────────────────────────────
  let logData: MealLogData | undefined;
  if (!_isRecursive) {
    const finalTargetCheck = checkMealAgainstTarget(currentMeal.calories, mealTarget);
    logData = {
      cnQueryString:    cnInitial.queryString,
      cnSuccess:        cnInitial.success,
      cnStatusCode:     cnInitial.statusCode,
      cnCalories:       cnInitial.success ? cnInitial.macros.calories  : undefined,
      cnProtein:        cnInitial.success ? cnInitial.macros.proteinG  : undefined,
      cnCarbs:          cnInitial.success ? cnInitial.macros.carbsG    : undefined,
      cnFat:            cnInitial.success ? cnInitial.macros.fatG      : undefined,
      cnFibre:          cnInitial.success ? cnInitial.macros.fibreG    : undefined,
      cnItemsMatched:   cnInitial.itemsMatched ?? 0,
      deviationPct:     deviation.deviationPct,
      deviationAction:  deviation.action,
      partialMatchGuard: deviation.action === 'partial_match_failure',
      scalingApplied:   scalingWasApplied,
      scaleFactor:      appliedScaleFactor,
      postScaleCnCalories,
      postScaleDeviation: postScaleDeviationPct,
      scalingResolved:  scalingResolvedFlag,
      mealTargetCalories:    mealTarget.calories,
      mealTargetCheckPassed: finalTargetCheck.withinTarget,
      mealTargetDeviationPct: finalTargetCheck.deviationFromTarget,
      attemptsUsedAtThisMeal: attemptsUsed.count,
      finalCalories: currentMeal.calories,
      finalProtein:  currentMeal.protein  ?? 0,
      finalCarbs:    currentMeal.carbs    ?? 0,
      finalFat:      currentMeal.fat      ?? 0,
      finalFibre:    currentMeal.fibre    ?? 0,
      finalOutcome,
      withinTolerance:
        finalOutcome === 'accepted_cn' ||
        finalOutcome === 'accepted_after_scaling',
    };
  }

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
// Computes the weighted calorie/macro target for each meal slot and formats it
// as a prompt section so Claude sizes meals correctly rather than using equal splits.
function buildMealTargetsSection(
  dailyTargets: { calories: number; proteinG: number; carbsG: number; fatG: number },
  mealsPerDay:  number,
): string {
  const dist      = MEAL_WEIGHT_DISTRIBUTIONS[mealsPerDay as 3 | 4 | 5];
  const canonical = CANONICAL_MEAL_TYPES[mealsPerDay as 3 | 4 | 5] ?? [];

  if (!dist || canonical.length === 0) {
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

  const lines = canonical.map(typeKey => {
    const weight = dist[typeKey] ?? (1 / mealsPerDay);
    const cal    = Math.round(dailyTargets.calories * weight);
    const prot   = Math.round(dailyTargets.proteinG * weight * 10) / 10;
    const carbs  = Math.round(dailyTargets.carbsG   * weight * 10) / 10;
    const fat    = Math.round(dailyTargets.fatG      * weight * 10) / 10;
    return `  - ${mealLabels[typeKey] ?? typeKey}: ~${cal} kcal · P ${prot}g · C ${carbs}g · F ${fat}g`;
  });

  return `PER-MEAL CALORIE TARGETS (follow these — not equal splits):
${lines.join('\n')}`;
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

  // Monthly limit: only applies to regeneration by users who have completed onboarding.
  // First-time generation (onboardingDone = false) is always allowed.
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env' });
    return;
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    res.status(400).json({ error: 'User profile not found. Complete onboarding first.' });
    return;
  }

  const planDuration: number = (profile as any).planDuration === 14 ? 14 : 7;
  const systemPrompt = planDuration === 14 ? SYSTEM_PROMPT_14 : SYSTEM_PROMPT_7;
  const maxTokens = planDuration === 14 ? 14000 : 8000;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // SSE heartbeat — declared outside try/catch so clearHeartbeat is always in scope.
  // Keeps the Vercel/client SSE connection alive during the long CN pipeline;
  // Vercel drops idle connections after ~25s without data.
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const clearHeartbeat = () => {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  };

  try {
    const client = new Anthropic({ apiKey });

    // ── Compute fresh targets BEFORE building the prompt ──────────────────────
    // This ensures the per-meal targets injected into the Claude prompt are the
    // same numbers used later in the CN validation pipeline.
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

    const stream = client.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    // Stream token count progress to client every ~300 chars
    // Frequent SSE events also keep the connection alive on Vercel
    let tokenCount = 0;
    stream.on('text', (text) => {
      tokenCount += text.length;
      if (tokenCount % 300 < text.length) {
        sendEvent('progress', { step: 'Writing meals...', tokens: tokenCount });
      }
    });

    const message = await stream.finalMessage();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`AI response in ${elapsed}s — stop_reason: ${message.stop_reason}, usage: ${JSON.stringify(message.usage)}`);

    if (message.stop_reason === 'max_tokens') {
      sendEvent('error', { error: 'AI response was too long. Please try again.' });
      res.end();
      return;
    }

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      sendEvent('error', { error: 'AI returned no text response. Please try again.' });
      res.end();
      return;
    }

    try {
      let raw = textBlock.text.trim();
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
      console.error(`JSON parse failed (${textBlock.text.length} chars)`);
      sendEvent('error', { error: 'AI returned malformed data. Please try again.' });
      res.end();
      return;
    }

    // ── Normalise meal type strings immediately after parse ───────────────────
    // Claude may generate "Breakfast", "Lunch", "Morning Snack" etc.
    // Normalise to canonical underscore-separated lowercase before any validation.
    {
      const mealsPerDayInPlan = planData.days?.[0]?.meals?.length ?? profile.mealsPerDay ?? 4;
      planData.days = (planData.days ?? []).map((day: any) => ({
        ...day,
        meals: (day.meals ?? []).map((meal: any, mealIndex: number) => ({
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

    // Calorie check (warning only — pre-verification estimate)
    const avgCalories = planData.weekSummary?.avgCalories || 0;
    if (Math.abs(avgCalories - profile.targetCalories) > 100) {
      console.warn(`AI plan calories (${avgCalories}) differ from target (${profile.targetCalories}) by >100 kcal`);
    }

    // ── MACRO VERIFICATION PIPELINE ──────────────────────────────────────────
    // New flow: per-meal deviation → scale or regenerate → secondary target check
    // → day-level ±15% budget check → replace largest meal if needed.
    // Attempt budget: 5 Claude regeneration calls per day (resets per day).
    // Completely skipped when CALORIE_NINJAS_API_KEY is not set.

    // dailyTargets = same fresh values computed before the prompt was built.
    const dailyTargets = promptDailyTargets;

    let cnChecksTotal      = 0;
    let cnCorrectionsTotal = 0;

    // Pending validation log entries — populated inside the CN block, written after mealPlan.id is available.
    // Hoisted here so TypeScript can see the type at the write site below.
    let pendingLogEntries: Array<{
      dayIdx:   number;
      mealIdx:  number;
      origMeal: any;
      logData:  MealLogData;
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

      // Initialise the pending log buffer for this plan
      pendingLogEntries = [];

      for (let dayIdx = 0; dayIdx < daysToValidate; dayIdx++) {
        const day          = planData.days[dayIdx];
        const attemptsUsed = { count: 0 }; // shared mutable counter for this day

        // ── Step A: Normalise meal types on Claude output ────────────────────
        day.meals = (day.meals as any[]).map((meal: any, i: number) => ({
          ...meal,
          type: normaliseMealType(meal.type, i, mealsPerDay),
        }));

        // ── Step B: Validate each meal ───────────────────────────────────────
        const finalisedMeals: any[] = [];

        for (let mealIdx = 0; mealIdx < (day.meals as any[]).length; mealIdx++) {
          const origMeal = day.meals[mealIdx];
          const result = await validateAndFinaliseMeal({
            meal:         origMeal,
            mealIndex:    mealIdx,
            mealsPerDay,
            dailyTargets,
            userProfile:  profile,
            anthropic:    client,
            dayIdx,
            mealPlanId:   '__pending__',
            userId,
            attemptsUsed,
          });

          finalisedMeals.push(result.meal);
          cnChecksTotal++;

          if (result.logData) {
            pendingLogEntries.push({ dayIdx, mealIdx, origMeal, logData: result.logData });
          }

          console.log(
            `[MealTarget] Day ${dayIdx + 1} Meal ${mealIdx + 1}` +
            ` type="${result.meal.type}"` +
            ` outcome=${result.outcome}` +
            ` final=${result.meal.calories}kcal`,
          );
        }

        cnCorrectionsTotal += attemptsUsed.count;
        day.meals = finalisedMeals;

        // ── Step C: Day-level budget check ───────────────────────────────────
        const dayBudget = checkDayBudget(day.meals, dailyTargets);

        console.log(
          `[DayBudget] Day ${dayIdx + 1}:` +
          ` total=${dayBudget.dayTotalCalories} kcal` +
          ` target=${dayBudget.targetCalories} kcal` +
          ` dev=${dayBudget.deviationPct}%` +
          ` valid=${dayBudget.isValid}`,
        );

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

              const dayResp = await client.messages.create({
                model:      CLAUDE_MODEL,
                max_tokens: 600,
                messages:   [{ role: 'user', content: dayPrompt }],
              });

              const dayText = dayResp.content[0]?.type === 'text'
                ? dayResp.content[0].text : '';
              const dayMeal = JSON.parse(dayText.replace(/```json|```/g, '').trim());
              dayMeal.type  = normaliseMealType(
                dayMeal.type, dayBudget.largestMealIndex, mealsPerDay,
              );

              // Run full base validation on the day-level replacement
              const dayResult = await validateAndFinaliseMeal({
                meal:         dayMeal,
                mealIndex:    dayBudget.largestMealIndex,
                mealsPerDay,
                dailyTargets,
                userProfile:  profile,
                anthropic:    client,
                dayIdx,
                mealPlanId:   '__pending__',
                userId,
                attemptsUsed,
              });

              day.meals[dayBudget.largestMealIndex] = dayResult.meal;

              // Final re-check
              const finalBudget = checkDayBudget(day.meals, dailyTargets);
              console.log(
                `[DayBudget] Day ${dayIdx + 1} after replacement:` +
                ` total=${finalBudget.dayTotalCalories} valid=${finalBudget.isValid}`,
              );

              if (!finalBudget.isValid) {
                console.log(
                  `[DayBudget] Day ${dayIdx + 1} still unresolved — accepting best result`,
                );
              }

              // Tag the replaced meal's log entry with day-level correction metadata
              if (dayResult.logData) {
                pendingLogEntries.push({
                  dayIdx,
                  mealIdx: dayBudget.largestMealIndex,
                  origMeal: largestMeal,
                  logData:  dayResult.logData,
                  dayLevelExtra: {
                    wasDayLevelReplacement:    true,
                    dayTotalBeforeReplacement: dayBudget.dayTotalCalories,
                    dayTotalAfterReplacement:  finalBudget.dayTotalCalories,
                  },
                });
              }

            } catch (err: any) {
              console.error(`[DayBudget] Day ${dayIdx + 1} replacement failed:`, err.message);
            }
          } else {
            console.log(
              `[DayBudget] Day ${dayIdx + 1} — no attempts left for day-level correction`,
            );
          }
        }

        // Recalculate day totals from finalised meals
        planData.days[dayIdx].meals         = day.meals;
        planData.days[dayIdx].totalCalories = day.meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
        planData.days[dayIdx].totalProtein  = day.meals.reduce((s: number, m: any) => s + (m.protein  || 0), 0);
        planData.days[dayIdx].totalCarbs    = day.meals.reduce((s: number, m: any) => s + (m.carbs    || 0), 0);
        planData.days[dayIdx].totalFat      = day.meals.reduce((s: number, m: any) => s + (m.fat      || 0), 0);
        planData.days[dayIdx].totalFibre    = day.meals.reduce((s: number, m: any) => s + (m.fibre    || 0), 0);
      }

      sendEvent('progress', { step: 'Macro validation complete...' });
      console.log(
        `[CN Summary] ${planDuration}-day plan: ${cnChecksTotal} meal checks,` +
        ` ${cnCorrectionsTotal} Claude regeneration attempts`,
      );

    } else {
      // CalorieNinjas not configured — skip silently, use Claude estimates
      console.log('[Validation] CalorieNinjas not configured — skipping macro verification');
    }
    } catch (cnErr: any) {
      // CN failure must NEVER kill the generation — fall back to Claude's original estimates
      console.error('[CalorieNinjas] Verification pipeline failed — skipping, using Claude estimates:', cnErr.message);
    } finally {
      clearHeartbeat();
    }
    // ── END MACRO VERIFICATION ────────────────────────────────────────────────

    sendEvent('progress', { step: 'Saving your meal plan...' });

    // Deactivate old meal plans
    await prisma.mealPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });

    // weekStartDate = today (the day the plan was generated).
    // Plans start from the actual generation date, not the Monday of the week.
    const weekStartDate = new Date();
    weekStartDate.setHours(0, 0, 0, 0);

    // Create meal plan
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

    // ── Write validation log entries now that mealPlan.id is available ───────
    if (pendingLogEntries && pendingLogEntries.length > 0) {
      const logTimeout = new Promise<void>(resolve => setTimeout(resolve, 8000));
      await Promise.race([
        Promise.allSettled(
          pendingLogEntries.map(({ dayIdx, mealIdx, origMeal, logData, dayLevelExtra }) => {
            const entry: MealValidationEntry = {
              userId,
              mealPlanId:   mealPlan.id,
              planDuration,
              dayIndex:     dayIdx,
              mealIndex:    mealIdx,
              iteration:    0,
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

              finalOutcome: logData.finalOutcome,
              finalMacros:  {
                calories: logData.finalCalories,
                protein:  logData.finalProtein,
                carbs:    logData.finalCarbs,
                fat:      logData.finalFat,
                fibre:    logData.finalFibre,
              },

              // New pipeline fields
              deviationPct:             logData.deviationPct,
              deviationAction:          logData.deviationAction,
              partialMatchGuard:        logData.partialMatchGuard,
              scalingApplied:           logData.scalingApplied,
              scaleFactor:              logData.scaleFactor,
              postScaleCnCalories:      logData.postScaleCnCalories,
              postScaleDeviation:       logData.postScaleDeviation,
              scalingResolved:          logData.scalingResolved,
              mealTargetCheckPassed:    logData.mealTargetCheckPassed,
              mealTargetDeviationPct:   logData.mealTargetDeviationPct,
              attemptsUsedAtThisMeal:   logData.attemptsUsedAtThisMeal,
              wasDayLevelReplacement:   dayLevelExtra?.wasDayLevelReplacement   ?? false,
              dayTotalBeforeReplacement: dayLevelExtra?.dayTotalBeforeReplacement,
              dayTotalAfterReplacement:  dayLevelExtra?.dayTotalAfterReplacement,
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

    // Create all days in parallel
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

    // Create shopping list
    const shoppingList = await prisma.generatedShoppingList.create({
      data: {
        userId,
        mealPlanId: mealPlan.id,
        categories: JSON.stringify(planData.shoppingList || []),
        peopleCount: 1
      }
    });

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
