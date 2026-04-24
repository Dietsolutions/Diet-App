// AddMealButton — Strain v2. Dashed border button, hidden for future dates.

import { useMealReplacerStore } from '../store/mealReplacerStore';
import { s2 } from '../theme/tokens';

interface Props {
  date: string;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function AddMealButton({ date }: Props) {
  const { openAdder } = useMealReplacerStore();

  if (date > todayStr()) return null;

  return (
    <button
      onClick={() => openAdder(date)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '14px 0',
        background: 'transparent',
        border: `1px dashed ${s2.lineStrong}`,
        fontFamily: s2.mono,
        fontSize: 10,
        letterSpacing: '0.2em',
        color: s2.textDim,
        cursor: 'pointer',
        textTransform: 'uppercase',
        transition: 'border-color 150ms, color 150ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = s2.accent;
        (e.currentTarget as HTMLElement).style.color = s2.accent;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = s2.lineStrong;
        (e.currentTarget as HTMLElement).style.color = s2.textDim;
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      LOG EXTRA MEAL
    </button>
  );
}
