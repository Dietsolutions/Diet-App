// Data hooks for the Browse Recipes tab — plain axios + local state, matching
// the app's existing hook pattern (no React Query).

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Recipe, RecipeFilters } from '../types';
import { useAppStore } from '../store/appStore';

export const DEFAULT_FILTERS: RecipeFilters = {
  mealType: 'all',
  dietType: 'all',
  q:        '',
  sortBy:   'likes',
  sortDir:  'desc',
};

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 350;

function buildParams(filters: RecipeFilters, page: number): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page, pageSize: PAGE_SIZE,
    sortBy: filters.sortBy, sortDir: filters.sortDir,
  };
  if (filters.mealType !== 'all') params.mealType = filters.mealType;
  if (filters.dietType !== 'all') params.dietType = filters.dietType;
  if (filters.q.trim())           params.q        = filters.q.trim();
  for (const k of ['minCal', 'maxCal', 'minProtein', 'maxProtein', 'minCarbs',
                   'maxCarbs', 'minFat', 'maxFat', 'minFibre', 'maxFibre'] as const) {
    const v = filters[k];
    if (typeof v === 'number' && Number.isFinite(v)) params[k] = v;
  }
  return params;
}

/**
 * Paginated, debounced recipe list. Filter changes reset to page 1;
 * loadMore() appends the next page.
 */
export function useRecipes(filters: RecipeFilters) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const requestSeq = useRef(0);

  const fetchPage = useCallback(async (filtersArg: RecipeFilters, pageArg: number, append: boolean) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/recipes', {
        params: buildParams(filtersArg, pageArg),
        withCredentials: true,
      });
      if (seq !== requestSeq.current) return;   // stale response — newer request in flight
      setTotal(res.data.total ?? 0);
      setPage(pageArg);
      setRecipes(prev => append ? [...prev, ...res.data.recipes] : res.data.recipes);
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      setError(e?.response?.data?.error || 'Failed to load recipes');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Debounced refetch on any filter change (text + sliders share the debounce)
  useEffect(() => {
    const t = setTimeout(() => { fetchPage(filters, 1, false); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [JSON.stringify(filters), fetchPage]);   // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    fetchPage(filters, page + 1, true);
  }, [fetchPage, filters, page]);

  const hasMore = recipes.length < total;

  /** Patch one recipe in the cached list (used for optimistic like updates). */
  const patchRecipe = useCallback((id: string, patch: Partial<Recipe>) => {
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);

  return { recipes, total, loading, error, hasMore, loadMore, patchRecipe };
}

/** Single recipe detail. */
export function useRecipe(id: string | null) {
  const [recipe, setRecipe]   = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setRecipe(null); return; }
    let cancelled = false;
    setLoading(true);
    axios.get(`/api/recipes/${id}`, { withCredentials: true })
      .then(res => { if (!cancelled) setRecipe(res.data); })
      .catch(() => { if (!cancelled) setRecipe(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { recipe, loading, setRecipe };
}

/**
 * Optimistic like toggle. Returns the new liked state immediately; reconciles
 * (rolls back) if the server call fails.
 */
export function useToggleLike() {
  return useCallback(async (
    recipe: Pick<Recipe, 'id' | 'likedByMe' | 'likeCount'>,
    applyPatch: (patch: { likedByMe: boolean; likeCount: number }) => void,
  ) => {
    const liking = !recipe.likedByMe;
    const optimistic = {
      likedByMe: liking,
      likeCount: Math.max(0, recipe.likeCount + (liking ? 1 : -1)),
    };
    applyPatch(optimistic);
    try {
      if (liking) await axios.post(`/api/recipes/${recipe.id}/like`, {}, { withCredentials: true });
      else        await axios.delete(`/api/recipes/${recipe.id}/like`, { withCredentials: true });
    } catch {
      applyPatch({ likedByMe: recipe.likedByMe, likeCount: recipe.likeCount });   // roll back
    }
  }, []);
}

/** Share helper: native share sheet on mobile, clipboard fallback on desktop. */
export function useShareRecipe() {
  return useCallback(async (recipeId: string): Promise<'shared' | 'copied' | 'failed'> => {
    try {
      const res = await axios.get(`/api/recipes/${recipeId}/share`, { withCredentials: true });
      const { url, text, title } = res.data;
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return 'shared';
        } catch (err: any) {
          if (err?.name === 'AbortError') return 'shared';   // user dismissed the sheet
          // fall through to clipboard
        }
      }
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }, []);
}

/**
 * Save a recipe into a day/slot of the user's active plan, then refresh the
 * cached plan so MealsTab / TrackerTab show the change immediately.
 */
export function useSaveRecipeToPlan() {
  const { setPlanDays, setMealsPerDay } = useAppStore();
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (
    recipeId: string, mealPlanId: string, dayIndex: number, mealIndex: number,
  ): Promise<{ ok: boolean; error?: string }> => {
    setSaving(true);
    try {
      await axios.post(`/api/recipes/${recipeId}/save-to-plan`,
        { mealPlanId, dayIndex, mealIndex },
        { withCredentials: true },
      );
      // Refresh the cached plan (same source as usePlan.loadPlan)
      try {
        const res = await axios.get('/api/plan', { withCredentials: true });
        const days = res.data.days;
        if (Array.isArray(days)) {
          setPlanDays(days, res.data.isGenerated || false);
          if (days.length > 0 && days[0].meals) setMealsPerDay(days[0].meals.length);
        }
      } catch { /* plan refresh is best-effort */ }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.response?.data?.error || 'Failed to save to plan' };
    } finally {
      setSaving(false);
    }
  }, [setPlanDays, setMealsPerDay]);

  return { save, saving };
}
