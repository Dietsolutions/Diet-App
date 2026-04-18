// ── MacroBand ─────────────────────────────────────────────────────────────
// Warm horizontal macro summary: 5 equal columns with a thin progress bar,
// value, and muted label. Intentionally warm-toned on both light and dark.

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

const MACRO_BAND_COLORS = {
  calories: '#C4713A',  // terracotta
  protein:  '#2D6A4F',  // dark green
  carbs:    '#8D6A3F',  // warm brown
  fat:      '#B07040',  // mid brown
  fibre:    '#6AAB8A',  // sage green
} as const;

function getBarColor(consumed: number, target: number, base: string): string {
  if (target <= 0) return base;
  const pct = consumed / target;
  if (pct > 1.0)  return '#DC2626';  // red — over target
  if (pct >= 0.8) return base;       // brand colour — on track
  return '#F0B429';                   // amber — under 80%
}

function MacroColumn({
  label, consumed, target, unit, baseColor,
}: {
  label: string; consumed: number; target: number;
  unit: string; baseColor: string;
}) {
  const pct      = target > 0 ? Math.min(consumed / target, 1) : 0;
  const barColor = getBarColor(consumed, target, baseColor);
  const isOver   = consumed > target;

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
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '5px',
        borderRadius: '3px',
        background: '#F0E8D8',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.round(pct * 100)}%`,
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
    </div>
  );
}

const DIVIDER = (
  <div style={{ width: '0.5px', background: '#F0E8D8', alignSelf: 'stretch' }} />
);

export function MacroBand({
  calories, protein, carbs, fat, fibre,
  mealsEaten, totalMeals,
}: MacroBandProps) {
  const remainingKcal = Math.round(calories.target - calories.consumed);
  const isOver        = remainingKcal < 0;

  return (
    <div style={{
      background: 'var(--color-background-primary, #FAF5EE)',
      borderRadius: '12px',
      border: '0.5px solid #E8D8C0',
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
        <MacroColumn
          label="calories" consumed={calories.consumed}
          target={calories.target} unit="kcal"
          baseColor={MACRO_BAND_COLORS.calories}
        />
        {DIVIDER}
        <MacroColumn
          label="protein" consumed={protein.consumed}
          target={protein.target} unit="g"
          baseColor={MACRO_BAND_COLORS.protein}
        />
        {DIVIDER}
        <MacroColumn
          label="carbs" consumed={carbs.consumed}
          target={carbs.target} unit="g"
          baseColor={MACRO_BAND_COLORS.carbs}
        />
        {DIVIDER}
        <MacroColumn
          label="fat" consumed={fat.consumed}
          target={fat.target} unit="g"
          baseColor={MACRO_BAND_COLORS.fat}
        />
        {DIVIDER}
        <MacroColumn
          label="fibre" consumed={fibre.consumed}
          target={fibre.target} unit="g"
          baseColor={MACRO_BAND_COLORS.fibre}
        />
      </div>
    </div>
  );
}
