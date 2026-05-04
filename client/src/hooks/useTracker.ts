import { useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAppStore } from '../store/appStore';

export function useTracker() {
  const {
    weekData, stats, weekStart,
    setWeekData, setStats, setWeekStart, toggleMealEaten, setMealsPerDay, setPlanDuration
  } = useAppStore();

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
        if (stats.mealsPerDay) {
          setMealsPerDay(stats.mealsPerDay);
        }
        if ((weekRes.data as any).planDuration) {
          setPlanDuration((weekRes.data as any).planDuration);
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

  return { weekData, stats, weekStart, toggleMeal, loadWeekData };
}
