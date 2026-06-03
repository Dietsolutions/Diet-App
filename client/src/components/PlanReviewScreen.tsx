// PlanReviewScreen — shown after plan generation (onboarding) and re-generation (profile).
// User can expand days, tap ↻ CHANGE on any meal to get 3 AI alternatives,
// then tap CONFIRM PLAN → to activate the plan and enter/return to the app.
// No locking. changedMeals is session-only — clears on confirm.

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { s2 } from '../theme/tokens';
import { Meal } from '../types';
import { SingleMealRegenerateSheet } from './SingleMealRegenerateSheet';
import { track, trackPage } from '../lib/analytics';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReviewDay {
  id:            string;
  dayIndex:      number;
  dayName:       string;
  totalCalories: number;
  totalProtein:  number;
  totalCarbs:    number;
  totalFat:      number;
  totalFibre:    number;
  meals:         Meal[];
}

interface ReviewPlan {
  id:             string;
  planDuration:   number;
  weekStartDate:  string;
  weekSummary:    any;
  days:           ReviewDay[];
}

interface SheetState {
  dayIndex:  number;
  mealIndex: number;
  meal:      Meal;
  dayName:   string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function HairLabel({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em',
      color: color || s2.textDimmer, textTransform: 'uppercase', fontWeight: 500,
      ...style,
    }}>
      {children}
    </div>
  );
}

function MacroRow({ cal, p, c, f, fi }: { cal: number; p: number; c: number; f: number; fi: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDimmer }}>{Math.round(cal)} kcal</span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.protein, fontWeight: 500 }}>P{Math.round(p)}</span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.carbs,   fontWeight: 500 }}>C{Math.round(c)}</span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.fat,     fontWeight: 500 }}>F{Math.round(f)}</span>
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.fibre,   fontWeight: 500 }}>Fi{Math.round(fi)}</span>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  /** 'active' or a specific mealPlanId */
  mealPlanId:   string;
  /** Called after confirm-review succeeds — caller does refreshUser + navigation */
  onComplete:   () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PlanReviewScreen({ mealPlanId, onComplete }: Props) {
  const [plan, setPlan]               = useState<ReviewPlan | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [expandedDays, setExpandedDays] = useState<number[]>([0]);
  const [confirming, setConfirming]   = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // Session-only changed-meals map: "dayIndex-mealIndex" → true
  const [changedMeals, setChangedMeals] = useState<Record<string, boolean>>({});

  // Sheet state
  const [sheet, setSheet] = useState<SheetState | null>(null);

  // Track page view once on mount
  useEffect(() => { trackPage('plan_review'); }, []);

  // ── Load plan ──
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`/api/plan/review/${mealPlanId}`, { withCredentials: true });
        setPlan(res.data.plan);
        // First day open by default
        if (res.data.plan?.days?.length) setExpandedDays([res.data.plan.days[0].dayIndex]);
      } catch {
        setError('Could not load your plan. You can still confirm below.');
      } finally {
        setLoading(false);
      }
    })();
  }, [mealPlanId]);

  // ── Day toggle ──
  const toggleDay = (dayIndex: number) =>
    setExpandedDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );

  // ── After a meal is selected in the sheet ──
  const handleMealSelected = useCallback((newMeal: Meal) => {
    if (!sheet) return;
    const key = `${sheet.dayIndex}-${sheet.mealIndex}`;
    track('plan_review_alternative_selected', {
      day_index:  sheet.dayIndex,
      meal_index: sheet.mealIndex,
      meal_type:  sheet.meal.type,
    });
    setChangedMeals(prev => ({ ...prev, [key]: true }));
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(day => {
          if (day.dayIndex !== sheet.dayIndex) return day;
          const meals = [...day.meals];
          meals[sheet.mealIndex] = newMeal;
          const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
          const totalProtein  = meals.reduce((s, m) => s + (m.protein  ?? 0), 0);
          const totalCarbs    = meals.reduce((s, m) => s + (m.carbs    ?? 0), 0);
          const totalFat      = meals.reduce((s, m) => s + (m.fat      ?? 0), 0);
          const totalFibre    = meals.reduce((s, m) => s + ((m as any).fibre ?? 0), 0);
          return { ...day, meals, totalCalories, totalProtein, totalCarbs, totalFat, totalFibre };
        }),
      };
    });
    setSheet(null);
  }, [sheet]);

  // ── Confirm plan ──
  const handleConfirm = async () => {
    setConfirming(true);
    setConfirmError('');
    try {
      await axios.post('/api/plan/confirm-review', { mealPlanId: plan?.id }, { withCredentials: true });
      track('plan_review_confirmed', {
        total_meals_changed: changedCount,
        plan_duration: plan?.planDuration,
      });
      onComplete();
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      const displayMsg = serverMsg
        ? `Could not confirm: ${serverMsg}`
        : `Failed to confirm (${err?.response?.status ?? 'network error'}). Please try again.`;
      console.error('[handleConfirm] error:', err?.response?.data ?? err?.message);
      setConfirmError(displayMsg);
      setConfirming(false);
    }
  };

  // ── Week averages ──
  const weekAvg = plan ? (() => {
    const n = plan.days.length || 1;
    return {
      cal: plan.days.reduce((s, d) => s + d.totalCalories, 0) / n,
      p:   plan.days.reduce((s, d) => s + d.totalProtein,  0) / n,
      c:   plan.days.reduce((s, d) => s + d.totalCarbs,    0) / n,
      f:   plan.days.reduce((s, d) => s + d.totalFat,      0) / n,
      fi:  plan.days.reduce((s, d) => s + d.totalFibre,    0) / n,
    };
  })() : null;

  const changedCount = Object.keys(changedMeals).length;

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: s2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.textDimmer }}>
          LOADING YOUR PLAN…
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 100 }}>

        {/* ── Page header ── */}
        <div style={{ padding: '28px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <HairLabel>YOUR PLAN IS READY</HairLabel>
              <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 300, letterSpacing: '-0.025em', marginTop: 8, lineHeight: 1 }}>
                Review & confirm
              </div>
            </div>
            {plan && (
              <div style={{ textAlign: 'right', paddingBottom: 2 }}>
                <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, color: s2.accent }}>
                  {plan.planDuration}
                </div>
                <HairLabel style={{ marginTop: 3 }}>DAYS</HairLabel>
              </div>
            )}
          </div>

          {/* Instruction line */}
          <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 12, lineHeight: 1.55 }}>
            Tap{' '}
            <span style={{ fontFamily: s2.mono, fontSize: 10, color: s2.text }}>↻ CHANGE</span>
            {' '}on any meal to get 3 AI alternatives.
          </div>
        </div>

        {/* ── AI disclosure ── */}
        <div style={{
          margin: '16px 20px 0',
          padding: '10px 14px',
          background: 'rgba(249,115,22,0.08)',
          border: `1px solid rgba(249,115,22,0.25)`,
          fontFamily: s2.sans, fontSize: 11.5, lineHeight: 1.5, color: s2.textDim,
        }}>
          <strong style={{ color: s2.accent }}>AI-Generated:</strong> This meal plan was created by
          artificial intelligence based on your profile. Always verify ingredients and portions
          align with your dietary needs. Consult a healthcare professional before starting any
          diet program.
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            margin: '16px 20px 0',
            border: `1px solid rgba(255,62,62,0.4)`,
            background: 'rgba(255,62,62,0.07)',
            padding: '10px 14px',
            fontFamily: s2.sans, fontSize: 12, color: s2.warn,
          }}>
            {error}
          </div>
        )}

        {/* ── Week average strip ── */}
        {weekAvg && (
          <div style={{ margin: '20px 20px 0', border: `1px solid ${s2.line}`, background: s2.surface, padding: '12px 14px' }}>
            <HairLabel style={{ marginBottom: 8 }}>WEEK AVERAGE</HairLabel>
            <MacroRow cal={weekAvg.cal} p={weekAvg.p} c={weekAvg.c} f={weekAvg.f} fi={weekAvg.fi} />
          </div>
        )}

        {/* ── Day accordions ── */}
        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(plan?.days ?? []).map((day, di) => {
            const isOpen = expandedDays.includes(day.dayIndex);
            return (
              <div key={day.dayIndex} style={{ border: `1px solid ${s2.line}` }}>

                {/* Day header (toggle row) */}
                <button
                  onClick={() => toggleDay(day.dayIndex)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 14px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Chevron */}
                    <svg
                      width="10" height="10" viewBox="0 0 10 10"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}
                    >
                      <path d="M3 1 L7 5 L3 9" stroke={s2.textDimmer} strokeWidth="1.2" fill="none" />
                    </svg>
                    <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: s2.text }}>
                      {day.dayName.toUpperCase()}
                    </div>
                    <HairLabel color={s2.textDimmer}>· DAY {di + 1}</HairLabel>
                  </div>
                  <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent, fontWeight: 500 }}>
                    {Math.round(day.totalCalories)} kcal
                  </div>
                </button>

                {/* Meals list */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${s2.line}` }}>
                    {day.meals.map((meal, mi) => {
                      const changedKey = `${day.dayIndex}-${mi}`;
                      const isChanged  = !!changedMeals[changedKey];
                      return (
                        <div key={mi} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 14px',
                          borderBottom: mi < day.meals.length - 1 ? `1px solid ${s2.line}` : 'none',
                          background: isChanged ? 'rgba(124,224,196,0.03)' : 'transparent',
                        }}>
                          {/* Meal number */}
                          <span style={{
                            fontFamily: s2.mono, fontSize: 11, color: s2.textDimmer,
                            fontWeight: 600, flexShrink: 0, width: 20,
                          }}>
                            {String(mi + 1).padStart(2, '0')}
                          </span>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.textDimmer }}>
                                {(meal.type || '').toUpperCase()}
                                {meal.time ? ` · ${meal.time}` : ''}
                              </span>
                              {isChanged && (
                                <span style={{
                                  fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.12em',
                                  color: s2.fibre, fontWeight: 600, opacity: 0.8,
                                }}>
                                  ✓ CHANGED
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontFamily: s2.sans, fontSize: 13, fontWeight: 500,
                              color: s2.text, marginBottom: 5,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {meal.name}
                            </div>
                            <MacroRow
                              cal={meal.calories ?? 0}
                              p={meal.protein    ?? 0}
                              c={meal.carbs      ?? 0}
                              f={meal.fat        ?? 0}
                              fi={(meal as any).fibre ?? 0}
                            />
                          </div>

                          {/* Change button — always visible even after change */}
                          <button
                            onClick={() => {
                              track('plan_review_meal_change_tapped', {
                                day_index:  day.dayIndex,
                                meal_index: mi,
                                meal_type:  meal.type,
                              });
                              setSheet({ dayIndex: day.dayIndex, mealIndex: mi, meal, dayName: day.dayName });
                            }}
                            style={{
                              background: 'none', border: 'none',
                              fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em',
                              color: s2.textDimmer, cursor: 'pointer',
                              flexShrink: 0, textTransform: 'uppercase', fontWeight: 600,
                            }}
                          >
                            ↻ CHANGE
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!plan && !error && (
            <div style={{ border: `1px solid ${s2.line}`, padding: '18px 14px', fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>
              No plan days found. Tap CONFIRM PLAN to continue.
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky confirm footer ── */}
      {/* zIndex 40 > BottomNav zIndex 30 — without this the nav bar covers the button
          when PlanReviewScreen is shown from ProfileTab after re-generation (Cause B).
          The footer deliberately covers the BottomNav during the review flow. */}
      <div style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: s2.bg, borderTop: `1px solid ${s2.lineStrong}`,
        padding: '12px 20px max(env(safe-area-inset-bottom, 0px), 16px)',
        zIndex: 40,
      }}>
        {changedCount > 0 && (
          <div style={{ textAlign: 'center', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.textDimmer, marginBottom: 8 }}>
            {changedCount} MEAL{changedCount !== 1 ? 'S' : ''} CHANGED
          </div>
        )}
        {confirmError && (
          <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.warn, textAlign: 'center', marginBottom: 8 }}>
            {confirmError}
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            width: '100%', padding: '15px 0',
            background: confirming ? s2.surface : s2.accent,
            border: 'none',
            fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
            color: confirming ? s2.textDimmer : s2.bg,
            cursor: confirming ? 'default' : 'pointer', textTransform: 'uppercase',
          }}
        >
          {confirming ? 'CONFIRMING…' : 'CONFIRM PLAN →'}
        </button>
      </div>

      {/* ── Single meal regenerate sheet ── */}
      {sheet && (
        <SingleMealRegenerateSheet
          meal={sheet.meal}
          mealIndex={sheet.mealIndex}
          dayIndex={sheet.dayIndex}
          dayName={sheet.dayName}
          mealPlanId={plan?.id ?? mealPlanId}
          onClose={() => setSheet(null)}
          onSelected={handleMealSelected}
        />
      )}
    </div>
  );
}
