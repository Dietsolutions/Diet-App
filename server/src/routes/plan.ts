import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { MEAL_PLAN } from '../data/mealPlan';
import { regenerateShoppingList } from '../utils/shoppingListUtils';

const router = Router();

function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  // Sunday bug fix: day===0 must go back 6 to reach the previous Monday, not forward 1
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

// GET /api/plan — returns meal plan data (AI-generated or fallback to hardcoded)
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Try to find active AI-generated plan
    let activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      include: { days: { orderBy: { dayIndex: 'asc' } } },
      orderBy: { generatedAt: 'desc' }
    });

    // Bug 1 fallback: if no active plan (e.g. generation failed mid-way and deactivated
    // the previous plan before creating a new one), surface the most recently generated
    // plan and re-activate it so future requests find it correctly.
    if (!activePlan || activePlan.days.length === 0) {
      const mostRecent = await prisma.mealPlan.findFirst({
        where: { userId },
        include: { days: { orderBy: { dayIndex: 'asc' } } },
        orderBy: { generatedAt: 'desc' }
      });

      if (mostRecent && mostRecent.days.length > 0) {
        await prisma.mealPlan.update({
          where: { id: mostRecent.id },
          data: { isActive: true }
        });
        activePlan = mostRecent;
      }
    }

    if (activePlan && activePlan.days.length > 0) {
      const days = activePlan.days.map(d => ({
        label: d.dayName,
        dayIndex: d.dayIndex,
        totalCalories: d.totalCalories,
        totalProtein: d.totalProtein,
        totalCarbs: d.totalCarbs,
        totalFat: d.totalFat,
        totalFibre: d.totalFibre,
        meals: (() => {
          try { return JSON.parse(d.meals || '[]'); } catch { return []; }
        })()
      }));

      let weekSummary: any = {};
      try { weekSummary = JSON.parse(activePlan.weekSummary || '{}'); } catch { weekSummary = {}; }

      res.json({
        days,
        isGenerated: true,
        weekSummary,
        mealPlanId: activePlan.id,
        weekStartDate: activePlan.weekStartDate.toISOString().split('T')[0],
        planDuration: activePlan.planDuration ?? 7
      });
      return;
    }

    // Fallback to hardcoded data
    res.json({ days: MEAL_PLAN, isGenerated: false });
  } catch (err) {
    console.error('Plan fetch error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load meal plan.' });
  }
});

// GET /api/plan/week-start
router.get('/week-start', requireAuth, (_req: AuthRequest, res: Response): void => {
  const weekStart = getMondayOfCurrentWeek();
  res.json({ weekStart });
});

// GET /api/plan/meal-prep-guide
router.get('/meal-prep-guide', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      select: { mealPrepGuide: true }
    });

    if (!activePlan) {
      res.json({ guide: null });
      return;
    }

    res.json({ guide: activePlan.mealPrepGuide ?? null });
  } catch (err) {
    console.error('Meal prep guide error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /api/plan/replace-meal — generate 4 AI meal alternatives ────────────
router.post('/replace-meal', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { dayIndex, mealIndex, currentMeal, instructions, hints, rules } = req.body;

    if (!currentMeal) {
      res.status(400).json({ error: 'currentMeal is required' });
      return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(400).json({ error: 'Profile not found' });
      return;
    }

    const allergies: string[] = JSON.parse(profile.allergies || '[]');
    const avoid: string[]     = JSON.parse(profile.avoidIngredients || '[]').filter((a: string) => a !== '__none__');
    const preferred: string[] = JSON.parse(profile.preferredIngredients || '[]');
    const cuisines: string[]  = JSON.parse(profile.cuisinePreferences || '[]');

    const ruleDescriptions: Record<string, string> = {
      vegetarian:     'Only vegetarian ingredients — no meat or fish',
      no_seafood:     'No seafood or fish',
      lactose_free:   'No dairy products (milk, cheese, curd, paneer)',
      high_protein:   'High protein priority — maximise protein content',
      minimize_prep:  'Minimal prep — under 15 minutes',
      spicy:          'Make it spicy with bold flavours',
      low_carb:       'Low carbohydrate content',
      gluten_free:    'Only gluten-free ingredients',
      no_nuts:        'No nuts or nut products',
      budget_friendly:'Use affordable, everyday ingredients',
      no_onion_garlic:'No onion or garlic',
      quick_cook:     'Total cooking time under 20 minutes',
    };

    const activeRuleLines = (rules as string[] || []).map((r: string) => ruleDescriptions[r] || r);
    const constraintLines = [
      allergies.length > 0 ? `STRICT allergies — never use: ${allergies.join(', ')}` : '',
      avoid.length > 0     ? `Avoid ingredients: ${avoid.join(', ')}` : '',
      instructions          ? `User instruction: ${instructions}` : '',
      (hints as string[] || []).length > 0 ? `Preferences: ${hints.join(', ')}` : '',
      ...activeRuleLines,
    ].filter(Boolean);

    const targetCal  = Math.round(currentMeal.calories  ?? 0);
    const targetProt = Math.round(currentMeal.protein   ?? 0);
    const targetCarb = Math.round(currentMeal.carbs     ?? 0);
    const targetFat  = Math.round(currentMeal.fat       ?? 0);
    const targetFibr = Math.round(currentMeal.fibre     ?? 0);
    const buffer     = 0.20;

    const prompt = `You are a professional nutritionist. Generate exactly 4 alternative ${currentMeal.type} meal options.

Current meal being replaced: "${currentMeal.name}"
Time slot: ${currentMeal.time}

Macro targets (stay within ±${Math.round(buffer * 100)}%):
- Calories: ${targetCal} kcal (${Math.round(targetCal * (1 - buffer))}–${Math.round(targetCal * (1 + buffer))})
- Protein: ${targetProt}g  |  Carbs: ${targetCarb}g  |  Fat: ${targetFat}g  |  Fibre: ${targetFibr}g

User profile:
- Diet: ${profile.mealPreference}, Cuisines: ${cuisines.join(', ') || 'Any'}
- Preferred ingredients: ${preferred.slice(0, 10).join(', ')}

Constraints (MUST follow all):
${constraintLines.map(l => `- ${l}`).join('\n') || '- None'}

Return ONLY a JSON array — no markdown, no explanation, no prose:
[
  {
    "name": "Meal Name",
    "description": "Under 20 words with gram quantities",
    "type": "${currentMeal.type}",
    "time": "${currentMeal.time}",
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "fibre": 0,
    "ingredients": ["150g item", "80g item"],
    "cookingTip": "One optional cooking tip",
    "prepTime": "15 min"
  }
]

Generate 4 varied, realistic options. Vary cuisines where possible.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      res.status(500).json({ error: 'No AI response' });
      return;
    }

    const jsonMatch = textContent.text.trim().match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'Invalid AI response format' });
      return;
    }

    const options = JSON.parse(jsonMatch[0]);
    res.json({ options, dayIndex, mealIndex });
  } catch (err) {
    console.error('Generate meal options error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'Failed to generate meal options' });
  }
});

// ── PATCH /api/plan/replace-meal — save selected option into MealPlanDay ─────
router.patch('/replace-meal', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { dayIndex, mealIndex, meal } = req.body;

    if (typeof dayIndex !== 'number' || typeof mealIndex !== 'number' || !meal) {
      res.status(400).json({ error: 'dayIndex, mealIndex and meal are required' });
      return;
    }

    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      include: { days: { where: { dayIndex }, take: 1 } },
      orderBy: { generatedAt: 'desc' },
    });

    if (!activePlan || activePlan.days.length === 0) {
      res.status(404).json({ error: 'No active plan found' });
      return;
    }

    const day = activePlan.days[0];
    let meals: any[];
    try { meals = JSON.parse(day.meals || '[]'); } catch { meals = []; }

    if (mealIndex < 0 || mealIndex >= meals.length) {
      res.status(400).json({ error: 'Invalid mealIndex' });
      return;
    }

    meals[mealIndex] = { ...meal, mealIndex };

    // Recalculate day totals from updated meals
    const totalCalories = meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
    const totalProtein  = meals.reduce((s: number, m: any) => s + (m.protein  || 0), 0);
    const totalCarbs    = meals.reduce((s: number, m: any) => s + (m.carbs    || 0), 0);
    const totalFat      = meals.reduce((s: number, m: any) => s + (m.fat      || 0), 0);
    const totalFibre    = meals.reduce((s: number, m: any) => s + (m.fibre    || 0), 0);

    await prisma.mealPlanDay.update({
      where: { id: day.id },
      data: { meals: JSON.stringify(meals), totalCalories, totalProtein, totalCarbs, totalFat, totalFibre },
    });

    // Fire-and-forget shopping list sync — does not block the response
    regenerateShoppingList(userId, activePlan.id).catch(() => {});

    res.json({ success: true, updatedMeal: meals[mealIndex] });
  } catch (err) {
    console.error('Update meal error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'Failed to update meal' });
  }
});

// ── POST /api/plan/confirm-overview — final shopping list sync for Feature B ─
// Called when the user taps START MY PLAN on PlanOverviewScreen.
// Triggers one definitive shopping list regeneration covering all accumulated
// meal changes (individual PATCHes may have already fired partial regens).
router.post('/confirm-overview', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { generatedAt: 'desc' },
    });

    if (!activePlan) {
      res.json({ success: true }); // no active plan — nothing to confirm
      return;
    }

    // Fire-and-forget so the response is instant
    regenerateShoppingList(userId, activePlan.id).catch(() => {});

    res.json({ success: true, mealPlanId: activePlan.id });
  } catch (err) {
    console.error('confirm-overview error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /api/plan/review/:mealPlanId ─────────────────────────────────────────
// Returns full plan for the review screen. Accepts 'active' as mealPlanId.
router.get('/review/:mealPlanId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId     = req.userId!;
    const { mealPlanId } = req.params;

    const where = mealPlanId === 'active'
      ? { userId, isActive: true }
      : { id: mealPlanId, userId };

    const plan = await prisma.mealPlan.findFirst({
      where,
      include: { days: { orderBy: { dayIndex: 'asc' } } },
      orderBy: { generatedAt: 'desc' },
    });

    if (!plan) {
      res.status(404).json({ error: 'plan_not_found' });
      return;
    }

    let weekSummary: any = {};
    try { weekSummary = JSON.parse(plan.weekSummary || '{}'); } catch { weekSummary = {}; }

    const days = plan.days.map(d => ({
      id:            d.id,
      dayIndex:      d.dayIndex,
      dayName:       d.dayName,
      totalCalories: d.totalCalories,
      totalProtein:  d.totalProtein,
      totalCarbs:    d.totalCarbs,
      totalFat:      d.totalFat,
      totalFibre:    d.totalFibre,
      meals: (() => { try { return JSON.parse(d.meals || '[]'); } catch { return []; } })(),
    }));

    res.json({
      plan: {
        id:               plan.id,
        planDuration:     plan.planDuration,
        weekStartDate:    plan.weekStartDate.toISOString().split('T')[0],
        reviewConfirmed:  plan.reviewConfirmed,
        weekSummary,
        days,
      }
    });
  } catch (err) {
    console.error('plan review fetch error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /api/plan/regenerate-single-meal ─────────────────────────────────────
// Generates 3 AI alternatives for a specific meal.
router.post('/regenerate-single-meal', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex, instructions, hints } = req.body;

    if (!mealPlanId || typeof dayIndex !== 'number' || typeof mealIndex !== 'number') {
      res.status(400).json({ error: 'mealPlanId, dayIndex, mealIndex are required' });
      return;
    }

    const day = await prisma.mealPlanDay.findFirst({
      where: { mealPlanId, dayIndex },
    });
    if (!day) { res.status(404).json({ error: 'day_not_found' }); return; }

    let meals: any[];
    try { meals = JSON.parse(day.meals || '[]'); } catch { meals = []; }
    const currentMeal = meals[mealIndex];
    if (!currentMeal) { res.status(400).json({ error: 'meal_not_found' }); return; }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) { res.status(400).json({ error: 'profile_not_found' }); return; }

    const allergies: string[]  = JSON.parse(profile.allergies || '[]');
    const avoid: string[]      = JSON.parse(profile.avoidIngredients || '[]').filter((a: string) => a !== '__none__');
    const cuisines: string[]   = JSON.parse(profile.cuisinePreferences || '[]');

    const QUICK_HINTS = [
      'Something light', 'Quick · under 15 min', 'No dairy', 'High protein',
      'Spicy', 'South Indian', 'No cooking required', 'Budget friendly',
      'High fibre', 'Low carb', 'Vegetarian', 'One pot meal',
    ];
    const hintLines = ((hints as string[]) || [])
      .filter(h => QUICK_HINTS.includes(h))
      .map(h => `- ${h}`);

    const cal  = Math.round(currentMeal.calories ?? 0);
    const prot = parseFloat((currentMeal.protein ?? 0).toFixed(1));
    const carb = parseFloat((currentMeal.carbs   ?? 0).toFixed(1));
    const fat  = parseFloat((currentMeal.fat     ?? 0).toFixed(1));
    const fibr = parseFloat((currentMeal.fibre   ?? 0).toFixed(1));

    const prompt = `You are a professional nutritionist. A user wants to replace one meal in their plan with a different option.

MEAL BEING REPLACED:
Name: ${currentMeal.name}
Type: ${currentMeal.type} (${currentMeal.time})
Calories: ${cal} kcal
Protein: ${prot}g | Carbs: ${carb}g | Fat: ${fat}g | Fibre: ${fibr}g

USER PROFILE:
Diet preference: ${profile.mealPreference}
Cuisine preferences: ${cuisines.join(', ') || 'Any'}
Allergies: ${allergies.join(', ') || 'None'}
Avoid: ${avoid.join(', ') || 'None'}

USER INSTRUCTIONS:
${(instructions as string)?.trim() || 'No specific instructions'}

SELECTED HINTS:
${hintLines.join('\n') || 'None'}

MACRO TARGETS (stay within ±20%):
Calories: ${Math.round(cal * 0.8)}–${Math.round(cal * 1.2)} kcal
Protein:  ${(prot * 0.8).toFixed(1)}–${(prot * 1.2).toFixed(1)}g
Carbs:    ${(carb * 0.8).toFixed(1)}–${(carb * 1.2).toFixed(1)}g
Fat:      ${(fat  * 0.8).toFixed(1)}–${(fat  * 1.2).toFixed(1)}g

REQUIREMENTS:
- Generate exactly 3 different alternatives
- Stay within the macro ranges above
- Respect all allergies and avoidances
- Follow user instructions and hints
- Each option must differ from the others and the original
- Suitable for ${currentMeal.type} at ${currentMeal.time}
- Easy to cook, under 30 minutes

Respond ONLY with valid JSON (no markdown):
{
  "options": [
    {
      "id": "opt_1",
      "name": "string",
      "description": "string under 20 words",
      "cookingTip": "string",
      "ingredients": ["string"],
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "fibre": 0,
      "prepTime": "string",
      "type": "${currentMeal.type}",
      "time": "${currentMeal.time}"
    }
  ]
}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model:      process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      res.status(500).json({ error: 'no_ai_response' }); return;
    }

    const jsonMatch = textContent.text.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) { res.status(500).json({ error: 'invalid_ai_response' }); return; }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ options: parsed.options || [] });
  } catch (err) {
    console.error('regenerate-single-meal error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'Failed to regenerate meal' });
  }
});

// ── PATCH /api/plan/select-meal ───────────────────────────────────────────────
// Saves a selected replacement meal into MealPlanDay (no locking).
router.patch('/select-meal', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId, dayIndex, mealIndex, newMeal } = req.body;

    if (!mealPlanId || typeof dayIndex !== 'number' || typeof mealIndex !== 'number' || !newMeal) {
      res.status(400).json({ error: 'mealPlanId, dayIndex, mealIndex, newMeal are required' });
      return;
    }

    const day = await prisma.mealPlanDay.findFirst({ where: { mealPlanId, dayIndex } });
    if (!day) { res.status(404).json({ error: 'day_not_found' }); return; }

    let meals: any[];
    try { meals = JSON.parse(day.meals || '[]'); } catch { meals = []; }

    if (mealIndex < 0 || mealIndex >= meals.length) {
      res.status(400).json({ error: 'invalid_mealIndex' }); return;
    }

    meals[mealIndex] = { ...newMeal, mealIndex };

    const totalCalories = meals.reduce((s: number, m: any) => s + (m.calories || 0), 0);
    const totalProtein  = meals.reduce((s: number, m: any) => s + (m.protein  || 0), 0);
    const totalCarbs    = meals.reduce((s: number, m: any) => s + (m.carbs    || 0), 0);
    const totalFat      = meals.reduce((s: number, m: any) => s + (m.fat      || 0), 0);
    const totalFibre    = meals.reduce((s: number, m: any) => s + (m.fibre    || 0), 0);

    const updatedDay = await prisma.mealPlanDay.update({
      where: { id: day.id },
      data:  { meals: JSON.stringify(meals), totalCalories, totalProtein, totalCarbs, totalFat, totalFibre },
    });

    // Fire-and-forget shopping list sync
    regenerateShoppingList(userId, mealPlanId).catch(() => {});

    res.json({ success: true, updatedDay });
  } catch (err) {
    console.error('select-meal error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'Failed to select meal' });
  }
});

// ── POST /api/plan/confirm-review ─────────────────────────────────────────────
// Called when user taps CONFIRM PLAN on PlanReviewScreen.
// Activates the plan, marks it reviewed, sets onboardingDone, syncs shopping.
router.post('/confirm-review', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlanId } = req.body;

    // Find the target plan (by ID or the most recent active)
    const plan = mealPlanId
      ? await prisma.mealPlan.findFirst({ where: { id: mealPlanId, userId } })
      : await prisma.mealPlan.findFirst({ where: { userId, isActive: true }, orderBy: { generatedAt: 'desc' } });

    if (!plan) {
      res.status(404).json({ error: 'plan_not_found' }); return;
    }

    // Deactivate all other plans for this user
    await prisma.mealPlan.updateMany({
      where: { userId, id: { not: plan.id } },
      data:  { isActive: false },
    });

    // Mark this plan active + confirmed
    await prisma.mealPlan.update({
      where: { id: plan.id },
      data:  { isActive: true, reviewConfirmed: true, reviewConfirmedAt: new Date() },
    });

    // Set onboardingDone (idempotent — safe for already-onboarded re-gens)
    await prisma.user.update({
      where: { id: userId },
      data:  { onboardingDone: true },
    });

    // Fire-and-forget final shopping list sync
    regenerateShoppingList(userId, plan.id).catch(() => {});

    res.json({ success: true, mealPlanId: plan.id });
  } catch (err) {
    console.error('confirm-review error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
