// ExtraMealCard — a logged off-plan meal, with inline editing.
//
// Extra meals used to render read-only: once logged, the only way to correct a
// portion was to have logged it right the first time. This card adds an editor
// (quantity, meal category, note) and a delete, both backed by the existing
// /api/meals/additional endpoints.
//
// Fresh Light tokens: accent is a TEXT colour, accentFill is a block fill.

import { useState } from 'react';
import { AdditionalMealLog } from '../types';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { s2 } from '../theme/tokens';
import { HairLabel, Card } from './ui';

const CATEGORY_LABELS: Record<string, string> = {
  breakfast:     'Breakfast',
  brunch:        'Brunch',
  lunch:         'Lunch',
  evening_snack: 'Evening Snack',
  dinner:        'Dinner',
  other:         'Other',
};

interface Props {
  meal: AdditionalMealLog;
}

function chip(bg: string, color: string, label: string) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', background: bg, color,
      borderRadius: s2.rPill, padding: '4px 9px', fontFamily: s2.sans,
      fontSize: 10, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

const miniBtn = (active = false): React.CSSProperties => ({
  borderRadius:  s2.rMd,
  background:    active ? s2.accentWash : 'transparent',
  border:        `1px solid ${active ? s2.accent : s2.lineStrong}`,
  padding:       '4px 9px',
  fontFamily:    s2.mono,
  fontSize:      8,
  letterSpacing: '0.15em',
  color:         active ? s2.accent : s2.textDim,
  cursor:        'pointer',
  textTransform: 'uppercase',
  lineHeight:    1.4,
});

export function ExtraMealCard({ meal }: Props) {
  const { deleteAdditionalMeal, updateAdditionalMeal } = useAdditionalMealsStore();

  const [isEditing,     setIsEditing]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isBusy,        setIsBusy]        = useState(false);
  const [saveError,     setSaveError]     = useState('');

  // Seeded on open so a cancelled edit never leaves a stale draft behind.
  const [draftQty,  setDraftQty]  = useState(meal.servingQty);
  const [draftCat,  setDraftCat]  = useState(meal.mealCategory);
  const [draftNote, setDraftNote] = useState(meal.note ?? '');

  const openEditor = () => {
    setDraftQty(meal.servingQty);
    setDraftCat(meal.mealCategory);
    setDraftNote(meal.note ?? '');
    setSaveError('');
    setConfirmDelete(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsBusy(true);
    setSaveError('');
    try {
      await updateAdditionalMeal(meal.id, meal.date, {
        servingQty:   draftQty,
        mealCategory: draftCat,
        note:         draftNote,
      });
      setIsEditing(false);
    } catch {
      setSaveError('Could not save. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setIsBusy(true);
    try {
      await deleteAdditionalMeal(meal.id, meal.date);
    } catch {
      setIsBusy(false);
      setConfirmDelete(false);
    }
  };

  // Macros scale with quantity, so show the result before saving — otherwise
  // the effect of changing the portion is invisible until it is committed.
  const previewCalories =
    meal.servingQty > 0
      ? Math.round(meal.calories * (draftQty / meal.servingQty))
      : Math.round(meal.calories);

  return (
    <div style={{ marginBottom: 8 }}>
      <Card padding={14} radius={22} border={s2.lineStrong}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: s2.sans, fontSize: 13, fontWeight: 600,
              color: s2.text, lineHeight: 1.3,
            }}>
              {meal.foodName || 'Extra meal'}
            </div>
            <div style={{
              fontFamily: s2.sans, fontSize: 11, color: s2.textDim, marginTop: 2,
            }}>
              {meal.servingQty} × {meal.servingSize}
              {meal.note ? ` · ${meal.note}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
              {chip(s2.bg, s2.text, `${Math.round(meal.calories)} kcal`)}
              {chip('rgba(111,185,59,0.14)', s2.proteinText, `P ${Math.round(meal.proteinG)}`)}
              {chip('rgba(242,185,59,0.16)', s2.carbsText,   `C ${Math.round(meal.carbsG)}`)}
              {chip('rgba(255,138,107,0.16)', s2.fatText,    `F ${Math.round(meal.fatG)}`)}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <HairLabel>OFF-PLAN</HairLabel>
            {!isEditing && (
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={openEditor} style={miniBtn()}>EDIT</button>
                <button
                  onClick={handleDelete}
                  disabled={isBusy}
                  style={{
                    ...miniBtn(),
                    color:  confirmDelete ? s2.warn : s2.textDim,
                    border: `1px solid ${confirmDelete ? s2.warn : s2.lineStrong}`,
                  }}
                >
                  {confirmDelete ? 'CONFIRM' : 'REMOVE'}
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${s2.line}`,
          }}>
            {/* Quantity */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, marginBottom: 10,
            }}>
              <HairLabel>QUANTITY</HairLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setDraftQty(q => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))}
                  disabled={draftQty <= 0.5}
                  aria-label="Decrease quantity"
                  style={{
                    width: 30, height: 30, borderRadius: s2.rMd,
                    border: `1px solid ${s2.lineStrong}`, background: 'transparent',
                    color: s2.text, fontSize: 15, cursor: 'pointer', lineHeight: 1,
                    opacity: draftQty <= 0.5 ? 0.4 : 1,
                  }}
                >−</button>
                <span style={{
                  fontFamily: s2.sans, fontSize: 14, fontWeight: 600, color: s2.text,
                  minWidth: 52, textAlign: 'center',
                }}>{draftQty} ×</span>
                <button
                  onClick={() => setDraftQty(q => Math.round((q + 0.5) * 10) / 10)}
                  aria-label="Increase quantity"
                  style={{
                    width: 30, height: 30, borderRadius: s2.rMd,
                    border: `1px solid ${s2.lineStrong}`, background: 'transparent',
                    color: s2.text, fontSize: 15, cursor: 'pointer', lineHeight: 1,
                  }}
                >+</button>
              </div>
            </div>

            <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDim, marginBottom: 12 }}>
              {meal.servingSize} · about{' '}
              <span style={{ color: s2.text, fontWeight: 600 }}>{previewCalories} kcal</span>
              {draftQty !== meal.servingQty && (
                <span style={{ color: s2.textDimmer }}> (was {Math.round(meal.calories)})</span>
              )}
            </div>

            <HairLabel style={{ marginBottom: 6 }}>MEAL</HairLabel>
            <select
              value={draftCat}
              onChange={e => setDraftCat(e.target.value)}
              style={{
                width: '100%', marginBottom: 12, borderRadius: s2.rMd,
                background: s2.surface, border: `1px solid ${s2.lineStrong}`,
                padding: '9px 11px', fontFamily: s2.sans, fontSize: 13,
                color: s2.text, outline: 'none', appearance: 'none', WebkitAppearance: 'none',
              }}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <HairLabel style={{ marginBottom: 6 }}>NOTE</HairLabel>
            <input
              value={draftNote}
              onChange={e => setDraftNote(e.target.value)}
              placeholder="Optional"
              maxLength={200}
              style={{
                width: '100%', marginBottom: 12, borderRadius: s2.rMd,
                background: s2.surface, border: `1px solid ${s2.lineStrong}`,
                padding: '9px 11px', fontFamily: s2.sans, fontSize: 13,
                color: s2.text, outline: 'none',
              }}
            />

            {saveError && (
              <div style={{
                marginBottom: 10, fontFamily: s2.sans, fontSize: 11, color: s2.warn,
              }}>{saveError}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={isBusy}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: s2.rPill,
                  background: s2.accentFill, border: 'none',
                  fontFamily: s2.sans, fontSize: 12, fontWeight: 700, color: s2.ink,
                  cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1,
                }}
              >
                {isBusy ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setIsEditing(false); setSaveError(''); }}
                disabled={isBusy}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: s2.rPill,
                  background: 'transparent', border: `1px solid ${s2.lineStrong}`,
                  fontFamily: s2.sans, fontSize: 12, fontWeight: 600, color: s2.textDim,
                  cursor: isBusy ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
