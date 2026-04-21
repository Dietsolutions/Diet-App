import { useState } from 'react';
import axios from 'axios';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { AIFoodComponent } from '../types';

interface Props {
  onBack: () => void;
}

export function MealReplacerAI({ onBack }: Props) {
  const { target, addMode, addModeDate, addModeCategory, submitReplacement, closeReplacer, setScreen } = useMealReplacerStore();
  const [description, setDescription] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    breakdown: AIFoodComponent[];
    totals: { calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number };
    confidenceNote: string;
  } | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  const handleEstimate = async () => {
    if (description.trim().length < 3) return;
    setIsEstimating(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post(
        '/api/food/ai-estimate',
        { description: description.trim() },
        { withCredentials: true }
      );
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'AI estimation failed');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleLog = async () => {
    if (!result) return;
    setIsLogging(true);
    setError('');

    try {
      if (addMode && addModeDate) {
        // ── Add-mode: log as additional meal ──────────────────────────────
        const res = await axios.post(
          '/api/meals/additional',
          {
            date: addModeDate,
            mealCategory: addModeCategory || 'other',
            mealTime: null,
            foodName: description.trim(),
            foodSource: 'ai_estimate',
            servingSize: '1 meal',
            servingQty: 1,
            servingGrams: null,
            calories: result.totals.calories,
            proteinG: result.totals.proteinG,
            carbsG: result.totals.carbsG,
            fatG: result.totals.fatG,
            fibreG: result.totals.fibreG,
            note: '',
            isAiEstimate: true,
          },
          { withCredentials: true }
        );
        useAdditionalMealsStore.getState().addToLocal(res.data.additionalMeal);
        closeReplacer();
      } else {
        // ── Replace-mode: log as meal replacement ─────────────────────────
        if (!target) return;
        await axios.post(
          '/api/meals/replace',
          {
            date: target.date,
            dayIndex: target.dayIndex,
            mealIndex: target.mealIndex,
            foodName: description.trim(),
            foodSource: 'ai_estimate',
            servingSize: '1 meal',
            servingQty: 1,
            servingGrams: null,
            calories: result.totals.calories,
            proteinG: result.totals.proteinG,
            carbsG: result.totals.carbsG,
            fatG: result.totals.fatG,
            fibreG: result.totals.fibreG,
            note: '',
            isAiEstimate: true,
          },
          { withCredentials: true }
        );
        const { fetchReplacementsForWeek } = useMealReplacerStore.getState();
        await fetchReplacementsForWeek();
        closeReplacer();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to log meal');
      setIsLogging(false);
    }
  };

  return (
    <div className="space-y-5 px-1">
      <button onClick={onBack} className="text-accent text-sm font-sans font-semibold">
        ← Back
      </button>

      <div>
        <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
          ✨ Describe your meal
        </h3>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder='e.g. "2 rotis with butter chicken and a small bowl of raita"'
        className="w-full bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm font-sans text-primary placeholder-dimmed outline-none focus:border-accent/40 transition-colors resize-none"
        rows={3}
      />

      {!result && (
        <button
          onClick={handleEstimate}
          disabled={isEstimating || description.trim().length < 3}
          className="w-full bg-violet text-white font-semibold font-sans py-3 rounded-[14px] text-sm active:scale-95 transition-all disabled:opacity-50"
        >
          {isEstimating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Estimating...
            </span>
          ) : (
            'Estimate Macros with AI'
          )}
        </button>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 text-sm px-3 py-2 rounded-xl font-sans">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Breakdown */}
          <div className="bg-surface rounded-xl border border-border p-3 space-y-2">
            {result.breakdown.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm font-sans">
                <span className="text-accent mt-0.5">•</span>
                <div className="flex-1">
                  <p className="text-primary font-medium">
                    {item.name}
                    {item.portionDescription && (
                      <span className="text-secondary font-normal"> — {item.portionDescription}</span>
                    )}
                  </p>
                  <p className="text-xs text-secondary font-mono">
                    {item.calories} kcal &middot; P:{item.proteinG}g &middot; C:{item.carbsG}g &middot; F:{item.fatG}g &middot; Fi:{item.fibreG}g
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-surface rounded-xl border border-border p-3">
            <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-1">Total</p>
            <p className="text-xl font-bold font-mono text-primary">
              {result.totals.calories} <span className="text-sm text-secondary">kcal</span>
            </p>
            <div className="flex gap-3 mt-1 text-xs font-mono">
              <span className="text-success">P:{result.totals.proteinG}g</span>
              <span className="text-accent">C:{result.totals.carbsG}g</span>
              <span className="text-violet">F:{result.totals.fatG}g</span>
              <span className="text-fibre">Fi:{result.totals.fibreG}g</span>
            </div>
          </div>

          <p className="text-[10px] text-dimmed font-sans text-center">
            {result.confidenceNote || 'AI estimates — accuracy may vary ±20-25%'}
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleLog}
              disabled={isLogging}
              className="flex-1 bg-accent text-white font-semibold font-sans py-3 rounded-[14px] text-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {isLogging ? 'Logging...' : addMode ? 'Add to My Day' : 'Log This Meal'}
            </button>
            <button
              onClick={() => {
                setResult(null);
                setScreen('results');
              }}
              className="flex-1 bg-elevated text-secondary font-medium font-sans py-3 rounded-[14px] text-sm border border-border hover:bg-elevated/80 transition-colors"
            >
              Search manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
