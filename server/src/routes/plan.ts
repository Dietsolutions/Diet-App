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

export default router;
