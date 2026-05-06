import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { calculateBMI } from '../utils/tdee';
import { verifyDayMacros } from '../services/calorieNinjasService';
import { validateDayMacros, buildCorrectionPrompt } from '../services/macroValidation';

const router = Router();

// Use Haiku for speed (3-5x faster than Sonnet for structured JSON)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

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

JSON STRUCTURE (use exactly this shape):
{"weekSummary":{"avgCalories":0,"avgProtein":0,"avgCarbs":0,"avgFat":0,"avgFibre":0},"days":[{"dayIndex":0,"dayName":"Monday","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFibre":0,"meals":[{"mealIndex":0,"type":"Breakfast","time":"8:00 AM","name":"meal name","description":"brief instructions with gram quantities","ingredients":["150g chicken breast","80g onion"],"calories":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"shoppingList":[{"category":"Proteins","items":[{"name":"Chicken breast","quantity":"1","unit":"kg"}]}],"mealPrepGuide":{"estimatedMinutes":45,"intro":"Do these tasks on Sunday to set yourself up for the week.","sections":[{"category":"Proteins","emoji":"🥩","tasks":[{"instruction":"Marinate 600g chicken in curd and spices. Use Mon–Wed.","usedOn":"Mon, Tue, Wed"}]}]}}

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

JSON STRUCTURE (same as 7-day but with 14 days in the days array):
{"weekSummary":{"avgCalories":0,"avgProtein":0,"avgCarbs":0,"avgFat":0,"avgFibre":0},"days":[{"dayIndex":0,"dayName":"Day 1","totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"totalFibre":0,"meals":[{"mealIndex":0,"type":"Breakfast","time":"8:00 AM","name":"meal name","description":"brief instructions","ingredients":[],"calories":0,"protein":0,"carbs":0,"fat":0,"fibre":0}]}],"shoppingList":[{"category":"Proteins","items":[{"name":"Chicken breast","quantity":"1.5","unit":"kg"}]}],"mealPrepGuide":{"estimatedMinutes":60,"intro":"Do these tasks on Sunday to set yourself up for two full weeks.","sections":[{"category":"Proteins","emoji":"🥩","tasks":[{"instruction":"Prep instruction with quantities.","usedOn":"Days 1–5"}]}]}}

Keep descriptions under 20 words. Be concise.`;

function buildUserPrompt(profile: any): string {
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

  return `${dayRange}

Profile: ${profile.name}, ${profile.age}y ${profile.gender}, ${profile.city} ${profile.country}
${profile.weightKg}kg → ${profile.targetWeightKg}kg, ${profile.heightCm}cm, BMI ${bmi}
Goal: ${profile.primaryGoal}, Intensity: ${profile.dietIntensity}
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
TARGETS: ${profile.targetCalories} kcal, ${profile.proteinTarget}g protein, ${profile.carbTarget}g carbs, ${profile.fatTarget}g fat, ${profile.fibreTarget}g fibre${customBlock}`;
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

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = buildUserPrompt(profile);

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
    // Runs after Claude generation, before DB save.
    // Uses CalorieNinjas to verify actual macro content per ingredient.
    // Replaces Claude's estimates with CN-verified numbers.
    // If a day is out of tolerance, asks Claude to replace one meal and re-verifies.
    // Completely skipped when CALORIE_NINJAS_API_KEY is not set.
    const CN_ENABLED        = !!process.env.CALORIE_NINJAS_API_KEY;
    const MAX_CORRECTIONS   = 3;   // max correction iterations per day
    const DAYS_TO_VALIDATE  = planData.days.length; // 7 or 14

    const dailyTargets = {
      calories: profile.targetCalories ?? 1700,
      proteinG: (profile as any).proteinTarget ?? 150,
      carbsG:   (profile as any).carbTarget    ?? 80,
      fatG:     (profile as any).fatTarget     ?? 50,
      fibreG:   (profile as any).fibreTarget   ?? 25,
    };

    let cnChecksTotal      = 0;
    let cnCorrectionsTotal = 0;

    try {
    if (CN_ENABLED) {
      const isRegen = !!(await prisma.mealPlan.count({ where: { userId } }));
      console.log(`[CN Pipeline] Starting — userId: ${userId}, isRegeneration: ${isRegen}, targetCalories: ${dailyTargets.calories}`);

      const estimatedCalls = DAYS_TO_VALIDATE * (planData.days[0]?.meals?.length ?? 4);
      console.log(
        `[CalorieNinjas] Starting verification — estimated ${estimatedCalls} API calls` +
        ` for ${DAYS_TO_VALIDATE}-day plan`
      );

      sendEvent('progress', { step: 'Verifying macro accuracy with nutrition database...' });

      // Process each day sequentially — free tier is 100 calls/day
      for (let dayIdx = 0; dayIdx < DAYS_TO_VALIDATE; dayIdx++) {
        const day         = planData.days[dayIdx];
        let currentMeals  = [...day.meals];
        let iteration     = 0;
        let validated     = false;

        while (!validated && iteration < MAX_CORRECTIONS) {
          // Verify CN macros for all meals in this day
          const verifiedMacros = await verifyDayMacros(currentMeals);
          cnChecksTotal += currentMeals.length; // one CN call per meal
          const validation     = validateDayMacros(verifiedMacros, dailyTargets);

          if (validation.isValid) {
            // Replace Claude estimates with CN-verified numbers
            currentMeals = currentMeals.map((meal, i) => ({
              ...meal,
              calories: verifiedMacros[i].calories,
              protein:  verifiedMacros[i].proteinG,
              carbs:    verifiedMacros[i].carbsG,
              fat:      verifiedMacros[i].fatG,
              fibre:    verifiedMacros[i].fibreG,
            }));
            validated = true;
            console.log(`[Validation] Day ${dayIdx + 1} passed on iteration ${iteration}`);

          } else {
            iteration++;
            console.log(
              `[Validation] Day ${dayIdx + 1} iteration ${iteration} — gaps:`,
              validation.gaps.map(g => `${g.macro} ${g.pct}%`).join(', ')
            );

            if (iteration < MAX_CORRECTIONS) {
              sendEvent('progress', { step: `Adjusting Day ${dayIdx + 1} to hit your targets...` });

              const correctionPrompt = buildCorrectionPrompt(
                validation.gaps,
                currentMeals,
                profile,
              );

              try {
                const corrResp = await client.messages.create({
                  model:      CLAUDE_MODEL,
                  max_tokens: 600,
                  messages:   [{ role: 'user', content: correctionPrompt }],
                });

                const corrText = corrResp.content[0]?.type === 'text'
                  ? corrResp.content[0].text : '';

                const corrMeal = JSON.parse(
                  corrText.replace(/```json|```/g, '').trim()
                );

                // Replace the snack if present, otherwise lunch, otherwise index 1
                const replaceIdx =
                  currentMeals.findIndex(m => m.type === 'snack') !== -1
                    ? currentMeals.findIndex(m => m.type === 'snack')
                    : currentMeals.findIndex(m => m.type === 'lunch') !== -1
                    ? currentMeals.findIndex(m => m.type === 'lunch')
                    : 1;

                currentMeals = currentMeals.map((m, i) =>
                  i === replaceIdx ? { ...corrMeal, mealIndex: m.mealIndex } : m
                );
                cnCorrectionsTotal += 1; // successful correction call

              } catch (parseErr) {
                console.warn(
                  `[Validation] Correction parse failed day ${dayIdx + 1}:`, parseErr
                );
                // Accept current verified macros and move on
                currentMeals = currentMeals.map((meal, i) => ({
                  ...meal,
                  calories: verifiedMacros[i].calories,
                  protein:  verifiedMacros[i].proteinG,
                  carbs:    verifiedMacros[i].carbsG,
                  fat:      verifiedMacros[i].fatG,
                  fibre:    verifiedMacros[i].fibreG,
                }));
                validated = true;
              }

            } else {
              // Max iterations reached — use best verified macros available
              currentMeals = currentMeals.map((meal, i) => ({
                ...meal,
                calories: verifiedMacros[i].calories,
                protein:  verifiedMacros[i].proteinG,
                carbs:    verifiedMacros[i].carbsG,
                fat:      verifiedMacros[i].fatG,
                fibre:    verifiedMacros[i].fibreG,
              }));
              validated = true;
              console.log(`[Validation] Day ${dayIdx + 1} accepted after max iterations`);
            }
          }
        }

        // Write corrected meals back to planData and recalculate day totals
        planData.days[dayIdx].meals        = currentMeals;
        planData.days[dayIdx].totalCalories = currentMeals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
        planData.days[dayIdx].totalProtein  = currentMeals.reduce((s: number, m: any) => s + (m.protein  || 0), 0);
        planData.days[dayIdx].totalCarbs    = currentMeals.reduce((s: number, m: any) => s + (m.carbs    || 0), 0);
        planData.days[dayIdx].totalFat      = currentMeals.reduce((s: number, m: any) => s + (m.fat      || 0), 0);
        planData.days[dayIdx].totalFibre    = currentMeals.reduce((s: number, m: any) => s + (m.fibre    || 0), 0);
      }

      sendEvent('progress', { step: 'Macro verification complete...' });
      console.log(
        `[CN Summary] ${planDuration}-day plan: ${cnChecksTotal} CN checks,` +
        ` ${cnCorrectionsTotal} corrections`
      );

    } else {
      // CalorieNinjas not configured — skip silently, use Claude estimates as before
      console.log('[Validation] CalorieNinjas not configured — skipping macro verification');
    }
    } catch (cnErr: any) {
      // CalorieNinjas failure must NEVER kill the generation — fall back to Claude's original estimates
      console.error('[CalorieNinjas] Verification pipeline failed — skipping, using Claude estimates:', cnErr.message);
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
