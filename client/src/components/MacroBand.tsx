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

// ── Per-macro deficit direction ────────────────────────────────────────────
// true  = being under target is GOOD (fat loss: cal/carbs/fat)
// false = being under target is BAD  (need more: protein/fibre)
const DEFICIT_GOOD: Record<string, boolean> = {
  calories: true,
  protein:  false,
  carbs:    true,
  fat:      true,
  fibre:    false,
};

// ── 5% buffer helpers ─────────────────────────────────────────────────────
function getDeltaStatus(consumed: number, target: number): 'deficit' | 'on_target' | 'excess' {
  if (target <= 0) return 'on_target';
  const pct = consumed / target;
  if (pct < 0.95)  return 'deficit';   // more than 5% under
  if (pct <= 1.05) return 'on_target'; // within ±5%
  return 'excess';                      // more than 5% over
}

function formatDelta(consumed: number, target: number, unit: string): string {
  const status = getDeltaStatus(consumed, target);
  if (status === 'on_target') return 'on target';
  const delta  = consumed - target;
  const sign   = delta > 0 ? '+' : '−';
  const amount = Math.abs(Math.round(delta)).toLocaleString();
  const suffix = unit === 'kcal' ? ' kcal' : 'g';
  return `${sign}${amount}${suffix}`;
}

function getDeltaColor(consumed: number, target: number, isDeficitGood: boolean): string {
  const status = getDeltaStatus(consumed, target);
  if (status === 'on_target') return '#B09070'; // muted — neutral
  if (isDeficitGood) {
    // cal/carbs/fat: under = good (green), over = bad (red)
    return status === 'deficit' ? '#2D6A4F' : '#DC2626';
  } else {
    // protein/fibre: under = bad (red), over = not critical (amber)
    return status === 'deficit' ? '#DC2626' : '#F0B429';
  }
}

// ── Bar colour: 80/110 thresholds (unchanged from previous) ───────────────
function getBarColor(consumed: number, target: number): string {
  if (target <= 0) return '#2D6A4F';
  const pct = consumed / target;
  if (pct > 1.10)  return '#DC2626'; // red    — above 110%
  if (pct >= 0.80) return '#2D6A4F'; // green  — 80–110% (includes 5% buffer)
  return '#F0B429';                   // amber  — below 80%
}

// ── MacroColumn ───────────────────────────────────────────────────────────
function MacroColumn({
  label, consumed, target, unit, isDeficitGood,
}: {
  label: string; consumed: number; target: number;
  unit: string; isDeficitGood: boolean;
}) {
  const fillPct  = target > 0 ? Math.min(consumed / target, 1) : 0;
  const barColor = getBarColor(consumed, target);
  const isOver   = consumed > target;

  const valueDisplay = unit === 'kcal'
    ? Math.round(consumed).toLocaleString()
    : `${Math.round(consumed)}g`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      {/* Progress bar */}
      <div style={{
        width: '100%', height: '5px', borderRadius: '3px',
        background: 'var(--color-background-tertiary, #2A2D3E)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.round(fillPct * 100)}%`, height: '100%', borderRadius: '3px',
          background: barColor, transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Consumed value */}
      <span style={{
        fontSize: '12px', fontWeight: 500, lineHeight: 1,
        color: isOver ? '#DC2626' : '#3D2B0F',
        fontFamily: 'DM Mono, monospace',
      }}>
        {valueDisplay}
      </span>

      {/* Label */}
      <span style={{ fontSize: '9px', color: '#B09070', textAlign: 'center', lineHeight: 1 }}>
        {unit === 'kcal' ? 'kcal' : label}
      </span>

      {/* Delta line — 5% buffer applied */}
      <span style={{
        fontSize: '9px', fontFamily: 'DM Mono, monospace',
        textAlign: 'center', lineHeight: 1,
        color: getDeltaColor(consumed, target, isDeficitGood),
      }}>
        {formatDelta(consumed, target, unit)}
      </span>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────
const DIVIDER = (
  <div style={{
    width: '0.5px',
    background: 'var(--color-border-tertiary, #2A2D3E)',
    alignSelf: 'stretch',
  }} />
);

// ── MacroBand ─────────────────────────────────────────────────────────────
export function MacroBand({
  calories, protein, carbs, fat, fibre, mealsEaten, totalMeals,
}: MacroBandProps) {
  const calStatus = getDeltaStatus(calories.consumed, calories.target);
  const remainingKcal = Math.round(Math.abs(calories.target - calories.consumed));

  const headerRightColor = calStatus === 'excess' ? '#DC2626' : '#2D6A4F';
  const headerRightText = calStatus === 'on_target'
    ? 'on target'
    : calStatus === 'deficit'
      ? `${remainingKcal.toLocaleString()} kcal left`
      : `+${remainingKcal.toLocaleString()} kcal over`;

  return (
    <div style={{
      background: 'var(--color-background-secondary, #1A1D27)',
      borderRadius: '12px',
      border: '0.5px solid var(--color-border-tertiary, #2A2D3E)',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#3D2B0F' }}>
          Today's Macros
        </span>
        <span style={{ fontSize: '10px', color: '#B09070' }}>
          {mealsEaten}/{totalMeals} meals
          {'\u00A0·\u00A0'}
          <span style={{ color: headerRightColor }}>{headerRightText}</span>
        </span>
      </div>

      {/* 5-column band */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <MacroColumn label="calories" consumed={calories.consumed} target={calories.target} unit="kcal" isDeficitGood={DEFICIT_GOOD.calories} />
        {DIVIDER}
        <MacroColumn label="protein"  consumed={protein.consumed}  target={protein.target}  unit="g"    isDeficitGood={DEFICIT_GOOD.protein} />
        {DIVIDER}
        <MacroColumn label="carbs"    consumed={carbs.consumed}    target={carbs.target}    unit="g"    isDeficitGood={DEFICIT_GOOD.carbs} />
        {DIVIDER}
        <MacroColumn label="fat"      consumed={fat.consumed}      target={fat.target}      unit="g"    isDeficitGood={DEFICIT_GOOD.fat} />
        {DIVIDER}
        <MacroColumn label="fibre"    consumed={fibre.consumed}    target={fibre.target}    unit="g"    isDeficitGood={DEFICIT_GOOD.fibre} />
      </div>
    </div>
  );
}
