// AddMealButton — Fresh Light dark card. Hidden for future dates.

import { useMealReplacerStore } from '../store/mealReplacerStore';
import { s2 } from '../theme/tokens';

interface Props {
  date: string;
}

// Local-timezone date — must match how selectedDate is computed in MealsTab (date-fns format).
// new Date().toISOString() gives UTC, which lags IST by 5h30m and makes this button
// vanish between midnight and 05:30 IST every day.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AddMealButton({ date }: Props) {
  const { openAdder } = useMealReplacerStore();

  if (date > todayStr()) return null;

  return (
    <button
      onClick={() => openAdder(date)}
      style={{
        // Card, not a dashed outline: everything else on this tab is a filled
        // rounded block, so the dashed rectangle read as an unstyled fallback
        // sitting at the end of the day rather than part of the same set.
        borderRadius: s2.rLg,
        width: '100%',
        background: s2.ink,
        border: 'none',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: '0 10px 24px rgba(15,20,15,0.16)',
      }}
    >
      {/* Lime + badge */}
      <span
        style={{
          borderRadius: s2.rPill,
          width: 34,
          height: 34,
          flexShrink: 0,
          background: s2.accentFill,
          color: s2.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: s2.sans,
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        +
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: s2.sans,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: s2.onDark,
          }}
        >
          Log extra meal
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: s2.sans,
            fontSize: 11.5,
            color: s2.onDarkDim,
            marginTop: 2,
          }}
        >
          Anything you ate outside the plan
        </span>
      </span>

      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M5 2.5 L9.5 7 L5 11.5" stroke={s2.onDarkDimmer} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
