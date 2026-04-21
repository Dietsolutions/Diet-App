// ── MacroBand ─────────────────────────────────────────────────────────────
// Warm horizontal macro summary: 5 equal columns with a thin progress bar,
// consumed value, label, and delta line.
// Dark-theme aware — uses app color palette.

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

// App color palette (dark theme — matches tailwind.config.js)
const C = {
  primary:   '#F0EDE8',  // text-primary
  secondary: '#9A95A0',  // text-secondary
  dimmed:    '#5C5869',  // text-dimmed
  surface:   '#1A1D27',  // surface
  elevated:  '#22263A',  // elevated
  border:    '#2A2D3E',  // border
  success:   '#4CAF82',  // green
  accent:    '#E8845A',  // orange
  red:       '#DC2626',
  amber:     '#F0B429',
};

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

// ── Null-safe helpers ─────────────────────────────────────────────────────
function safe(n: number | undefined | null, fallback = 0): number {
  return (typeof n === 'number' && !isNaN(n)) ? n : fallback;
}

function safeTarget(n: number | undefined | null): number {
  const v = safe(n, 1);
  return v > 0 ? v : 1;
}

// ── 5% buffer helpers ─────────────────────────────────────────────────────
function getDeltaStatus(consumed: number, target: number): 'deficit' | 'on_target' | 'excess' {
  const t = safeTarget(target);
  const pct = safe(consumed) / t;
  if (pct < 0.95)  return 'deficit';
  if (pct <= 1.05) return 'on_target';
  return 'excess';
}

function formatDelta(consumed: number, target: number, unit: string): string {
  const status = getDeltaStatus(consumed, target);
  if (status === 'on_target') return 'on target';
  const delta  = safe(consumed) - safeTarget(target);
  const sign   = delta > 0 ? '+' : '−';
  const amount = Math.abs(Math.round(delta)).toLocaleString();
  const suffix = unit === 'kcal' ? ' kcal' : 'g';
  return `${sign}${amount}${suffix}`;
}

function getDeltaColor(consumed: number, target: number, isDeficitGood: boolean): string {
  const status = getDeltaStatus(consumed, target);
  if (status === 'on_target') return C.dimmed;
  if (isDeficitGood) {
    return status === 'deficit' ? C.success : C.red;
  } else {
    return status === 'deficit' ? C.red : C.amber;
  }
}

function getBarColor(consumed: number, target: number): string {
  const t = safeTarget(target);
  const pct = safe(consumed) / t;
  if (pct > 1.10)  return C.red;     // >110% — over budget
  if (pct >= 0.80) return C.success; // 80–110% — on track
  return C.amber;                     // <80% — under
}

// ── MacroColumn ───────────────────────────────────────────────────────────
function MacroColumn({
  label, consumed, target, unit, isDeficitGood,
}: {
  label: string; consumed: number; target: number;
  unit: string; isDeficitGood: boolean;
}) {
  const c = safe(consumed);
  const t = safeTarget(target);
  const fillPct  = Math.min(c / t, 1);
  const barColor = getBarColor(c, t);
  const isOver   = c > t * 1.05;

  const valueDisplay = unit === 'kcal'
    ? Math.round(c).toLocaleString()
    : `${Math.round(c)}g`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      {/* Progress bar */}
      <div style={{
        width: '100%', height: '5px', borderRadius: '3px',
        background: C.border, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.round(fillPct * 100)}%`, height: '100%', borderRadius: '3px',
          background: barColor, transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Consumed value */}
      <span style={{
        fontSize: '12px', fontWeight: 600, lineHeight: 1,
        color: isOver ? C.red : C.primary,
        fontFamily: 'DM Mono, monospace',
      }}>
        {valueDisplay}
      </span>

      {/* Label */}
      <span style={{ fontSize: '9px', color: C.secondary, textAlign: 'center', lineHeight: 1 }}>
        {unit === 'kcal' ? 'kcal' : label}
      </span>

      {/* Delta line — 5% buffer applied */}
      <span style={{
        fontSize: '9px', fontFamily: 'DM Mono, monospace',
        textAlign: 'center', lineHeight: 1,
        color: getDeltaColor(c, t, isDeficitGood),
      }}>
        {formatDelta(c, t, unit)}
      </span>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────
const DIVIDER = (
  <div style={{
    width: '0.5px',
    background: C.border,
    alignSelf: 'stretch',
  }} />
);

// ── MacroBand ─────────────────────────────────────────────────────────────
export function MacroBand({
  calories, protein, carbs, fat, fibre, mealsEaten, totalMeals,
}: MacroBandProps) {
  const c = safe(calories?.consumed);
  const t = safeTarget(calories?.target);
  const calStatus = getDeltaStatus(c, t);
  const remainingKcal = Math.round(Math.abs(t - c));

  const headerRightColor = calStatus === 'excess' ? C.red : C.success;
  const headerRightText = calStatus === 'on_target'
    ? 'on target'
    : calStatus === 'deficit'
      ? `${remainingKcal.toLocaleString()} kcal left`
      : `+${remainingKcal.toLocaleString()} kcal over`;

  return (
    <div style={{
      background: C.surface,
      borderRadius: '12px',
      border: `0.5px solid ${C.border}`,
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      minHeight: '80px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: C.primary, letterSpacing: '0.2px' }}>
          Today's Macros
        </span>
        <span style={{ fontSize: '10px', color: C.secondary }}>
          {safe(mealsEaten)}/{safe(totalMeals, 1)} meals
          {'\u00A0·\u00A0'}
          <span style={{ color: headerRightColor }}>{headerRightText}</span>
        </span>
      </div>

      {/* 5-column band */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <MacroColumn label="calories" consumed={calories?.consumed} target={calories?.target} unit="kcal" isDeficitGood={DEFICIT_GOOD.calories} />
        {DIVIDER}
        <MacroColumn label="protein"  consumed={protein?.consumed}  target={protein?.target}  unit="g"    isDeficitGood={DEFICIT_GOOD.protein} />
        {DIVIDER}
        <MacroColumn label="carbs"    consumed={carbs?.consumed}    target={carbs?.target}    unit="g"    isDeficitGood={DEFICIT_GOOD.carbs} />
        {DIVIDER}
        <MacroColumn label="fat"      consumed={fat?.consumed}      target={fat?.target}      unit="g"    isDeficitGood={DEFICIT_GOOD.fat} />
        {DIVIDER}
        <MacroColumn label="fibre"    consumed={fibre?.consumed}    target={fibre?.target}    unit="g"    isDeficitGood={DEFICIT_GOOD.fibre} />
      </div>
    </div>
  );
}
