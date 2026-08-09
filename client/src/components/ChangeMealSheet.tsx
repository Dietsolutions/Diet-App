// ChangeMealSheet — Strain v2.
// Shared by Feature A (MealsTab ✎ CHANGE MEAL) and Feature B (PlanOverviewScreen ✎ CHANGE).
// Screen 1: free-form instructions + quick hints + rule toggles → APPLY & REGENERATE
// Screen 2: 4 AI-generated options → SELECT THIS MEAL

import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel, TopBar } from './ui';
import { Meal } from '../types';

// ── Consts ─────────────────────────────────────────────────────────────────

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

const PLAN_RULES = [
  { id: 'vegetarian',      label: 'Vegetarian Only' },
  { id: 'no_seafood',      label: 'No Seafood' },
  { id: 'lactose_free',    label: 'Lactose-Free' },
  { id: 'high_protein',    label: 'High-Protein Priority' },
  { id: 'minimize_prep',   label: 'Minimize Prep Time' },
  { id: 'spicy',           label: 'Spicy Meals' },
  { id: 'low_carb',        label: 'Low Carb' },
  { id: 'gluten_free',     label: 'Gluten Free' },
  { id: 'no_nuts',         label: 'No Nuts' },
  { id: 'budget_friendly', label: 'Budget Friendly' },
  { id: 'no_onion_garlic', label: 'No Onion / Garlic' },
  { id: 'quick_cook',      label: 'Under 20 Minutes' },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface GeneratedOption extends Meal {
  prepTime?: string;
}

export interface ChangeMealSheetProps {
  meal: Meal;
  mealIndex: number;
  dayIndex: number;
  onClose: () => void;
  /** Called with the newly saved meal after the user confirms an option. */
  onMealUpdated: (dayIndex: number, mealIndex: number, newMeal: Meal) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Derive initial active rules from user profile */
function deriveInitialRules(profile: any): string[] {
  if (!profile) return [];
  const rules: string[] = [];
  const pref = profile.mealPreference?.toLowerCase() || '';
  if (pref === 'vegetarian' || pref === 'vegan') rules.push('vegetarian');
  const allergies: string[] = Array.isArray(profile.allergies)
    ? profile.allergies
    : (JSON.parse(profile.allergies || '[]') as string[]);
  if (allergies.some(a => /nut/i.test(a)))           rules.push('no_nuts');
  if (allergies.some(a => /gluten|wheat/i.test(a)))  rules.push('gluten_free');
  if (allergies.some(a => /dairy|lactose/i.test(a))) rules.push('lactose_free');
  return rules;
}

// ── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{
      width: 44, height: 24, borderRadius: 12,
      background: on ? s2.accentFill : s2.lineStrong,
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'white',
        position: 'absolute',
        top: 2,
        left: on ? 22 : 2,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

// ── MacroRow (plain coloured text, no pill) ────────────────────────────────

function MacroRow({ calories, protein, carbs, fat, fibre }: {
  calories: number; protein: number; carbs: number; fat: number; fibre: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: s2.textDimmer, fontFamily: s2.mono }}>
        {Math.round(calories)} kcal
      </span>
      <span style={{ fontSize: 12, color: s2.protein, fontWeight: 500, fontFamily: s2.mono }}>
        P{Math.round(protein)}
      </span>
      <span style={{ fontSize: 12, color: s2.carbs, fontWeight: 500, fontFamily: s2.mono }}>
        C{Math.round(carbs)}
      </span>
      <span style={{ fontSize: 12, color: s2.fat, fontWeight: 500, fontFamily: s2.mono }}>
        F{Math.round(fat)}
      </span>
      <span style={{ fontSize: 12, color: s2.fibre, fontWeight: 500, fontFamily: s2.mono }}>
        Fi{Math.round(fibre)}
      </span>
    </div>
  );
}

// ── ChangeMealSheet ────────────────────────────────────────────────────────

export function ChangeMealSheet({
  meal,
  mealIndex,
  dayIndex,
  onClose,
  onMealUpdated,
}: ChangeMealSheetProps) {
  const { profile, setLastShoppingUpdateTime } = useAppStore();

  // ── State ──
  type Screen = 'rules' | 'options';
  const [screen, setScreen]               = useState<Screen>('rules');
  const [instructions, setInstructions]   = useState('');
  const [activeHints, setActiveHints]     = useState<string[]>([]);
  const [activeRules, setActiveRules]     = useState<string[]>(() => deriveInitialRules(profile));
  const [isGenerating, setIsGenerating]   = useState(false);
  const [options, setOptions]             = useState<GeneratedOption[]>([]);
  const [savingIdx, setSavingIdx]         = useState<number | null>(null);
  const [error, setError]                 = useState('');

  // ── Hints ──
  const toggleHint = (hint: string) => {
    setActiveHints(prev =>
      prev.includes(hint) ? prev.filter(h => h !== hint) : [...prev, hint]
    );
  };

  // ── Rules ──
  const toggleRule = (id: string) => {
    setActiveRules(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  // ── Generate options ──
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError('');
    try {
      const res = await axios.post('/api/plan/replace-meal', {
        dayIndex,
        mealIndex,
        currentMeal: meal,
        instructions: instructions.trim(),
        hints: activeHints,
        rules: activeRules,
      }, { withCredentials: true });
      setOptions(res.data.options || []);
      setScreen('options');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate options. Try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [dayIndex, mealIndex, meal, instructions, activeHints, activeRules]);

  // ── Save selected option ──
  const handleSelectOption = async (option: GeneratedOption, idx: number) => {
    setSavingIdx(idx);
    try {
      const res = await axios.patch('/api/plan/replace-meal', {
        dayIndex,
        mealIndex,
        meal: option,
      }, { withCredentials: true });
      // Signal that shopping list is being regenerated in the background
      setLastShoppingUpdateTime(Date.now());
      onMealUpdated(dayIndex, mealIndex, res.data.updatedMeal || option);
      onClose();
    } catch (err: any) {
      setError('Failed to save. Please try again.');
      setSavingIdx(null);
    }
  };

  const mealType = meal.type
    || ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mealIndex]
    || 'Meal';

  // ── Render ──
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: s2.bg,
      zIndex: 55,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Screen: RULES ──────────────────────────────────────────────── */}
      {screen === 'rules' && (
        <>
          <TopBar
            onBack={onClose}
            kicker={`CHANGE MEAL · ${mealType.toUpperCase()} · ${meal.time}`}
          />

          {/* Current meal context */}
          <div style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${s2.line}`,
          }}>
            <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: s2.textDim, lineHeight: 1.3 }}>
              Replacing: <span style={{ color: s2.text }}>{meal.name}</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <MacroRow
                calories={meal.calories} protein={meal.protein}
                carbs={meal.carbs} fat={meal.fat} fibre={meal.fibre ?? 0}
              />
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>

            {/* Free-form instructions */}
            <div style={{ padding: '20px 20px 0' }}>
              <HairLabel style={{ marginBottom: 10 }}>FREE-FORM INSTRUCTIONS</HairLabel>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={`e.g. "Make it eggs-heavy", "avoid rice", "keep it under 15 min"…`}
                rows={4}
                style={{
                  borderRadius: s2.rMd,
                  width: '100%',
                  background: s2.surface,
                  border: `1px solid ${s2.lineStrong}`,
                  padding: '12px 14px',
                  fontFamily: s2.sans,
                  fontSize: 14,
                  color: s2.text,
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.55,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = s2.accent; }}
                onBlur={e  => { e.currentTarget.style.borderColor = s2.lineStrong; }}
              />
            </div>

            {/* Quick hints */}
            <div style={{ padding: '20px 20px 0' }}>
              <HairLabel style={{ marginBottom: 10 }}>OR PICK A HINT</HairLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_HINTS.map(hint => {
                  const on = activeHints.includes(hint);
                  return (
                    <button
                      key={hint}
                      onClick={() => toggleHint(hint)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
                        padding: '9px 14px',
                        fontFamily: s2.sans,
                        fontSize: 13,
                        color: on ? s2.accent : s2.textDim,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {hint}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rule toggles */}
            <div style={{ padding: '20px 20px 0' }}>
              <HairLabel style={{ marginBottom: 4 }}>RULES</HairLabel>
              {PLAN_RULES.map((rule, i) => {
                const isOn = activeRules.includes(rule.id);
                return (
                  <div
                    key={rule.id}
                    onClick={() => toggleRule(rule.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 0',
                      borderBottom: i < PLAN_RULES.length - 1 ? `1px solid ${s2.line}` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontFamily: s2.mono,
                      fontSize: 10,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: isOn ? s2.text : s2.textDimmer,
                      transition: 'color 0.2s',
                    }}>
                      {rule.label}
                    </span>
                    <Toggle on={isOn} />
                  </div>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                margin: '16px 20px 0',
                border: `1px solid rgba(255,62,62,0.4)`,
                background: 'rgba(255,62,62,0.07)',
                padding: '10px 14px',
                fontFamily: s2.sans,
                fontSize: 12,
                color: s2.warn,
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: s2.bg,
            borderTop: `1px solid ${s2.lineStrong}`,
          }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '20px 0',
                background: 'none',
                border: 'none',
                color: isGenerating ? s2.textDimmer : s2.text,
                fontFamily: s2.mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: isGenerating ? 'default' : 'pointer',
                animation: isGenerating ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              {isGenerating ? 'GENERATING…' : 'APPLY & REGENERATE'}
            </button>
          </div>
        </>
      )}

      {/* ── Screen: OPTIONS ────────────────────────────────────────────── */}
      {screen === 'options' && (
        <>
          <TopBar
            onBack={() => setScreen('rules')}
            kicker="SELECT REPLACEMENT MEAL"
          />

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 32px' }}>

            {/* Options */}
            {options.map((option, i) => (
              <div
                key={i}
                style={{
                  borderRadius: s2.rMd,
                  background: s2.surface,
                  border: `1px solid ${s2.line}`,
                  padding: '14px 16px',
                  marginBottom: 10,
                }}
              >
                {/* Option label */}
                <HairLabel color={s2.accent} style={{ marginBottom: 8 }}>
                  OPTION {String(i + 1).padStart(2, '0')}
                  {option.prepTime ? ` · ${option.prepTime}` : ''}
                </HairLabel>

                {/* Name */}
                <div style={{
                  fontFamily: s2.sans,
                  fontSize: 15,
                  fontWeight: 500,
                  color: s2.text,
                  marginBottom: 6,
                  lineHeight: 1.3,
                }}>
                  {option.name}
                </div>

                {/* Description */}
                {option.description && (
                  <div style={{
                    fontFamily: s2.sans,
                    fontSize: 12,
                    color: s2.textDim,
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}>
                    {option.description}
                  </div>
                )}

                {/* Macros */}
                <div style={{ marginBottom: 14 }}>
                  <MacroRow
                    calories={option.calories} protein={option.protein}
                    carbs={option.carbs} fat={option.fat} fibre={option.fibre ?? 0}
                  />
                </div>

                {/* Select button */}
                <button
                  onClick={() => handleSelectOption(option, i)}
                  disabled={savingIdx !== null}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'transparent',
                    border: `1px solid rgba(255,106,42,0.45)`,
                    fontFamily: s2.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: savingIdx === i ? s2.textDimmer : s2.accent,
                    cursor: savingIdx !== null ? 'default' : 'pointer',
                  }}
                >
                  {savingIdx === i ? 'SAVING…' : 'SELECT THIS MEAL'}
                </button>
              </div>
            ))}

            {/* Regenerate link */}
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                onClick={() => { setScreen('rules'); setOptions([]); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: s2.textDimmer,
                  fontFamily: s2.mono,
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                ↺ CHANGE OPTIONS
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 12,
                border: `1px solid rgba(255,62,62,0.4)`,
                background: 'rgba(255,62,62,0.07)',
                padding: '10px 14px',
                fontFamily: s2.sans,
                fontSize: 12,
                color: s2.warn,
              }}>
                {error}
              </div>
            )}
          </div>
        </>
      )}

      {/* Pulse keyframe (inline for this component) */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>
    </div>
  );
}
