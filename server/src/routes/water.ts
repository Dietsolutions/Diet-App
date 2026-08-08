import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/water?date=YYYY-MM-DD
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = (req.query.date as string || '').trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      return;
    }

    const log = await prisma.waterLog.findUnique({
      where: { userId_date: { userId, date } }
    });

    if (log) {
      res.json({ glasses: log.glasses, goalGlasses: log.goalGlasses, logId: log.id });
      return;
    }

    // No log yet — return default from profile
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const goalGlasses = profile?.waterIntakeGoal || 8;
    res.json({ glasses: 0, goalGlasses });
  } catch (err) {
    console.error('Water GET error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/water/range?start=YYYY-MM-DD&end=YYYY-MM-DD
// Per-day glasses over a window — feeds the tracker metric switcher's water series.
router.get('/range', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const start = (req.query.start as string || '').trim();
    const end   = (req.query.end   as string || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      res.status(400).json({ error: 'start and end must be YYYY-MM-DD with start <= end' });
      return;
    }

    const [logs, profile] = await Promise.all([
      prisma.waterLog.findMany({
        where: { userId, date: { gte: start, lte: end } },
        select: { date: true, glasses: true, goalGlasses: true },
      }),
      prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    const goalGlasses = profile?.waterIntakeGoal || 8;
    res.json({ days: logs, goalGlasses });
  } catch (err) {
    console.error('Water range error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/water
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { date, glasses } = req.body as { date: string; glasses: number };

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }
    if (typeof glasses !== 'number' || glasses < 0 || glasses > 50) {
      res.status(400).json({ error: 'glasses must be a number between 0 and 50' });
      return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const goalGlasses = profile?.waterIntakeGoal || 8;

    const waterLog = await prisma.waterLog.upsert({
      where: { userId_date: { userId, date } },
      update: { glasses, updatedAt: new Date() },
      create: { userId, date, glasses, goalGlasses }
    });

    res.json({ waterLog });
  } catch (err) {
    console.error('Water POST error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
