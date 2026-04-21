import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/meals/replace
router.post('/replace', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      date, dayIndex, mealIndex,
      foodName, foodSource, foodExternalId,
      servingSize, servingQty, servingGrams,
      calories, proteinG, carbsG, fatG, fibreG,
      note, isAiEstimate,
    } = req.body;

    // Validate required fields
    if (!date || typeof mealIndex !== 'number' || !foodName || !foodSource) {
      res.status(400).json({ error: 'Missing required fields: date, mealIndex, foodName, foodSource' });
      return;
    }

    if (mealIndex < 0 || mealIndex > 5) {
      res.status(400).json({ error: 'Invalid mealIndex' });
      return;
    }

    // Upsert the replacement
    const replacement = await prisma.mealReplacement.upsert({
      where: {
        userId_date_mealIndex: { userId, date, mealIndex },
      },
      update: {
        dayIndex: dayIndex ?? 0,
        foodName,
        foodSource,
        foodExternalId: foodExternalId || null,
        servingSize: servingSize || '1 serving',
        servingQty: servingQty ?? 1,
        servingGrams: servingGrams ?? null,
        calories: calories ?? 0,
        proteinG: proteinG ?? 0,
        carbsG: carbsG ?? 0,
        fatG: fatG ?? 0,
        fibreG: fibreG ?? 0,
        note: note || '',
        isAiEstimate: isAiEstimate ?? false,
      },
      create: {
        userId,
        date,
        dayIndex: dayIndex ?? 0,
        mealIndex,
        foodName,
        foodSource,
        foodExternalId: foodExternalId || null,
        servingSize: servingSize || '1 serving',
        servingQty: servingQty ?? 1,
        servingGrams: servingGrams ?? null,
        calories: calories ?? 0,
        proteinG: proteinG ?? 0,
        carbsG: carbsG ?? 0,
        fatG: fatG ?? 0,
        fibreG: fibreG ?? 0,
        note: note || '',
        isAiEstimate: isAiEstimate ?? false,
      },
    });

    // Also mark the meal as eaten
    try {
      const planDates = getPlanDates();
      const dIdx = planDates.indexOf(date);
      await prisma.mealLog.upsert({
        where: { userId_date_mealIndex: { userId, date, mealIndex } },
        update: { eaten: true, loggedAt: new Date() },
        create: { userId, date, dayIndex: dIdx >= 0 ? dIdx : (dayIndex ?? 0), mealIndex, eaten: true },
      });
    } catch {
      // non-critical
    }

    // Upsert RecentFoodLog — keep latest 10 per user
    try {
      await prisma.recentFoodLog.create({
        data: {
          userId,
          foodName,
          foodSource,
          foodData: {
            foodExternalId,
            servingSize,
            servingGrams,
            calories, proteinG, carbsG, fatG, fibreG,
            isAiEstimate,
          },
          usedAt: new Date(),
        },
      });

      // Clean old entries beyond 10
      const allRecent = await prisma.recentFoodLog.findMany({
        where: { userId },
        orderBy: { usedAt: 'desc' },
        select: { id: true },
      });
      if (allRecent.length > 10) {
        const toDelete = allRecent.slice(10).map(r => r.id);
        await prisma.recentFoodLog.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
    } catch {
      // non-critical
    }

    res.json({ replacement });
  } catch (err: any) {
    console.error('Meal replace error:', err?.message || err);
    res.status(500).json({ error: 'Failed to save meal replacement' });
  }
});

// GET /api/meals/replacements?date=YYYY-MM-DD
router.get('/replacements', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = req.query.date as string;

    if (!date) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const replacements = await prisma.mealReplacement.findMany({
      where: { userId, date },
    });

    res.json({ replacements });
  } catch (err: any) {
    console.error('Get replacements error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load replacements' });
  }
});

// GET /api/meals/replacements/week — get all replacements for current week
router.get('/replacements/week', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const dates = getPlanDates();

    const replacements = await prisma.mealReplacement.findMany({
      where: { userId, date: { in: dates } },
    });

    res.json({ replacements });
  } catch (err: any) {
    console.error('Get week replacements error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load week replacements' });
  }
});

// DELETE /api/meals/replace/:id
router.delete('/replace/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.mealReplacement.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Replacement not found' });
      return;
    }

    await prisma.mealReplacement.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete replacement error:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete replacement' });
  }
});

// ── Additional Meal Logging ────────────────────────────────────────────────

const VALID_MEAL_CATEGORIES = ['breakfast', 'brunch', 'lunch', 'evening_snack', 'dinner', 'other'] as const;

// GET /api/meals/additional?date=YYYY-MM-DD
router.get('/additional', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = req.query.date as string;
    if (!date) { res.status(400).json({ error: 'date query parameter is required' }); return; }

    const additionalMeals = await prisma.additionalMealLog.findMany({
      where: { userId, date },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ additionalMeals });
  } catch (err: any) {
    console.error('Get additional meals error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load additional meals' });
  }
});

// POST /api/meals/additional
router.post('/additional', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      date, mealCategory, mealTime,
      foodName, foodSource, foodExternalId,
      servingSize, servingQty, servingGrams,
      calories, proteinG, carbsG, fatG, fibreG,
      note, isAiEstimate,
    } = req.body;

    // Validate required fields
    if (!date || !mealCategory || !foodName || !foodSource) {
      res.status(400).json({ error: 'Missing required fields: date, mealCategory, foodName, foodSource' }); return;
    }
    if (!VALID_MEAL_CATEGORIES.includes(mealCategory)) {
      res.status(400).json({ error: `Invalid mealCategory. Must be one of: ${VALID_MEAL_CATEGORIES.join(', ')}` }); return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      res.status(400).json({ error: 'Cannot log meals for future dates' }); return;
    }
    if (typeof servingQty !== 'number' || servingQty <= 0) {
      res.status(400).json({ error: 'servingQty must be a positive number' }); return;
    }
    if (typeof calories === 'number' && calories < 0) {
      res.status(400).json({ error: 'calories must be >= 0' }); return;
    }

    const additionalMeal = await prisma.additionalMealLog.create({
      data: {
        userId,
        date,
        mealCategory,
        mealTime: mealTime || null,
        foodName,
        foodSource,
        foodExternalId: foodExternalId || null,
        servingSize: servingSize || '1 serving',
        servingQty,
        servingGrams: servingGrams ?? null,
        calories: calories ?? 0,
        proteinG: proteinG ?? 0,
        carbsG: carbsG ?? 0,
        fatG: fatG ?? 0,
        fibreG: fibreG ?? 0,
        note: note || '',
        isAiEstimate: isAiEstimate ?? false,
      },
    });

    // Save to RecentFoodLog (non-critical)
    try {
      await prisma.recentFoodLog.create({
        data: {
          userId,
          foodName,
          foodSource,
          foodData: { foodExternalId, servingSize, servingGrams, calories, proteinG, carbsG, fatG, fibreG, isAiEstimate },
          usedAt: new Date(),
        },
      });
      const allRecent = await prisma.recentFoodLog.findMany({
        where: { userId }, orderBy: { usedAt: 'desc' }, select: { id: true },
      });
      if (allRecent.length > 10) {
        await prisma.recentFoodLog.deleteMany({ where: { id: { in: allRecent.slice(10).map(r => r.id) } } });
      }
    } catch { /* non-critical */ }

    res.json({ additionalMeal });
  } catch (err: any) {
    console.error('Add additional meal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to log additional meal' });
  }
});

// DELETE /api/meals/additional/:id
router.delete('/additional/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await prisma.additionalMealLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Additional meal not found' }); return;
    }

    await prisma.additionalMealLog.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete additional meal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to delete additional meal' });
  }
});

// PATCH /api/meals/additional/:id
router.patch('/additional/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { servingQty, note, mealCategory, mealTime } = req.body;

    const existing = await prisma.additionalMealLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Additional meal not found' }); return;
    }

    if (mealCategory !== undefined && !VALID_MEAL_CATEGORIES.includes(mealCategory)) {
      res.status(400).json({ error: 'Invalid mealCategory' }); return;
    }

    const updated = await prisma.additionalMealLog.update({
      where: { id },
      data: {
        ...(servingQty !== undefined && { servingQty }),
        ...(note !== undefined && { note }),
        ...(mealCategory !== undefined && { mealCategory }),
        ...(mealTime !== undefined && { mealTime }),
      },
    });

    res.json({ additionalMeal: updated });
  } catch (err: any) {
    console.error('Update additional meal error:', err?.message || err);
    res.status(500).json({ error: 'Failed to update additional meal' });
  }
});

// Helper: get plan dates for current week
function getPlanDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  // Sunday bug fix: day===0 must go back 6 to reach previous Monday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default router;
