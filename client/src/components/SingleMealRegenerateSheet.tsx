// SingleMealRegenerateSheet — used inside PlanReviewScreen.
// Screen 1 (input): instructions + quick hints → GENERATE OPTIONS
// Screen 2 (options): 3 AI alternatives → SELECT THIS MEAL

import { useState, useCallback } from 'react';
import axios from 'axios';
import { s2 } from '../theme/tokens';
import { Meal } from '../types';

const QUICK_HINTS = [
  'Something light',
  'Quick · under 15 min',
  'No dairy',
  'High protein',
  'Spicy',
  'South Indian',
  'No cooking required',
  'Budget friendly',
  'High fibre',
  'Low carb',
  'Vegetarian',
  'One pot meal',
];

interface MealOption extends Omit<Meal, 'description'> {
  id: string;
  description?: string;
  prepTime?: string;
}

interface Props {
  meal:       Meal;
  mealIndex:  number;
  dayIndex:   number;
  dayName:    string;
  mealPlanId: string;
  onClose:    () => void;
  onSelected: (newMeal: Meal) => void; // called after PATCH succeeds — option cast to Meal
}

function MacroRow({ meal }: { meal: Meal | MealOption }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDimmer }}>
        {Math.round(meal.calories ?? 0)} kcal
      </span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.protein, fontWeight: 500 }}>
        P{Math.round(meal.protein ?? 0)}
      </span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.carbs, fontWeight: 500 }}>
        C{Math.round(meal.carbs ?? 0)}
      </span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.fat, fontWeight: 500 }}>
        F{Math.round(meal.fat ?? 0)}
      </span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.fibre, fontWeight: 500 }}>
        Fi{Math.round((meal as any).fibre ?? 0)}
      </span>
    </div>
  );
}

export function SingleMealRegenerateSheet({
  meal, mealIndex, dayIndex, dayName, mealPlanId, onClose, onSelected,
}: Props) {
  type Screen = 'input' | 'options';
  const [screen, setScreen]             = useState<Screen>('input');
  const [instructions, setInstructions] = useState('');
  const [activeHints, setActiveHints]   = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions]           = useState<MealOption[]>([]);
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [error, setError]               = useState('');

  const toggleHint = (h: string) =>
    setActiveHints(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError('');
    try {
      const res = await axios.post('/api/plan/regenerate-single-meal', {
        mealPlanId, dayIndex, mealIndex,
        instructions: instructions.trim(),
        hints: activeHints,
      }, { withCredentials: true });
      setOptions(res.data.options || []);
      setScreen('options');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate options. Try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [mealPlanId, dayIndex, mealIndex, instructions, activeHints]);

  const handleSelect = async (option: MealOption) => {
    setSavingId(option.id);
    try {
      await axios.patch('/api/plan/select-meal', {
        mealPlanId, dayIndex, mealIndex, newMeal: option,
      }, { withCredentials: true });
      onSelected(option as unknown as Meal);
    } catch {
      setError('Failed to save. Try again.');
      setSavingId(null);
    }
  };

  const mealLabel = `${(meal.type || 'MEAL').toUpperCase()} · ${dayName.toUpperCase()}`;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: s2.bg,
      zIndex: 60,
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 20px',
        borderBottom: `1px solid ${s2.line}`,
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${s2.lineStrong}`,
          width: 36, height: 36, color: s2.text,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11">
            <path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </button>
        <div>
          <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: s2.text }}>
            {screen === 'input' ? 'CHANGE MEAL' : 'PICK A REPLACEMENT'}
          </div>
          <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.textDimmer, marginTop: 2 }}>
            {mealLabel}
          </div>
        </div>
      </div>

      {/* ── Current meal context ── */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${s2.line}`, flexShrink: 0 }}>
        <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>
          Replacing: <span style={{ color: s2.text, fontWeight: 500 }}>{meal.name}</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <MacroRow meal={meal} />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>

        {/* ────────── Screen: INPUT ────────── */}
        {screen === 'input' && (
          <>
            {/* Instructions textarea */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.textDimmer, textTransform: 'uppercase', marginBottom: 10 }}>
                INSTRUCTIONS
              </div>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={`e.g. "Something lighter", "no eggs", "quick to make"…`}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: s2.surface,
                  border: `1px solid ${s2.line}`,
                  color: s2.text, fontFamily: s2.sans, fontSize: 14,
                  padding: '12px 14px', resize: 'none', outline: 'none', lineHeight: 1.6,
                }}
              />
            </div>

            {/* Quick hints */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.textDimmer, textTransform: 'uppercase', marginBottom: 10 }}>
                OR PICK A HINT
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_HINTS.map(hint => {
                  const active = activeHints.includes(hint);
                  return (
                    <button key={hint} onClick={() => toggleHint(hint)} style={{
                      background: active ? s2.accentFill : 'transparent',
                      border: `1px solid ${active ? s2.accent : s2.lineStrong}`,
                      color: active ? s2.accent : s2.textDim,
                      fontFamily: s2.sans, fontSize: 12, letterSpacing: '0.02em',
                      padding: '7px 13px', cursor: 'pointer',
                    }}>
                      {hint}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div style={{ margin: '16px 20px 0', border: `1px solid rgba(255,62,62,0.4)`, background: 'rgba(255,62,62,0.07)', padding: '10px 14px' }}>
                <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.warn }}>{error}</div>
              </div>
            )}
          </>
        )}

        {/* ────────── Screen: OPTIONS ────────── */}
        {screen === 'options' && (
          <div style={{ padding: '20px 20px 0' }}>
            {options.map((option, i) => (
              <div key={option.id || i} style={{
                border: `1px solid ${s2.line}`,
                background: s2.surface,
                padding: 14, marginBottom: 10,
              }}>
                <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.accent, marginBottom: 6 }}>
                  OPTION {i + 1}
                </div>
                <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: s2.text, marginBottom: 4 }}>
                  {option.name}
                </div>
                {option.description && (
                  <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, lineHeight: 1.5, marginBottom: 8 }}>
                    {option.description}
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <MacroRow meal={option} />
                  {option.prepTime && (
                    <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, marginTop: 4, letterSpacing: '0.1em' }}>
                      PREP: {option.prepTime}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSelect(option)}
                  disabled={savingId !== null}
                  style={{
                    width: '100%', padding: '11px 0',
                    background: savingId === option.id ? s2.accentFill : 'transparent',
                    border: `1px solid ${s2.accent}`,
                    color: s2.accent,
                    fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                    cursor: savingId !== null ? 'default' : 'pointer',
                    textTransform: 'uppercase',
                    opacity: savingId !== null && savingId !== option.id ? 0.4 : 1,
                  }}
                >
                  {savingId === option.id ? 'SAVING…' : 'SELECT THIS MEAL'}
                </button>
              </div>
            ))}

            {error && (
              <div style={{ border: `1px solid rgba(255,62,62,0.4)`, background: 'rgba(255,62,62,0.07)', padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.warn }}>{error}</div>
              </div>
            )}

            {/* Regenerate different options */}
            <button
              onClick={() => { setError(''); handleGenerate(); }}
              disabled={isGenerating}
              style={{
                display: 'block', margin: '4px auto 0',
                background: 'transparent', border: 'none',
                fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.18em', color: s2.textDimmer,
                cursor: isGenerating ? 'default' : 'pointer', textTransform: 'uppercase',
              }}
            >
              {isGenerating ? 'GENERATING…' : '↻ GENERATE DIFFERENT OPTIONS'}
            </button>
          </div>
        )}
      </div>

      {/* ── Sticky footer (only on input screen) ── */}
      {screen === 'input' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: s2.bg, borderTop: `1px solid ${s2.lineStrong}`,
          padding: '12px 20px max(env(safe-area-inset-bottom, 0px), 16px)',
        }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{
              width: '100%', padding: '15px 0',
              background: isGenerating ? s2.surface : s2.accentFill,
              border: 'none',
              fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
              color: isGenerating ? s2.textDimmer : s2.ink,
              cursor: isGenerating ? 'default' : 'pointer', textTransform: 'uppercase',
            }}
          >
            {isGenerating ? 'GENERATING…' : 'GENERATE OPTIONS →'}
          </button>
        </div>
      )}
    </div>
  );
}
