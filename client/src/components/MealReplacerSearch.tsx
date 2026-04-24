// MealReplacerSearch — Strain v2 visual. All logic preserved.

import { useEffect } from 'react';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { FoodResult } from '../types';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

const QUICK_PICKS: { label: string; query: string }[] = [
  { label: 'Boiled eggs',    query: 'boiled eggs' },
  { label: 'Rice + Dal',     query: 'rice dal' },
  { label: 'Banana',         query: 'banana' },
  { label: 'Coffee',         query: 'coffee with milk' },
  { label: 'Protein shake',  query: 'whey protein shake' },
  { label: 'Bread butter',   query: 'bread butter' },
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
  const { target, addMode, addModeDate, addModeCategory, recentFoods, fetchRecentFoods, selectFood, setSearchQuery } = useMealReplacerStore();

  useEffect(() => { fetchRecentFoods(); }, [fetchRecentFoods]);

  const handleQuickPick = (query: string) => { setSearchQuery(query); onQuickPick(query); };

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
        protein:  data.servingGrams ? Math.round(((data.proteinG || 0) / data.servingGrams) * 1000) / 10 : data.proteinG || 0,
        carbs:    data.servingGrams ? Math.round(((data.carbsG  || 0) / data.servingGrams) * 1000) / 10 : data.carbsG  || 0,
        fat:      data.servingGrams ? Math.round(((data.fatG    || 0) / data.servingGrams) * 1000) / 10 : data.fatG    || 0,
        fibre:    data.servingGrams ? Math.round(((data.fibreG  || 0) / data.servingGrams) * 1000) / 10 : data.fibreG  || 0,
      },
      perServing: {
        calories: data.calories || 0, protein: data.proteinG || 0,
        carbs: data.carbsG || 0, fat: data.fatG || 0, fibre: data.fibreG || 0,
      },
      isAiEstimate: data.isAiEstimate || false,
    };
    selectFood(food);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <HairLabel style={{ marginBottom: 6 }}>
          {addMode ? 'ADD MEAL' : 'SWAP MEAL'}
        </HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text }}>
          What did you eat?
        </div>
        {addMode && addModeDate ? (
          <HairLabel color={s2.accent} style={{ marginTop: 4 }}>
            ADDING TO: {CATEGORY_LABELS[addModeCategory || ''] || 'OTHER'} · {addModeDate}
          </HairLabel>
        ) : target ? (
          <HairLabel color={s2.textDim} style={{ marginTop: 4 }}>
            REPLACING: {target.mealName} · {target.date}
          </HairLabel>
        ) : null}
      </div>

      {/* Search box (tap to open results) */}
      <button
        onClick={onSearchFocus}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '13px 14px',
          background: s2.surface,
          border: `1px solid ${s2.lineStrong}`,
          cursor: 'text',
          textAlign: 'left',
          width: '100%',
          color: s2.textDimmer,
        }}
      >
        <span style={{ fontFamily: s2.mono, fontSize: 14, color: s2.accent }}>⌕</span>
        <span style={{ fontFamily: s2.sans, fontSize: 14 }}>Search foods, dishes, ingredients...</span>
      </button>

      {/* Quick picks */}
      <div>
        <HairLabel style={{ marginBottom: 10 }}>QUICK PICKS</HairLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_PICKS.map((p) => (
            <button
              key={p.query}
              onClick={() => handleQuickPick(p.query)}
              style={{
                padding: '7px 12px',
                border: `1px solid ${s2.lineStrong}`,
                background: 'transparent',
                fontFamily: s2.mono,
                fontSize: 9,
                letterSpacing: '0.12em',
                color: s2.textDim,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      {recentFoods.length > 0 && (
        <div>
          <HairLabel style={{ marginBottom: 10 }}>RECENT</HairLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentFoods.slice(0, 5).map((r) => (
              <button
                key={r.id}
                onClick={() => handleRecentSelect(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 12px',
                  background: s2.surface,
                  border: `1px solid ${s2.line}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: s2.text,
                  width: '100%',
                }}
              >
                <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDimmer }}>↺</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: s2.sans, fontSize: 14, color: s2.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.foodName}</div>
                  <HairLabel style={{ marginTop: 2 }}>
                    {r.foodData?.calories || 0} KCAL · {r.foodSource === 'ai_estimate' ? 'AI' : r.foodSource === 'open_food_facts' ? 'OFF' : 'USDA'}
                  </HairLabel>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: s2.line }} />
        <HairLabel>OR</HairLabel>
        <div style={{ flex: 1, height: 1, background: s2.line }} />
      </div>

      {/* AI mode */}
      <button
        onClick={onAIMode}
        style={{
          padding: '16px 14px',
          background: s2.accentFill,
          border: `1px solid ${s2.accent}`,
          textAlign: 'left',
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          color: s2.text,
        }}
      >
        <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent }}>02</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: s2.sans, fontSize: 15, fontWeight: 500, color: s2.text, marginBottom: 4 }}>
            Ask AI to estimate
          </div>
          <HairLabel color={s2.textDim}>DESCRIBE WHAT YOU ATE — AI MATCHES MACROS</HairLabel>
        </div>
        <div style={{ color: s2.accent, alignSelf: 'center' }}>→</div>
      </button>
    </div>
  );
}
