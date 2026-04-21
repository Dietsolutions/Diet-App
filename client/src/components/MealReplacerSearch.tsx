import { useEffect } from 'react';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { FoodResult } from '../types';

const QUICK_PICKS: { emoji: string; label: string; query: string }[] = [
  { emoji: '🥚', label: 'Boiled eggs', query: 'boiled eggs' },
  { emoji: '🍚', label: 'Rice + Dal', query: 'rice dal' },
  { emoji: '🍌', label: 'Banana', query: 'banana' },
  { emoji: '☕', label: 'Coffee', query: 'coffee with milk' },
  { emoji: '🥛', label: 'Protein shake', query: 'whey protein shake' },
  { emoji: '🫓', label: 'Bread butter', query: 'bread butter' },
];

interface Props {
  onSearchFocus: () => void;
  onQuickPick: (query: string) => void;
  onAIMode: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: 'Breakfast', brunch: 'Brunch', lunch: 'Lunch',
  evening_snack: 'Evening Snack', dinner: 'Dinner', other: 'Other',
};

export function MealReplacerSearch({ onSearchFocus, onQuickPick, onAIMode }: Props) {
  const { target, addMode, addModeDate, addModeCategory, recentFoods, fetchRecentFoods, selectFood, setScreen, setSearchQuery } = useMealReplacerStore();

  useEffect(() => {
    fetchRecentFoods();
  }, [fetchRecentFoods]);

  const handleQuickPick = (query: string) => {
    setSearchQuery(query);
    onQuickPick(query);
  };

  const handleRecentSelect = (recent: any) => {
    const data = recent.foodData || {};
    const food: FoodResult = {
      id: `recent-${recent.id}`,
      name: recent.foodName,
      description: '',
      source: recent.foodSource as any,
      servingSizes: [
        { label: data.servingSize || '1 serving', grams: data.servingGrams || 100 },
        { label: '100g', grams: 100 },
      ],
      defaultServing: { label: data.servingSize || '1 serving', grams: data.servingGrams || 100 },
      per100g: {
        calories: data.servingGrams ? Math.round((data.calories / data.servingGrams) * 100) : data.calories || 0,
        protein: data.servingGrams ? Math.round(((data.proteinG || 0) / data.servingGrams) * 1000) / 10 : data.proteinG || 0,
        carbs: data.servingGrams ? Math.round(((data.carbsG || 0) / data.servingGrams) * 1000) / 10 : data.carbsG || 0,
        fat: data.servingGrams ? Math.round(((data.fatG || 0) / data.servingGrams) * 1000) / 10 : data.fatG || 0,
        fibre: data.servingGrams ? Math.round(((data.fibreG || 0) / data.servingGrams) * 1000) / 10 : data.fibreG || 0,
      },
      perServing: {
        calories: data.calories || 0,
        protein: data.proteinG || 0,
        carbs: data.carbsG || 0,
        fat: data.fatG || 0,
        fibre: data.fibreG || 0,
      },
      isAiEstimate: data.isAiEstimate || false,
    };
    selectFood(food);
  };

  return (
    <div className="space-y-5 px-1">
      <div>
        <h3 className="font-display text-lg font-bold text-primary">What did you eat?</h3>
        {addMode && addModeDate ? (
          <p className="text-xs text-secondary font-sans mt-0.5">
            Adding to: <span className="text-violet font-medium">{CATEGORY_LABELS[addModeCategory || ''] || 'Other'}</span> &middot; {addModeDate}
          </p>
        ) : target ? (
          <p className="text-xs text-secondary font-sans mt-0.5">
            Replacing: {target.mealName} &middot; {target.date}
          </p>
        ) : null}
      </div>

      {/* Search box */}
      <div
        onClick={onSearchFocus}
        className="flex items-center gap-2.5 bg-elevated rounded-xl px-3.5 py-3 border border-border cursor-text hover:border-accent/40 transition-colors"
      >
        <span className="text-secondary">🔍</span>
        <span className="text-secondary text-sm font-sans">Search foods, dishes, ingredients...</span>
      </div>

      {/* Quick picks */}
      <div>
        <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-2">Quick picks</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PICKS.map((p) => (
            <button
              key={p.query}
              onClick={() => handleQuickPick(p.query)}
              className="flex items-center gap-1.5 bg-elevated rounded-full px-3 py-1.5 text-sm font-sans text-primary hover:bg-accent/10 transition-colors border border-border"
            >
              <span>{p.emoji}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      {recentFoods.length > 0 && (
        <div>
          <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-2">Recent</p>
          <div className="space-y-1.5">
            {recentFoods.slice(0, 5).map((r) => (
              <button
                key={r.id}
                onClick={() => handleRecentSelect(r)}
                className="w-full flex items-center gap-3 bg-elevated rounded-xl px-3 py-2.5 text-left hover:bg-accent/10 transition-colors border border-border"
              >
                <span className="text-lg">🕐</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-primary truncate">{r.foodName}</p>
                  <p className="text-xs text-secondary font-sans">
                    {r.foodData?.calories || 0} kcal &middot; {r.foodSource === 'ai_estimate' ? 'AI' : r.foodSource === 'open_food_facts' ? 'OFF' : 'USDA'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-dimmed font-sans">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* AI mode */}
      <button
        onClick={onAIMode}
        className="w-full bg-violet/10 border border-violet/20 rounded-xl px-4 py-3.5 text-left hover:bg-violet/15 transition-colors"
      >
        <span className="text-sm font-sans font-semibold text-violet flex items-center gap-2">
          ✨ Describe what you ate — let AI estimate
        </span>
        <p className="text-xs text-secondary font-sans mt-0.5 ml-6">
          e.g. "2 rotis with butter chicken and raita"
        </p>
      </button>
    </div>
  );
}
