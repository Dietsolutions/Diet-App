// DayAccordion — Strain v2.
// Collapsible day section used in PlanOverviewScreen (Feature B).
// Shows day header with kcal total; expands to list meals with ✎ CHANGE button.

import { useState } from 'react';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';
import { DayPlan, Meal } from '../types';

export interface DayAccordionProps {
  day: DayPlan;
  dayIndex: number;
  onChangeMeal: (mealIndex: number, meal: Meal) => void;
  defaultOpen?: boolean;
}

export function DayAccordion({
  day,
  dayIndex,
  onChangeMeal,
  defaultOpen = false,
}: DayAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const totalKcal =
    day.totalCalories ??
    day.meals.reduce((s, m) => s + (m.calories ?? 0), 0);

  return (
    <div style={{ border: `1px solid ${s2.line}`, marginBottom: 8 }}>

      {/* ── Header (toggle) ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: open ? s2.surface : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontFamily: s2.mono,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: s2.textDimmer,
            textTransform: 'uppercase',
          }}>
            {String(dayIndex + 1).padStart(2, '0')}
          </span>
          <span style={{
            fontFamily: s2.sans,
            fontSize: 14,
            fontWeight: 500,
            color: s2.text,
          }}>
            {day.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>
            {Math.round(totalKcal)}{' '}
            <span style={{ fontSize: 8 }}>kcal</span>
          </span>
          {/* Chevron */}
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
              color: s2.textDimmer,
            }}
          >
            <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
          </svg>
        </div>
      </button>

      {/* ── Meal list ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${s2.line}` }}>
          {day.meals.map((meal, mi) => {
            const mealType =
              meal.type ||
              ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Snack 2'][mi] ||
              'Meal';

            return (
              <div
                key={mi}
                style={{
                  padding: '10px 14px',
                  borderBottom:
                    mi < day.meals.length - 1
                      ? `1px solid ${s2.line}`
                      : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                {/* Meal info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <HairLabel color={s2.textDimmer} style={{ marginBottom: 3 }}>
                    {mealType.toUpperCase()} · {meal.time}
                  </HairLabel>
                  <div style={{
                    fontFamily: s2.sans,
                    fontSize: 13,
                    color: s2.text,
                    lineHeight: 1.3,
                  }}>
                    {meal.name}
                  </div>
                  <div style={{
                    marginTop: 4,
                    display: 'flex',
                    gap: 8,
                    fontFamily: s2.mono,
                    fontSize: 9,
                  }}>
                    <span style={{ color: s2.textDimmer }}>{meal.calories} kcal</span>
                    <span style={{ color: s2.protein }}>P{meal.protein}</span>
                    <span style={{ color: s2.carbs }}>C{meal.carbs}</span>
                    <span style={{ color: s2.fat }}>F{meal.fat}</span>
                    {(meal.fibre ?? 0) > 0 && (
                      <span style={{ color: s2.fibre }}>Fi{meal.fibre}</span>
                    )}
                  </div>
                </div>

                {/* ✎ CHANGE button */}
                <button
                  onClick={() => onChangeMeal(mi, meal)}
                  style={{
                    borderRadius: s2.rMd,
                    background: 'transparent',
                    border: `1px solid ${s2.lineStrong}`,
                    padding: '6px 10px',
                    fontFamily: s2.mono,
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    color: s2.textDim,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                >
                  ✎ CHANGE
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
