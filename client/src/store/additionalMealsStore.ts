// additionalMealsStore — Zustand store for extra meals logged beyond the plan.
// Provides fetch, optimistic-delete, and local-add for AdditionalMealLog entries.

import { create } from 'zustand';
import axios from 'axios';
import { AdditionalMealLog } from '../types';

/** Fields a logged extra meal can be changed to after the fact. */
export interface AdditionalMealPatch {
  servingQty?:   number;
  note?:         string;
  mealCategory?: string;
  mealTime?:     string | null;
}

interface AdditionalMealsState {
  mealsByDate:  Record<string, AdditionalMealLog[]>;
  fetchedDates: Set<string>;

  // Actions
  fetchForDate:         (date: string) => Promise<void>;
  addToLocal:           (meal: AdditionalMealLog) => void;
  deleteAdditionalMeal: (id: string, date: string) => Promise<void>;
  updateAdditionalMeal: (id: string, date: string, patch: AdditionalMealPatch) => Promise<void>;
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

  updateAdditionalMeal: async (id: string, date: string, patch: AdditionalMealPatch) => {
    const original = get().mealsByDate[date] || [];
    const target   = original.find(m => m.id === id);
    if (!target) return;

    // Optimistically scale the macros the same way the server does, so the
    // day's totals move the instant the user saves instead of waiting on the
    // round trip. The server's response is authoritative and replaces this.
    const ratio =
      patch.servingQty !== undefined && target.servingQty > 0
        ? patch.servingQty / target.servingQty
        : 1;
    const optimistic: AdditionalMealLog = {
      ...target,
      ...patch,
      calories: Math.round(target.calories * ratio),
      proteinG: Math.round(target.proteinG * ratio * 10) / 10,
      carbsG:   Math.round(target.carbsG   * ratio * 10) / 10,
      fatG:     Math.round(target.fatG     * ratio * 10) / 10,
      fibreG:   Math.round(target.fibreG   * ratio * 10) / 10,
    };
    set(s => ({
      mealsByDate: { ...s.mealsByDate, [date]: original.map(m => (m.id === id ? optimistic : m)) },
    }));

    try {
      const res = await axios.patch(`/api/meals/additional/${id}`, patch, { withCredentials: true });
      const saved: AdditionalMealLog | undefined = res.data?.additionalMeal;
      if (saved) {
        set(s => ({
          mealsByDate: {
            ...s.mealsByDate,
            [date]: (s.mealsByDate[date] || []).map(m => (m.id === id ? saved : m)),
          },
        }));
      }
    } catch (err) {
      // Revert to the pre-edit list, then let the caller surface the failure.
      set(s => ({ mealsByDate: { ...s.mealsByDate, [date]: original } }));
      throw err;
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
