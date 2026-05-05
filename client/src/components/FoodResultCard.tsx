// FoodResultCard — Strain v2 visual. All logic preserved.

import { FoodResult } from '../types';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

interface FoodResultCardProps {
  food: FoodResult;
  onSelect: (food: FoodResult) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  open_food_facts: 'OFF',
  usda:            'USDA',
  ai_estimate:     'AI',
  indian_db:       'INDB',   // sourceLabel will be 'INDB' or 'ICMR-NIN'
  calorie_ninjas:  'CN',
};

export function FoodResultCard({ food, onSelect }: FoodResultCardProps) {
  const macros = food.perServing;
  const isAI   = food.isAiEstimate;

  return (
    <button
      onClick={() => onSelect(food)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        background: isAI ? s2.accentFill : s2.surface,
        border: `1px solid ${isAI ? s2.accent : s2.line}`,
        cursor: 'pointer',
        color: s2.text,
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: s2.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAI && <span style={{ color: s2.accent, marginRight: 6 }}>✨</span>}
            {food.name}
          </div>
          <HairLabel style={{ marginTop: 3 }}>
            PER {food.defaultServing.label}
            {food.defaultServing.grams !== 100 ? ` · ${food.defaultServing.grams}g` : ''}
          </HairLabel>
        </div>
        <div style={{
          width: 28,
          height: 28,
          border: `1px solid ${s2.accent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily: s2.sans,
          fontSize: 18,
          color: s2.accent,
        }}>
          +
        </div>
      </div>

      {/* Macro row */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {[
          { v: Math.round(macros.calories), u: 'kcal', c: s2.text },
          { v: macros.protein,              u: 'P',    c: s2.protein },
          { v: macros.carbs,                u: 'C',    c: s2.carbs   },
          { v: macros.fat,                  u: 'F',    c: s2.fat     },
          { v: macros.fibre,                u: 'Fi',   c: s2.fibre   },
        ].map((m) => (
          <div key={m.u} style={{
            flex: 1,
            textAlign: 'center',
            padding: '5px 2px',
            background: `${m.c}14`,
            border: `1px solid ${m.c}22`,
          }}>
            <div style={{ fontFamily: s2.mono, fontSize: 10, color: m.c, fontWeight: 500 }}>{m.v}</div>
            <div style={{ fontFamily: s2.mono, fontSize: 7, color: s2.textDimmer, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.u}</div>
          </div>
        ))}
      </div>

      {/* Source tag */}
      <div style={{ marginTop: 8 }}>
        <HairLabel color={isAI ? s2.accent : s2.textDimmer} style={{ fontSize: 7 }}>
          {food.sourceLabel || SOURCE_LABELS[food.source] || food.source}
          {isAI ? ' · ESTIMATE — ACCURACY MAY VARY' : ''}
        </HairLabel>
      </div>
    </button>
  );
}
