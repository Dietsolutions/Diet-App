// PlanOverviewScreen — Feature B. Strain v2.
// Shown immediately after AI plan generation, before entering the app.
// User can review each day, tap ✎ CHANGE on any meal to swap it via AI,
// then tap START MY PLAN to enter the app.

import { useState, useEffect } from 'react';
import axios from 'axios';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';
import { Meal, DayPlan } from '../types';
import { ChangeMealSheet } from './ChangeMealSheet';
import { DayAccordion } from './DayAccordion';

interface PlanOverviewScreenProps {
  /** Called when user taps START MY PLAN or SKIP REVIEW */
  onComplete: () => void;
}

interface PendingChange {
  dayIndex: number;
  mealIndex: number;
  meal: Meal;
}

export function PlanOverviewScreen({ onComplete }: PlanOverviewScreenProps) {
  const [days, setDays]               = useState<DayPlan[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [pending, setPending]         = useState<PendingChange | null>(null);

  // ── Load plan from server on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/plan', { withCredentials: true });
        const raw: DayPlan[] = res.data.days;
        if (Array.isArray(raw) && raw.every(d => d && Array.isArray(d.meals))) {
          setDays(raw);
        } else {
          setError('Plan data looks unexpected. You can still enter the app.');
        }
      } catch {
        setError('Could not load your plan. You can still enter the app.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Apply a local meal update (also reflected in DB via ChangeMealSheet PATCH) ──
  const handleMealUpdated = (dayIndex: number, mealIndex: number, newMeal: Meal) => {
    setDays(prev =>
      prev.map((day, di) => {
        if (di !== dayIndex) return day;
        const meals = [...day.meals];
        meals[mealIndex] = newMeal;
        // Recalculate day total so the accordion header stays accurate
        const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
        return { ...day, meals, totalCalories };
      })
    );
    setPending(null);
  };

  // ── Loading splash ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: s2.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: s2.mono,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: s2.textDimmer,
            textTransform: 'uppercase',
          }}>
            LOADING YOUR PLAN…
          </div>
        </div>
      </div>
    );
  }

  // ── Main screen ──
  return (
    <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 108 }}>

        {/* ── Page header ── */}
        <div style={{ padding: '28px 20px 0' }}>
          <HairLabel>YOUR PLAN IS READY</HairLabel>
          <div style={{
            fontFamily: s2.sans,
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '-0.025em',
            marginTop: 6,
            lineHeight: 1.1,
          }}>
            Review & customise
          </div>
          <div style={{
            fontFamily: s2.sans,
            fontSize: 13,
            color: s2.textDim,
            marginTop: 10,
            lineHeight: 1.55,
          }}>
            Tap{' '}
            <span style={{ fontFamily: s2.mono, fontSize: 11, color: s2.text }}>✎ CHANGE</span>
            {' '}on any meal to get 4 AI alternatives.
          </div>
        </div>

        {/* ── Error banner (non-blocking) ── */}
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

        {/* ── Day accordions ── */}
        <div style={{ padding: '20px 20px 0' }}>
          {days.map((day, di) => (
            <DayAccordion
              key={di}
              day={day}
              dayIndex={day.dayIndex ?? di}
              defaultOpen={di === 0}
              onChangeMeal={(mealIndex, meal) =>
                setPending({ dayIndex: day.dayIndex ?? di, mealIndex, meal })
              }
            />
          ))}

          {days.length === 0 && !error && (
            <div style={{
              border: `1px solid ${s2.line}`,
              background: s2.surface,
              padding: '18px 14px',
              fontFamily: s2.sans,
              fontSize: 13,
              color: s2.textDim,
            }}>
              No plan days found. Tap START MY PLAN to continue.
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky footer CTA ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: s2.bg,
        borderTop: `1px solid ${s2.lineStrong}`,
        padding: '12px 20px max(env(safe-area-inset-bottom, 0px), 16px)',
      }}>
        <button
          onClick={onComplete}
          style={{
            width: '100%',
            padding: '15px 0',
            background: s2.accent,
            border: 'none',
            fontFamily: s2.mono,
            fontSize: 10,
            letterSpacing: '0.2em',
            color: s2.bg,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          START MY PLAN →
        </button>
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <button
            onClick={onComplete}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: s2.mono,
              fontSize: 9,
              letterSpacing: '0.15em',
              color: s2.textDimmer,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            SKIP REVIEW — ENTER APP
          </button>
        </div>
      </div>

      {/* ── ChangeMealSheet overlay ── */}
      {pending && (
        <ChangeMealSheet
          meal={pending.meal}
          mealIndex={pending.mealIndex}
          dayIndex={pending.dayIndex}
          onClose={() => setPending(null)}
          onMealUpdated={handleMealUpdated}
        />
      )}
    </div>
  );
}
