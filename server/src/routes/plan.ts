import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { MEAL_PLAN } from '../data/mealPlan';

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

export default router;
