// MacroBand — Fresh Light lime hero: calorie ring + macro ticks. (ref: V3Meals hero)
// Original data-layer logic preserved; props unchanged.

import { s2 } from '../theme/tokens';
import { HairLabel, Card, Ring } from './ui';

export interface MacroBandProps {
  calories: { consumed: number; target: number };
  protein:  { consumed: number; target: number };
  carbs:    { consumed: number; target: number };
  fat:      { consumed: number; target: number };
  fibre:    { consumed: number; target: number };
  date:     string;   // "YYYY-MM-DD"
  mealsEaten: number;
  totalMeals: number;
}

// ── Null-safe helpers (unchanged from previous version) ────────────────────
function safe(n: number | undefined | null, fallback = 0): number {
  return typeof n === 'number' && !isNaN(n) ? n : fallback;
}
function safeTarget(n: number | undefined | null): number {
  const v = safe(n, 1);
  return v > 0 ? v : 1;
}

// ── Macro tick (ref: V3MacroTick) ──────────────────────────────────────────
function MacroTick({ color, value, label, sub }: { color: string; value: string; label: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 5, height: 26, borderRadius: s2.rPill, background: color }} />
      <div>
        <div style={{ fontFamily: s2.disp, fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: s2.ink }}>
          {value}
          <span style={{ fontFamily: s2.sans, fontSize: 11, fontWeight: 600, color: 'rgba(15,20,15,0.56)', marginLeft: 5 }}>{label}</span>
        </div>
        <div style={{ fontFamily: s2.sans, fontSize: 10, fontWeight: 600, color: 'rgba(15,20,15,0.4)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Tick colours — graded ink, per the reference hero ──────────────────────
const TICKS = [
  { key: 'protein', label: 'g protein', color: '#0F140F' },
  { key: 'carbs',   label: 'g carbs',   color: 'rgba(15,20,15,0.55)' },
  { key: 'fat',     label: 'g fat',     color: 'rgba(15,20,15,0.35)' },
  { key: 'fibre',   label: 'g fibre',   color: 'rgba(15,20,15,0.2)' },
] as const;

// ── MacroBand ──────────────────────────────────────────────────────────────
export function MacroBand({
  calories, protein, carbs, fat, fibre, mealsEaten, totalMeals,
}: MacroBandProps) {
  const cal    = safe(calories?.consumed);
  const tCal   = safeTarget(calories?.target);
  const calPct = Math.round((cal / tCal) * 100);
  const left   = Math.round(tCal - cal);

  const macroData: Record<string, { consumed: number; target: number }> = {
    protein, carbs, fat, fibre,
  };

  return (
    <Card bg={s2.accentFill} radius={s2.rXl} padding={20}>
      {/* Header: eaten count + calorie percentage */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <HairLabel color="rgba(15,20,15,0.5)">
          {mealsEaten} OF {totalMeals} EATEN
        </HairLabel>
        <span style={{
          fontFamily: s2.sans, fontSize: 10.5, fontWeight: 700,
          background: 'rgba(15,20,15,0.10)', color: cal > tCal ? s2.warn : s2.ink,
          borderRadius: s2.rPill, padding: '5px 10px',
        }}>
          {Math.min(calPct, 999)}%
        </span>
      </div>

      {/* Ring + macro ticks */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
        <Ring pct={Math.min(cal / tCal, 1)} size={132} thick={13} color={s2.ink} track="rgba(15,20,15,0.14)">
          <div>
            <div style={{ fontFamily: s2.disp, fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: s2.ink }}>
              {Math.round(cal).toLocaleString()}
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 10, fontWeight: 700, color: 'rgba(15,20,15,0.55)', marginTop: 3 }}>
              {left >= 0 ? `${left.toLocaleString()} left` : `${Math.abs(left).toLocaleString()} over`}
            </div>
          </div>
        </Ring>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {TICKS.map(t => {
            const d = macroData[t.key];
            return (
              <MacroTick
                key={t.key}
                color={t.color}
                value={String(Math.round(safe(d?.consumed)))}
                label={t.label}
                sub={`of ${Math.round(safeTarget(d?.target))} g`}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}
