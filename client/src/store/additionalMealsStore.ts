// additionalMealsStore — Zustand store for extra meals logged beyond the plan.
// Provides fetch, optimistic-delete, and local-add for AdditionalMealLog entries.

import { create } from 'zustand';
import axios from 'axios';
import { AdditionalMealLog } from '../types';

interface AdditionalMealsState {
  mealsByDate:  Record<string, AdditionalMealLog[]>;
  fetchedDates: Set<string>;

  // Actions
  fetchForDate:         (date: string) => Promise<void>;
  addToLocal:           (meal: AdditionalMealLog) => void;
  deleteAdditionalMeal: (id: string, date: string) => Promise<void>;
  getForDate:           (date: string) => AdditionalMealLog[];
  getDayTotals:         (date: string) => { calories: number; protein: number; carbs: number; fat: number; fibre: number };
}

export const useAdditionalMealsStore = create<AdditionalMealsState>((set, get) => ({
  mealsByDate:  {},
  fetchedDates: new Set(),

  fetchForDate: async (date: string) => {
    if (get().fetchedDates.has(date)) return;
    try {
      const res = await axios.get('/api/meals/additional', { params: { date }, withCredentials: true });
      const meals: AdditionalMealLog[] = res.data.additionalMeals || [];
      set(s => ({
        mealsByDate:  { ...s.mealsByDate, [date]: meals },
        fetchedDates: new Set([...s.fetchedDates, date]),
      }));
    } catch {
      // silent — non-critical
    }
  },

  addToLocal: (meal: AdditionalMealLog) => {
    set(s => {
      const existing = s.mealsByDate[meal.date] || [];
      return {
        mealsByDate:  { ...s.mealsByDate, [meal.date]: [...existing, meal] },
        fetchedDates: new Set([...s.fetchedDates, meal.date]),
      };
    });
  },

  deleteAdditionalMeal: async (id: string, date: string) => {
    // Optimistic update
    const original = get().mealsByDate[date] || [];
    set(s => ({
      mealsByDate: { ...s.mealsByDate, [date]: original.filter(m => m.id !== id) },
    }));
    try {
      await axios.delete(`/api/meals/additional/${id}`, { withCredentials: true });
    } catch {
      // Revert on failure
      set(s => ({ mealsByDate: { ...s.mealsByDate, [date]: original } }));
    }
  },

  getForDate: (date: string) => get().mealsByDate[date] || [],

  getDayTotals: (date: string) => {
    const meals = get().mealsByDate[date] || [];
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein:  acc.protein  + m.proteinG,
        carbs:    acc.carbs    + m.carbsG,
        fat:      acc.fat      + m.fatG,
        fibre:    acc.fibre    + m.fibreG,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
    );
  },
}));
