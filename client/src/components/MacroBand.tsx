// ── MacroBand ─────────────────────────────────────────────────────────────
// Warm horizontal macro summary: 5 equal columns with a thin progress bar,
// consumed value, label, and delta line.

export interface MacroBandProps {
  calories:   { consumed: number; target: number }
  protein:    { consumed: number; target: number }
  carbs:      { consumed: number; target: number }
  fat:        { consumed: number; target: number }
  fibre:      { consumed: number; target: number }
  date:       string   // "YYYY-MM-DD"
  mealsEaten: number
  totalMeals: number
}

// ── 1b colour thresholds (80 / 110) ───────────────────────────────────────
function getBarColor(consumed: number, target: number): string {
  if (target <= 0) return '#2D6A4F';
  const pct = consumed / target;
  if (pct > 1.10)  return '#DC2626'; // red    — above 110%
  if (pct >= 0.80) return '#2D6A4F'; // green  — 80–110%
  return '#F0B429';                   // amber  — below 80%
}

// ── 1a delta formatting ───────────────────────────────────────────────────
function formatDelta(delta: number, unit: string): string {
  if (Math.abs(delta) < 1) return 'on target';
  const sign   = delta > 0 ? '+' : '−';
  const amount = Math.abs(Math.round(delta)).toLocaleString();
  const suffix = unit === 'kcal' ? ' kcal' : 'g';
  return `${sign}${amount}${suffix}`;
}

function deltaColor(delta: number): string {
  if (Math.abs(delta) < 1) return '#B09070'; // on target — muted
  if (delta < 0) return '#2D6A4F';           // deficit   — green
  return '#DC2626';                           // excess    — red
}

// ── MacroColumn ───────────────────────────────────────────────────────────
function MacroColumn({
  label, consumed, target, unit,
}: {
  label: string; consumed: number; target: number; unit: string;
}) {
  // Visual bar capped at 100%; colour based on real (uncapped) ratio
  const fillPct  = target > 0 ? Math.min(consumed / target, 1) : 0;
  const barColor = getBarColor(consumed, target);
  const isOver   = consumed > target;
  const delta    = consumed - target;

  const valueDisplay = unit === 'kcal'
    ? Math.round(consumed).toLocaleString()
    : `${Math.round(consumed)}g`;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      {/* Progress bar — 1c: track uses CSS var */}
      <div style={{
        width: '100%',
        height: '5px',
        borderRadius: '3px',
        background: 'var(--color-background-tertiary, #2A2D3E)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.round(fillPct * 100)}%`,
          height: '100%',
          borderRadius: '3px',
          background: barColor,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Consumed value */}
      <span style={{
        fontSize: '12px',
        fontWeight: 500,
        color: isOver ? '#DC2626' : '#3D2B0F',
        fontFamily: 'DM Mono, monospace',
        lineHeight: 1,
      }}>
        {valueDisplay}
      </span>

      {/* Label */}
      <span style={{
        fontSize: '9px',
        color: '#B09070',
        textAlign: 'center',
        lineHeight: 1,
      }}>
        {unit === 'kcal' ? 'kcal' : label}
      </span>

      {/* 1a — delta line */}
      <span style={{
        fontSize: '9px',
        color: deltaColor(delta),
        fontFamily: 'DM Mono, monospace',
        textAlign: 'center',
        lineHeight: 1,
      }}>
        {formatDelta(delta, unit)}
      </span>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────
// 1c: uses CSS var for divider colour
const DIVIDER = (
  <div style={{
    width: '0.5px',
    background: 'var(--color-border-tertiary, #2A2D3E)',
    alignSelf: 'stretch',
  }} />
);

// ── MacroBand ─────────────────────────────────────────────────────────────
export function MacroBand({
  calories, protein, carbs, fat, fibre,
  mealsEaten, totalMeals,
}: MacroBandProps) {
  const remainingKcal = Math.round(calories.target - calories.consumed);
  const isOver        = remainingKcal < 0;

  return (
    // 1c: outer card uses CSS vars for bg + border
    <div style={{
      background: 'var(--color-background-secondary, #1A1D27)',
      borderRadius: '12px',
      border: '0.5px solid var(--color-border-tertiary, #2A2D3E)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#3D2B0F' }}>
          Today's Macros
        </span>
        <span style={{ fontSize: '10px', color: '#B09070' }}>
          {mealsEaten}/{totalMeals} meals
          {'\u00A0·\u00A0'}
          <span style={{ color: isOver ? '#DC2626' : '#2D6A4F' }}>
            {isOver
              ? `${Math.abs(remainingKcal).toLocaleString()} kcal over`
              : `${remainingKcal.toLocaleString()} kcal left`}
          </span>
        </span>
      </div>

      {/* 5-column band */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <MacroColumn label="calories" consumed={calories.consumed} target={calories.target} unit="kcal" />
        {DIVIDER}
        <MacroColumn label="protein"  consumed={protein.consumed}  target={protein.target}  unit="g" />
        {DIVIDER}
        <MacroColumn label="carbs"    consumed={carbs.consumed}    target={carbs.target}    unit="g" />
        {DIVIDER}
        <MacroColumn label="fat"      consumed={fat.consumed}      target={fat.target}      unit="g" />
        {DIVIDER}
        <MacroColumn label="fibre"    consumed={fibre.consumed}    target={fibre.target}    unit="g" />
      </div>
    </div>
  );
}
