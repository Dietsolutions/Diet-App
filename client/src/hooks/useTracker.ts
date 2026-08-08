import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { notifyStreakAchieved } from '../lib/notifications';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function useTracker() {
  const {
    weekData, stats, weekStart,
    setWeekData, setStats, setWeekStart, toggleMealEaten, setMealsPerDay, setPlanDuration
  } = useAppStore();
  const lastNotifiedStreak = useRef(0);

  const loadWeekData = useCallback(async (startDate?: string) => {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.start = startDate;
      const [weekRes, statsRes] = await Promise.all([
        axios.get('/api/tracker/week', { params, withCredentials: true }),
        axios.get('/api/tracker/stats', { withCredentials: true })
      ]);
      // Validate week data is an array of day tracker objects
      const week = weekRes.data.week;
      if (Array.isArray(week) && week.every((d: any) => d && typeof d.date === 'string' && Array.isArray(d.meals))) {
        setWeekData(week);
        setWeekStart(weekRes.data.weekStart);
      } else {
        setWeekData([]);
      }
      // Validate stats data has expected shape
      const stats = statsRes.data;
      if (stats && typeof stats.eaten === 'number' && typeof stats.adherence === 'number') {
        setStats(stats);
        if (stats.mealsPerDay) setMealsPerDay(stats.mealsPerDay);
        if ((weekRes.data as any).planDuration) setPlanDuration((weekRes.data as any).planDuration);

        // Fire streak milestone notification once per milestone per session
        const streak = typeof stats.streak === 'number' ? stats.streak : 0;
        const milestone = STREAK_MILESTONES.find(m => streak >= m && lastNotifiedStreak.current < m);
        if (milestone) {
          lastNotifiedStreak.current = milestone;
          void notifyStreakAchieved(streak);
        }
      } else {
        setStats({ eaten: 0, total: 0, adherence: 0, streak: 0, remaining: 0 });
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  const toggleMeal = useCallback(async (date: string, mealIndex: number, currentEaten: boolean) => {
    toggleMealEaten(date, mealIndex, !currentEaten);
    try {
      await axios.post(`/api/tracker/${date}/${mealIndex}/toggle`, {}, { withCredentials: true });
      const statsRes = await axios.get('/api/tracker/stats', { withCredentials: true });
      setStats(statsRes.data);
    } catch {
      toggleMealEaten(date, mealIndex, currentEaten);
    }
  }, [toggleMealEaten, setStats]);

  // Mark every meal of a day eaten (day-detail "Mark all eaten"). Optimistic, then reloads.
  const markAllEaten = useCallback(async (date: string, mealsPerDay: number) => {
    for (let i = 0; i < mealsPerDay; i++) toggleMealEaten(date, i, true);
    try {
      await axios.post(`/api/tracker/${date}/mark-all-eaten`, {}, { withCredentials: true });
      await loadWeekData(weekStart || undefined);
    } catch {
      await loadWeekData(weekStart || undefined);
    }
  }, [toggleMealEaten, loadWeekData, weekStart]);

  return { weekData, stats, weekStart, toggleMeal, markAllEaten, loadWeekData };
}
