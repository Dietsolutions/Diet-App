// MealReplacerQuantity — Strain v2 visual. All logic preserved.

import { useState } from 'react';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { s2 } from '../theme/tokens';
import { HairLabel, Card } from './ui';

interface Props {
  onBack: () => void;
}

export function MealReplacerQuantity({ onBack }: Props) {
  const {
    selectedFood, selectedServing, quantity, computedMacros,
    setQuantity, setServing, setNote, note, submitReplacement, addMode,
  } = useMealReplacerStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!selectedFood || !selectedServing || !computedMacros) return null;

  const adjustQty = (delta: number) => {
    const next = Math.max(0.5, Math.round((quantity + delta) * 10) / 10);
    setQuantity(next);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await submitReplacement();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to log meal');
      setIsSubmitting(false);
    }
  };

  const shortcuts = [0.5, 1, 1.5, 2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: 'none',
          fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em',
          color: s2.accent, cursor: 'pointer', textTransform: 'uppercase',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M6 1 L2 5 L6 9" stroke={s2.accent} strokeWidth="1.2" fill="none"/>
        </svg>
        BACK
      </button>

      {/* Title */}
      <div>
        <HairLabel style={{ marginBottom: 6 }}>ADJUST PORTION</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 20, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text }}>
          {selectedFood.name}
        </div>
      </div>

      {/* Serving size selector */}
      <div>
        <HairLabel style={{ marginBottom: 8 }}>SERVING SIZE</HairLabel>
        <select
          value={selectedServing.label}
          onChange={(e) => {
            const s = selectedFood.servingSizes.find(sv => sv.label === e.target.value);
            if (s) setServing(s);
          }}
          style={{
            width: '100%',
            background: s2.surface,
            border: `1px solid ${s2.lineStrong}`,
            padding: '12px 14px',
            fontFamily: s2.sans,
            fontSize: 14,
            color: s2.text,
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none',
          }}
        >
          {selectedFood.servingSizes.map((sv) => (
            <option key={sv.label} value={sv.label}>{sv.label} ({sv.grams}g)</option>
          ))}
        </select>

        {/* Shortcuts */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {shortcuts.map((sh) => (
            <button
              key={sh}
              onClick={() => setQuantity(sh)}
              style={{
                flex: 1,
                padding: '9px 0',
                border: `1px solid ${quantity === sh ? s2.accent : s2.lineStrong}`,
                background: quantity === sh ? s2.accentFill : 'transparent',
                fontFamily: s2.mono,
                fontSize: 10,
                letterSpacing: '0.1em',
                color: quantity === sh ? s2.accent : s2.textDim,
                cursor: 'pointer',
              }}
            >
              {sh === 0.5 ? '½' : sh}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity stepper */}
      <div>
        <HairLabel style={{ marginBottom: 8 }}>QUANTITY</HairLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => adjustQty(-0.5)}
            disabled={quantity <= 0.5}
            style={{
              width: 40, height: 40,
              border: `1px solid ${s2.lineStrong}`,
              background: 'transparent',
              fontFamily: s2.sans, fontSize: 20,
              color: quantity <= 0.5 ? s2.textDimmer : s2.text,
              cursor: quantity <= 0.5 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setQuantity(v); }}
            min="0.5"
            step="0.5"
            style={{
              flex: 1,
              textAlign: 'center',
              background: s2.surface,
              border: `1px solid ${s2.lineStrong}`,
              padding: '10px 0',
              fontFamily: s2.mono,
              fontSize: 20,
              fontWeight: 500,
              color: s2.text,
              outline: 'none',
            }}
          />
          <button
            onClick={() => adjustQty(0.5)}
            style={{
              width: 40, height: 40,
              border: `1px solid ${s2.lineStrong}`,
              background: 'transparent',
              fontFamily: s2.sans, fontSize: 20,
              color: s2.text,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>
      </div>

      {/* Live macro preview */}
      <Card padding={14}>
        <HairLabel style={{ marginBottom: 10 }}>
          AT {quantity} × {selectedServing.label}
        </HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 26, fontWeight: 300, letterSpacing: '-0.03em', color: s2.accent, lineHeight: 1, marginBottom: 14 }}>
          {computedMacros.calories}<span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.textDim, marginLeft: 6 }}>kcal</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { v: computedMacros.protein, u: 'g', label: 'PROTEIN', c: s2.protein },
            { v: computedMacros.carbs,   u: 'g', label: 'CARBS',   c: s2.carbs   },
            { v: computedMacros.fat,     u: 'g', label: 'FAT',     c: s2.fat     },
            { v: computedMacros.fibre,   u: 'g', label: 'FIBRE',   c: s2.fibre   },
          ].map((m) => (
            <div key={m.label} style={{ flex: 1 }}>
              <div style={{ fontFamily: s2.mono, fontSize: 15, color: m.c, fontWeight: 400 }}>
                {m.v}<span style={{ fontSize: 9, color: s2.textDimmer }}>{m.u}</span>
              </div>
              <HairLabel color={m.c} style={{ fontSize: 7, marginTop: 4 }}>{m.label}</HairLabel>
            </div>
          ))}
        </div>
      </Card>

      {/* Note */}
      <div>
        <HairLabel style={{ marginBottom: 8 }}>NOTE (OPTIONAL)</HairLabel>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. "Office lunch"'
          style={{
            width: '100%',
            background: s2.surface,
            border: `1px solid ${s2.lineStrong}`,
            padding: '12px 14px',
            fontFamily: s2.sans,
            fontSize: 14,
            color: s2.text,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <HairLabel style={{ textAlign: 'center', fontSize: 7 }}>
        MACROS ARE ESTIMATES. ACTUAL VALUES MAY VARY.
      </HairLabel>

      {error && (
        <div style={{ border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '10px 14px' }}>
          <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.warn }}>{error}</div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          width: '100%',
          padding: '14px 0',
          background: isSubmitting ? s2.surface : s2.accentFill,
          border: `1px solid ${s2.accent}`,
          fontFamily: s2.mono,
          fontSize: 10,
          letterSpacing: '0.2em',
          color: isSubmitting ? s2.textDimmer : s2.ink,
          cursor: isSubmitting ? 'default' : 'pointer',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {isSubmitting ? (
          <>
            <div style={{ width: 12, height: 12, border: `1.5px solid ${s2.textDimmer}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
            LOGGING…
          </>
        ) : addMode ? 'ADD TO MY DAY' : 'LOG THIS MEAL'}
      </button>
    </div>
  );
}
