// MacroBand — Strain v2 visual, original data-layer logic preserved.
// Computes deficit / over-target colouring and renders 4 warm-hued macro bars.

import { s2 } from '../theme/tokens';
import { HairLabel } from './ui/HairLabel';
import { Bar } from './ui/Bar';

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

// ── Macro columns config ───────────────────────────────────────────────────
const MACROS = [
  { key: 'protein', label: 'PROTEIN', shortLabel: 'P', color: s2.protein },
  { key: 'carbs',   label: 'CARBS',   shortLabel: 'C', color: s2.carbs   },
  { key: 'fat',     label: 'FAT',     shortLabel: 'F', color: s2.fat     },
  { key: 'fibre',   label: 'FIBRE',   shortLabel: 'Fi', color: s2.fibre  },
] as const;

// ── MacroBand ──────────────────────────────────────────────────────────────
export function MacroBand({
  calories, protein, carbs, fat, fibre,
}: MacroBandProps) {
  const cal  = safe(calories?.consumed);
  const tCal = safeTarget(calories?.target);
  const calPct = Math.round((cal / tCal) * 100);

  const macroData: Record<string, { consumed: number; target: number }> = {
    protein, carbs, fat, fibre,
  };

  return (
    <div style={{
      background: s2.surface,
      border: `1px solid ${s2.line}`,
      padding: 14,
    }}>
      {/* Header: "MACRO LOAD · X / Y kcal" + percentage */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <HairLabel>
          MACRO LOAD · {Math.round(cal).toLocaleString()} / {Math.round(tCal).toLocaleString()} kcal
        </HairLabel>
        <HairLabel color={cal > tCal ? s2.warn : s2.accent}>
          {Math.min(calPct, 999)}%
        </HairLabel>
      </div>

      {/* 4-column macro bars */}
      <div style={{ display: 'flex', gap: 10 }}>
        {MACROS.map((m) => {
          const d = macroData[m.key];
          const v = safe(d?.consumed);
          const t = safeTarget(d?.target);
          const pct = v / t;
          return (
            <div key={m.key} style={{ flex: 1 }}>
              {/* Value / target */}
              <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.text, lineHeight: 1 }}>
                {Math.round(v)}
                <span style={{ color: s2.textDimmer }}>/{Math.round(t)}g</span>
              </div>
              <div style={{ height: 6 }} />
              <Bar pct={Math.min(pct, 1)} color={m.color} h={3} />
              <div style={{ height: 4 }} />
              <HairLabel color={m.color} style={{ fontSize: 8 }}>{m.label}</HairLabel>
            </div>
          );
        })}
      </div>
    </div>
  );
}
