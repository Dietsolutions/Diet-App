import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

// ── Helpers ────────────────────────────────────────────────────────────────
function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayLocal(): string {
  return localDateStr(new Date());
}

const router = Router();

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  // day===0 is Sunday: go back 6 days to reach the previous Monday (not forward 1)
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getPlanDates(planDuration = 7): string[] {
  const monday = getMondayOfCurrentWeek();
  const dates: string[] = [];
  for (let i = 0; i < planDuration; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getWeekDates(weekStartDate: string): string[] {
  const start = new Date(weekStartDate + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getMonthDates(month: string): string[] {
  // month = "YYYY-MM"
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, mon - 1, i + 1);
    return d.toISOString().split('T')[0];
  });
}

function weeklyLossRate(intensity: string): number {
  if (intensity === 'low') return 0.3;
  if (intensity === 'high') return 0.75;
  return 0.5; // moderate
}

async function getMealsPerDay(userId: string): Promise<number> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  return profile?.mealsPerDay || 4;
}

// GET /api/tracker/summary?period=week&weekStart=YYYY-MM-DD
// GET /api/tracker/summary?period=month&month=YYYY-MM
router.get('/summary', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const period = req.query.period as string;
    const mealsPerDay = await getMealsPerDay(userId);

    if (period === 'week') {
      const weekStart = req.query.weekStart as string;
      if (!weekStart) { res.status(400).json({ error: 'weekStart required' }); return; }
      const dates = getWeekDates(weekStart);
      const logs = await prisma.mealLog.findMany({
        where: { userId, date: { in: dates }, eaten: true }
      });
      const total = 7 * mealsPerDay;
      const eaten = logs.length;
      res.json({ eaten, total, adherencePct: total > 0 ? Math.round((eaten / total) * 100) : 0 });
      return;
    }

    if (period === 'month') {
      const month = req.query.month as string; // "YYYY-MM"
      if (!month) { res.status(400).json({ error: 'month required' }); return; }
      const dates = getMonthDates(month);
      const todayStr = todayLocal();

      // Get active plan start date to know which calendar days are plan days
      const mealPlan = await prisma.mealPlan.findFirst({
        where: { userId, isActive: true },
        orderBy: { generatedAt: 'desc' },
        select: { weekStartDate: true },
      });

      let planDatesInMonth: string[];
      if (mealPlan) {
        const planStartLocal = localDateStr(new Date(mealPlan.weekStartDate));
        // Only count days that are: (a) on/after plan start, (b) not in the future
        planDatesInMonth = dates.filter(d => d >= planStartLocal && d <= todayStr);
      } else {
        planDatesInMonth = [];
      }

      const total = planDatesInMonth.length * mealsPerDay;
      const logs = await prisma.mealLog.findMany({
        where: { userId, date: { in: planDatesInMonth }, eaten: true }
      });
      const eaten = logs.length;
      res.json({ eaten, total, adherencePct: total > 0 ? Math.round((eaten / total) * 100) : 0 });
      return;
    }

    res.status(400).json({ error: 'period must be week or month' });
  } catch (err) {
    console.error('Tracker summary error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/tracker/goal-countdown
router.get('/goal-countdown', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    // Use latest weight log if available, otherwise profile's current weight
    const latestLog = await prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' }
    });
    const currentWeight = latestLog?.weightKg ?? profile.weightKg;
    const targetWeight = profile.targetWeightKg ?? null;

    // Goal date is only meaningful when the user has a weight target and an intensity-based goal
    if (targetWeight == null || !profile.dietIntensity) {
      res.json({
        goalDate: null,
        daysLeft: null,
        weeksLeft: null,
        displayText: 'No weight target set',
        isUrgent: false,
      });
      return;
    }

    const weightToLose = currentWeight - targetWeight;

    if (weightToLose <= 0) {
      res.json({
        goalDate: new Date().toISOString().split('T')[0],
        daysLeft: 0,
        weeksLeft: 0,
        displayText: "You've reached your goal weight! 🎉",
        isUrgent: false
      });
      return;
    }

    const rate = weeklyLossRate(profile.dietIntensity);
    const weeksNeeded = Math.ceil(weightToLose / rate);
    const goalDate = new Date();
    goalDate.setDate(goalDate.getDate() + weeksNeeded * 7);
    const goalDateStr = goalDate.toISOString().split('T')[0];
    const daysLeft = weeksNeeded * 7;

    let displayText: string;
    const isUrgent = daysLeft < 7;
    if (daysLeft <= 0) displayText = "You've reached your goal date!";
    else if (daysLeft < 7) displayText = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
    else if (daysLeft < 14) displayText = `${Math.ceil(daysLeft / 7)} week left`;
    else displayText = `${Math.ceil(daysLeft / 7)} weeks left`;

    res.json({ goalDate: goalDateStr, daysLeft, weeksLeft: weeksNeeded, displayText, isUrgent, targetWeight, currentWeight });
  } catch (err) {
    console.error('Goal countdown error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/tracker/stats
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Use the active plan's actual weekStartDate so adherence counts from the
    // real plan start day, not Monday of the calendar week.
    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { generatedAt: 'desc' },
      select: { weekStartDate: true, planDuration: true },
    });

    const planDuration = activePlan?.planDuration || 7;
    const planDates = activePlan
      ? (() => {
          const start = new Date(activePlan.weekStartDate);
          start.setHours(0, 0, 0, 0);
          return Array.from({ length: planDuration }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return localDateStr(d);
          });
        })()
      : getPlanDates(planDuration);

    const mealsPerDay = await getMealsPerDay(userId);

    // Total denominator: days elapsed so far (inclusive of today), up to planDuration
    const todayStr = todayLocal();
    const elapsedDays = Math.max(1, Math.min(
      planDuration,
      planDates.findIndex(d => d > todayStr) === -1
        ? planDuration
        : planDates.findIndex(d => d > todayStr)
    ));
    const totalMeals = elapsedDays * mealsPerDay;

    const logs = await prisma.mealLog.findMany({
      where: { userId, date: { in: planDates }, eaten: true }
    });

    const eaten = logs.length;
    const adherence = totalMeals > 0 ? Math.round((eaten / totalMeals) * 100) : 0;
    const remaining = totalMeals - eaten;

    // Streak: consecutive days from Day 0 with all meals eaten
    let streak = 0;
    for (let i = 0; i < elapsedDays; i++) {
      const date = planDates[i];
      const dayLogs = logs.filter(l => l.date === date);
      if (dayLogs.length === mealsPerDay) {
        streak = i + 1;
      } else {
        break;
      }
    }

    res.json({ eaten, total: totalMeals, adherence, streak, remaining, mealsPerDay });
  } catch (err) {
    console.error('Tracker stats error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load tracker stats.' });
  }
});

// GET /api/tracker/week?start=YYYY-MM-DD
// Returns 7 days of tracker data starting from `start` (defaults to plan start).
// dayIndex is computed via modulo so plans cycle indefinitely after plan start.
router.get('/week', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const activePlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      orderBy: { generatedAt: 'desc' },
      select: { weekStartDate: true, planDuration: true },
    });

    const planDuration = activePlan?.planDuration || 7;

    // Plan start in local date (used for modulo dayIndex computation)
    const planStartDate: Date | null = activePlan
      ? (() => { const d = new Date(activePlan.weekStartDate); d.setHours(0, 0, 0, 0); return d; })()
      : null;

    // Window start: use ?start= if provided, otherwise plan start (or today fallback)
    const rawStart = req.query.start as string | undefined;
    const windowStart: Date = rawStart
      ? (() => { const d = new Date(rawStart + 'T00:00:00'); d.setHours(0, 0, 0, 0); return d; })()
      : planStartDate ?? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

    // Build 7-date window
    const windowDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(windowStart);
      d.setDate(windowStart.getDate() + i);
      return localDateStr(d);
    });

    const mealsPerDay = await getMealsPerDay(userId);

    const logs = await prisma.mealLog.findMany({
      where: { userId, date: { in: windowDates } }
    });

    const week = windowDates.map((date) => {
      // Compute dayIndex via modulo — cycles indefinitely after plan start.
      // Returns -1 only for dates before the plan started.
      let dayIndex = -1;
      if (planStartDate) {
        const dateMs  = new Date(date + 'T00:00:00').getTime();
        const startMs = planStartDate.getTime();
        const diffDays = Math.round((dateMs - startMs) / 86400000);
        if (diffDays >= 0) dayIndex = diffDays % planDuration;
      }

      const dayLogs = logs.filter(l => l.date === date);
      const meals = Array.from({ length: mealsPerDay }, (_, mealIndex) => {
        const log = dayLogs.find(l => l.mealIndex === mealIndex);
        return { mealIndex, eaten: log?.eaten ?? false };
      });
      return { date, dayIndex, meals };
    });

    res.json({ week, weekStart: localDateStr(windowStart), mealsPerDay, planDuration });
  } catch (err) {
    console.error('Tracker week error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load tracker week.' });
  }
});

// GET /api/tracker/monthly-calories?month=YYYY-MM
router.get('/monthly-calories', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const today = todayLocal();
    const rawMonth = (req.query.month as string) || today.slice(0, 7);
    // Validate format
    const monthMatch = rawMonth.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) { res.status(400).json({ error: 'month must be YYYY-MM' }); return; }

    const year = parseInt(monthMatch[1], 10);
    const mon  = parseInt(monthMatch[2], 10);     // 1-based

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

    const targetCalories = profile.targetCalories;
    const planDuration   = (profile as any).planDuration || 7;
    const mealsPerDay    = profile.mealsPerDay || 4;

    // Get active meal plan with all days
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      include: { days: true },
      orderBy: { generatedAt: 'desc' },
    });

    const emptyResponse = {
      month: rawMonth, planDaysElapsed: 0, totalPlanDaysInMonth: 0,
      targetCalories, totalTargetKcal: 0, totalConsumedKcal: 0,
      deltaKcal: 0, deltaPct: 0, dailyAvgConsumed: 0, dailyData: [],
    };
    if (!mealPlan) { res.json(emptyResponse); return; }

    // Plan start date (stored as UTC midnight in DB — treat as local date string)
    const planStartLocal = localDateStr(new Date(mealPlan.weekStartDate));

    // Build planDay meals lookup: dayIndex → Meal[]
    const planDaysMap = new Map<number, any[]>();
    for (const pd of mealPlan.days) {
      try { planDaysMap.set(pd.dayIndex, JSON.parse(pd.meals || '[]')); } catch { planDaysMap.set(pd.dayIndex, []); }
    }

    // All calendar dates for the requested month
    const daysInMonth = new Date(year, mon, 0).getDate();
    const allDates = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, mon - 1, i + 1);
      return localDateStr(d);
    });

    // All plan days in the month (planStart to end of month — not capped at today)
    // Used as the denominator for "X of Y plan days progressed"
    const allPlanDatesInMonth = allDates.filter(d => d >= planStartLocal);
    const totalPlanDaysInMonth = allPlanDatesInMonth.length;

    // Elapsed plan days (planStart to today, within month) — numerator
    const validDates = allDates.filter(d => d >= planStartLocal && d <= today);

    if (validDates.length === 0) { res.json(emptyResponse); return; }

    // Fetch all MealLog and MealReplacement entries for these dates
    const [logs, replacements] = await Promise.all([
      prisma.mealLog.findMany({ where: { userId, date: { in: validDates } } }),
      prisma.mealReplacement.findMany({ where: { userId, date: { in: validDates } } }),
    ]);

    // Index by date
    const logsByDate: Record<string, typeof logs> = {};
    logs.forEach(l => { (logsByDate[l.date] ??= []).push(l); });
    const repsByDate: Record<string, typeof replacements> = {};
    replacements.forEach(r => { (repsByDate[r.date] ??= []).push(r); });

    let totalTargetKcal   = 0;
    let totalConsumedKcal = 0;
    const dailyData: any[] = [];

    for (const date of validDates) {
      // Derive planDayIndex via modulo (handles both 7 and 14-day plans, and rolling weeks)
      const planStartMs  = new Date(planStartLocal + 'T00:00:00Z').getTime();
      const dateMs       = new Date(date + 'T00:00:00Z').getTime();
      const daysSinceStart = Math.max(0, Math.floor((dateMs - planStartMs) / 86400000));
      const planDayIndex   = daysSinceStart % planDuration;

      const planMeals  = planDaysMap.get(planDayIndex) || [];
      const dateLogs   = logsByDate[date] || [];
      const dateReps   = repsByDate[date] || [];
      const repByMeal  = new Map(dateReps.map(r => [r.mealIndex, r]));

      let consumed = 0;
      for (let mealIdx = 0; mealIdx < mealsPerDay; mealIdx++) {
        const rep = repByMeal.get(mealIdx);
        if (rep) {
          // A replacement was logged — count its calories as consumed
          consumed += rep.calories;
        } else {
          const log = dateLogs.find(l => l.mealIndex === mealIdx && l.eaten);
          if (log) {
            const planMeal = planMeals[mealIdx];
            consumed += planMeal?.calories ?? 0;
          }
        }
      }

      const delta = consumed - targetCalories;
      totalTargetKcal   += targetCalories;
      totalConsumedKcal += consumed;

      const dayNum = parseInt(date.slice(8), 10);
      const hasData = dateLogs.some(l => l.eaten) || dateReps.length > 0;

      dailyData.push({ day: dayNum, date, delta, consumed, target: targetCalories, hasData });
    }

    const planDaysElapsed    = validDates.length;
    const deltaKcal          = totalConsumedKcal - totalTargetKcal;
    const deltaPct           = totalTargetKcal > 0 ? (deltaKcal / totalTargetKcal) * 100 : 0;
    const dailyAvgConsumed   = planDaysElapsed > 0 ? totalConsumedKcal / planDaysElapsed : 0;

    res.json({
      month: rawMonth,
      planDaysElapsed,
      totalPlanDaysInMonth,
      targetCalories,
      totalTargetKcal,
      totalConsumedKcal: Math.round(totalConsumedKcal),
      deltaKcal: Math.round(deltaKcal),
      deltaPct: Math.round(deltaPct * 10) / 10,
      dailyAvgConsumed: Math.round(dailyAvgConsumed),
      dailyData,
    });
  } catch (err) {
    console.error('Monthly calories error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/tracker/monthly-macros?month=YYYY-MM
// Returns consumed vs target for all 5 macros per calendar day.
// monthly-calories remains unchanged as a backward-compat alias.
router.get('/monthly-macros', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const today  = todayLocal();
    const rawMonth = (req.query.month as string) || today.slice(0, 7);
    const monthMatch = rawMonth.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) { res.status(400).json({ error: 'month must be YYYY-MM' }); return; }

    const year = parseInt(monthMatch[1], 10);
    const mon  = parseInt(monthMatch[2], 10); // 1-based

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

    const planDuration = (profile as any).planDuration || 7;
    const mealsPerDay  = profile.mealsPerDay || 4;

    const targets = {
      calories: profile.targetCalories,
      protein:  (profile as any).proteinTarget || 0,
      carbs:    (profile as any).carbTarget    || 0,
      fat:      (profile as any).fatTarget     || 0,
      fibre:    (profile as any).fibreTarget   || 0,
    };

    const mealPlan = await prisma.mealPlan.findFirst({
      where: { userId, isActive: true },
      include: { days: true },
      orderBy: { generatedAt: 'desc' },
    });

    const emptyTotals = (target: number) => ({ consumed: 0, target, delta: 0, deltaPct: 0, dailyAvg: 0 });
    const emptyResponse = {
      month: rawMonth, planDaysElapsed: 0, totalPlanDaysInMonth: 0,
      targets,
      totals: {
        calories: emptyTotals(targets.calories),
        protein:  emptyTotals(targets.protein),
        carbs:    emptyTotals(targets.carbs),
        fat:      emptyTotals(targets.fat),
        fibre:    emptyTotals(targets.fibre),
      },
      dailyData: [],
    };
    if (!mealPlan) { res.json(emptyResponse); return; }

    const planStartLocal = localDateStr(new Date(mealPlan.weekStartDate));

    // Build planDay meals lookup: dayIndex → Meal[]
    const planDaysMap = new Map<number, any[]>();
    for (const pd of mealPlan.days) {
      try { planDaysMap.set(pd.dayIndex, JSON.parse(pd.meals || '[]')); } catch { planDaysMap.set(pd.dayIndex, []); }
    }

    const daysInMonth = new Date(year, mon, 0).getDate();
    const allDates = Array.from({ length: daysInMonth }, (_, i) => localDateStr(new Date(year, mon - 1, i + 1)));

    const totalPlanDaysInMonth = allDates.filter(d => d >= planStartLocal).length;
    const validDates = allDates.filter(d => d >= planStartLocal && d <= today);

    if (validDates.length === 0) { res.json({ ...emptyResponse, totalPlanDaysInMonth }); return; }

    const [logs, replacements, additionalLogs] = await Promise.all([
      prisma.mealLog.findMany({ where: { userId, date: { in: validDates } } }),
      prisma.mealReplacement.findMany({ where: { userId, date: { in: validDates } } }),
      prisma.additionalMealLog.findMany({ where: { userId, date: { in: validDates } } }),
    ]);

    const logsByDate: Record<string, typeof logs> = {};
    logs.forEach(l => { (logsByDate[l.date] ??= []).push(l); });
    const repsByDate: Record<string, typeof replacements> = {};
    replacements.forEach(r => { (repsByDate[r.date] ??= []).push(r); });
    const additionalByDate: Record<string, typeof additionalLogs> = {};
    additionalLogs.forEach(a => { (additionalByDate[a.date] ??= []).push(a); });

    // Running totals for all 5 macros
    const running = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
    const dailyData: any[] = [];

    for (const date of validDates) {
      const planStartMs    = new Date(planStartLocal + 'T00:00:00Z').getTime();
      const dateMs         = new Date(date + 'T00:00:00Z').getTime();
      const daysSinceStart = Math.max(0, Math.floor((dateMs - planStartMs) / 86400000));
      const planDayIndex   = daysSinceStart % planDuration;

      const planMeals = planDaysMap.get(planDayIndex) || [];
      const dateLogs  = logsByDate[date] || [];
      const dateReps  = repsByDate[date] || [];
      const dateAdditional = additionalByDate[date] || [];
      const repByMeal = new Map(dateReps.map(r => [r.mealIndex, r]));

      const dayConsumed = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

      // Plan meals (with replacements)
      for (let mealIdx = 0; mealIdx < mealsPerDay; mealIdx++) {
        const rep = repByMeal.get(mealIdx);
        if (rep) {
          dayConsumed.calories += rep.calories;
          dayConsumed.protein  += (rep as any).proteinG ?? 0;
          dayConsumed.carbs    += (rep as any).carbsG   ?? 0;
          dayConsumed.fat      += (rep as any).fatG     ?? 0;
          dayConsumed.fibre    += (rep as any).fibreG   ?? 0;
        } else {
          const log = dateLogs.find(l => l.mealIndex === mealIdx && l.eaten);
          if (log) {
            const pm = planMeals[mealIdx];
            dayConsumed.calories += pm?.calories ?? 0;
            dayConsumed.protein  += pm?.protein  ?? 0;
            dayConsumed.carbs    += pm?.carbs    ?? 0;
            dayConsumed.fat      += pm?.fat      ?? 0;
            dayConsumed.fibre    += pm?.fibre    ?? 0;
          }
        }
      }

      // Additional meals stack on top of plan meals
      for (const extra of dateAdditional) {
        dayConsumed.calories += extra.calories;
        dayConsumed.protein  += extra.proteinG;
        dayConsumed.carbs    += extra.carbsG;
        dayConsumed.fat      += extra.fatG;
        dayConsumed.fibre    += extra.fibreG;
      }

      // Accumulate running totals
      (Object.keys(running) as (keyof typeof running)[]).forEach(k => { running[k] += dayConsumed[k]; });

      const hasData = dateLogs.some(l => l.eaten) || dateReps.length > 0 || dateAdditional.length > 0;
      const dayNum  = parseInt(date.slice(8), 10);

      dailyData.push({
        day: dayNum, date, hasData,
        calories: { consumed: dayConsumed.calories, target: targets.calories, delta: dayConsumed.calories - targets.calories },
        protein:  { consumed: dayConsumed.protein,  target: targets.protein,  delta: dayConsumed.protein  - targets.protein  },
        carbs:    { consumed: dayConsumed.carbs,    target: targets.carbs,    delta: dayConsumed.carbs    - targets.carbs    },
        fat:      { consumed: dayConsumed.fat,      target: targets.fat,      delta: dayConsumed.fat      - targets.fat      },
        fibre:    { consumed: dayConsumed.fibre,    target: targets.fibre,    delta: dayConsumed.fibre    - targets.fibre    },
      });
    }

    const planDaysElapsed = validDates.length;

    function buildTotals(key: keyof typeof running) {
      const consumed = running[key];
      const target   = targets[key] * planDaysElapsed;
      const delta    = consumed - target;
      const deltaPct = target > 0 ? (delta / target) * 100 : 0;
      const dailyAvg = planDaysElapsed > 0 ? consumed / planDaysElapsed : 0;
      return {
        consumed: Math.round(consumed),
        target:   Math.round(target),
        delta:    Math.round(delta),
        deltaPct: Math.round(deltaPct * 10) / 10,
        dailyAvg: Math.round(dailyAvg),
      };
    }

    res.json({
      month: rawMonth,
      planDaysElapsed,
      totalPlanDaysInMonth,
      targets,
      totals: {
        calories: buildTotals('calories'),
        protein:  buildTotals('protein'),
        carbs:    buildTotals('carbs'),
        fat:      buildTotals('fat'),
        fibre:    buildTotals('fibre'),
      },
      dailyData,
    });
  } catch (err) {
    console.error('Monthly macros error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/tracker/:date
router.get('/:date', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }
    const mealsPerDay = await getMealsPerDay(userId);

    const logs = await prisma.mealLog.findMany({
      where: { userId, date }
    });

    const meals = Array.from({ length: mealsPerDay }, (_, mealIndex) => {
      const log = logs.find(l => l.mealIndex === mealIndex);
      return { mealIndex, eaten: log?.eaten ?? false };
    });

    const planDates = getPlanDates();
    const dayIndex = planDates.indexOf(date);

    res.json({ date, dayIndex, meals });
  } catch (err) {
    console.error('Tracker date error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to load tracker data.' });
  }
});

// POST /api/tracker/:date/:mealIndex/toggle
router.post('/:date/:mealIndex/toggle', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { date, mealIndex } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }

    const mealIdx = parseInt(mealIndex, 10);

    if (isNaN(mealIdx) || mealIdx < 0 || mealIdx > 5) {
      res.status(400).json({ error: 'Invalid meal index' });
      return;
    }

    const planDates = getPlanDates();
    const dayIndex = planDates.indexOf(date);

    const existing = await prisma.mealLog.findUnique({
      where: { userId_date_mealIndex: { userId, date, mealIndex: mealIdx } }
    });

    let log;
    if (existing) {
      log = await prisma.mealLog.update({
        where: { id: existing.id },
        data: { eaten: !existing.eaten, loggedAt: new Date() }
      });
    } else {
      log = await prisma.mealLog.create({
        data: { userId, date, dayIndex, mealIndex: mealIdx, eaten: true }
      });
    }

    res.json({ mealIndex: mealIdx, eaten: log.eaten, date });
  } catch (err) {
    console.error('Tracker toggle error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Failed to toggle meal.' });
  }
});

export default router;
