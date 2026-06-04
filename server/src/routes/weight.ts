import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { validateWeightNote } from '../utils/validation';
import { perUserLimiter } from '../middleware/perUserLimiter';

const router = Router();

// GET /api/weight/logs — all weight logs for user, sorted ASC
router.get('/logs', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.weightLog.findMany({
      where: { userId: req.userId! },
      orderBy: { loggedAt: 'asc' },
      select: { id: true, weightKg: true, loggedAt: true, note: true }
    });
    res.json({ logs });
  } catch (err) {
    console.error('Weight logs error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load weight logs.' });
  }
});

// POST /api/weight/log — create a new weight log
router.post('/log', requireAuth, perUserLimiter({ windowMs: 60_000, max: 60, keyPrefix: 'weight-log' }), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { weightKg, note, loggedAt } = req.body;

    if (typeof weightKg !== 'number' || weightKg < 20 || weightKg > 300) {
      res.status(400).json({ error: 'Weight must be a number between 20 and 300 kg' });
      return;
    }
    const cleanNote = validateWeightNote(note) ?? '';

    const logDate = loggedAt ? new Date(loggedAt) : new Date();

    // Prevent duplicate logs on same calendar date
    const dayStart = new Date(logDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(logDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.weightLog.findFirst({
      where: {
        userId,
        loggedAt: { gte: dayStart, lte: dayEnd }
      }
    });

    if (existing) {
      res.status(409).json({
        error: 'You already logged weight for today. Use update instead.',
        existingId: existing.id,
        existingWeight: existing.weightKg
      });
      return;
    }

    // P2002 guard: a concurrent POST from another tab/device can win the
    // race past the findFirst check. Translating the unique-constraint
    // violation to a 409 keeps the user informed instead of returning 500.
    let log;
    try {
      log = await prisma.weightLog.create({
        data: {
          userId,
          weightKg,
          loggedAt: logDate,
          note: cleanNote
        },
        select: { id: true, weightKg: true, loggedAt: true, note: true }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        res.status(409).json({ error: 'duplicate_weight_log', message: 'A weight log for this day already exists.' });
        return;
      }
      throw err;
    }

    res.json({ log });
  } catch (err) {
    console.error('Weight log create error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to log weight.' });
  }
});

// PATCH /api/weight/log/:id — update a weight log
router.patch('/log/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { weightKg, note } = req.body;

    const existing = await prisma.weightLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    if (weightKg !== undefined && (typeof weightKg !== 'number' || weightKg < 20 || weightKg > 300)) {
      res.status(400).json({ error: 'Weight must be a number between 20 and 300 kg' });
      return;
    }

    const updateData: any = {};
    if (weightKg !== undefined) updateData.weightKg = weightKg;
    if (note !== undefined) {
      const cleanNote = validateWeightNote(note);
      if (cleanNote === null && note !== null) {
        res.status(400).json({ error: 'note must be a string under 500 chars' });
        return;
      }
      updateData.note = cleanNote ?? '';
    }

    const log = await prisma.weightLog.update({
      where: { id },
      data: updateData,
      select: { id: true, weightKg: true, loggedAt: true, note: true }
    });

    res.json({ log });
  } catch (err) {
    console.error('Weight log update error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to update weight log.' });
  }
});

// DELETE /api/weight/log/:id — delete a weight log
router.delete('/log/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await prisma.weightLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    // Cannot delete first/oldest log (starting weight)
    const firstLog = await prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'asc' }
    });

    if (firstLog && firstLog.id === id) {
      res.status(403).json({ error: 'Cannot delete your starting weight' });
      return;
    }

    await prisma.weightLog.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Weight log delete error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to delete weight log.' });
  }
});

// GET /api/weight/projection — projected weight series
router.get('/projection', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(400).json({ error: 'Profile not found' });
      return;
    }

    // Use latest weight log as starting point
    const latestLog = await prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' }
    });

    const startWeight = latestLog ? latestLog.weightKg : profile.weightKg;
    const startDate = latestLog ? new Date(latestLog.loggedAt) : new Date();
    const targetWeight = profile.targetWeightKg ?? null;

    // Weight projection requires both a target weight and an intensity-based goal
    if (targetWeight == null || !profile.dietIntensity) {
      res.json({ projection: [], goalDate: null, weeklyLossKg: 0, startWeight, startDate: formatDate(startDate) });
      return;
    }

    const weeklyLoss = getWeeklyLoss(profile.dietIntensity, profile.activityLevel);
    const isLosing = startWeight > targetWeight;

    const projection: { date: string; weightKg: number }[] = [];
    let currentWeight = startWeight;
    let currentDate = new Date(startDate);

    // Generate weekly projection points until goal or 2 year cap
    while (
      (isLosing ? currentWeight > targetWeight : currentWeight < targetWeight) &&
      projection.length < 104
    ) {
      projection.push({
        date: formatDate(currentDate),
        weightKg: Math.round(currentWeight * 10) / 10
      });
      currentWeight = isLosing
        ? Math.max(currentWeight - weeklyLoss, targetWeight)
        : Math.min(currentWeight + weeklyLoss, targetWeight);
      currentDate = addWeeks(currentDate, 1);
    }

    // Always add goal point at end
    projection.push({
      date: formatDate(currentDate),
      weightKg: targetWeight
    });

    res.json({
      projection,
      goalDate: formatDate(currentDate),
      weeklyLossKg: weeklyLoss,
      startWeight,
      startDate: formatDate(startDate)
    });
  } catch (err) {
    console.error('Weight projection error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to generate projection.' });
  }
});

function getWeeklyLoss(dietIntensity: string, activityLevel: string): number {
  const base: Record<string, number> = {
    low: 0.35,
    moderate: 0.50,
    high: 0.75
  };
  const weeklyLoss = base[dietIntensity] || 0.5;
  const modifier = activityLevel === 'very_active' ? 1.1 : 1.0;
  return Math.round(weeklyLoss * modifier * 100) / 100;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

export default router;
