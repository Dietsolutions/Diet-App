// AdditionalMealCard — displays a logged extra meal with violet accent, EXTRA badge, macro pills, and delete button.

import { useState } from 'react';
import { AdditionalMealLog } from '../types';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';

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

export function AdditionalMealCard({ meal }: Props) {
  const { deleteAdditionalMeal, updateAdditionalMeal } = useAdditionalMealsStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline edit state. Seeded from the meal each time the editor opens, so
  // cancelling and reopening never shows a stale draft.
  const [isEditing, setIsEditing] = useState(false);
  const [draftQty, setDraftQty]   = useState(meal.servingQty);
  const [draftCat, setDraftCat]   = useState(meal.mealCategory);
  const [draftNote, setDraftNote] = useState(meal.note ?? '');
  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAdditionalMeal(meal.id, meal.date);
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const openEditor = () => {
    setDraftQty(meal.servingQty);
    setDraftCat(meal.mealCategory);
    setDraftNote(meal.note ?? '');
    setSaveError('');
    setConfirmDelete(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
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
      setIsSaving(false);
    }
  };

  // Macros scale with quantity, so preview the new calories while editing —
  // otherwise the change is invisible until after saving.
  const previewCalories =
    meal.servingQty > 0
      ? Math.round(meal.calories * (draftQty / meal.servingQty))
      : Math.round(meal.calories);

  return (
    <div className="rounded-2xl border border-violet/20 bg-violet/5 overflow-hidden card-glow">
      {/* Violet left accent bar */}
      <div className="flex">
        <div className="w-1 bg-violet/60 flex-shrink-0 rounded-l-2xl" />

        <div className="flex-1 p-4 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {/* EXTRA badge */}
                <span className="text-[10px] font-sans font-bold text-violet bg-violet/15 px-1.5 py-0.5 rounded-full tracking-wide uppercase">
                  EXTRA
                </span>
                <span className="text-xs font-sans text-secondary">
                  {CATEGORY_LABELS[meal.mealCategory] || 'Other'}
                </span>
                {meal.isAiEstimate && (
                  <span className="text-[10px] font-sans text-dimmed bg-elevated px-1.5 py-0.5 rounded-full">
                    ✨ AI estimate
                  </span>
                )}
              </div>
              <h4 className="text-sm font-sans font-semibold text-primary leading-snug truncate">
                {meal.foodName}
              </h4>
              <p className="text-xs text-secondary font-sans mt-0.5">
                {meal.servingQty} × {meal.servingSize}
                {meal.note ? ` · ${meal.note}` : ''}
              </p>
            </div>

            <div className="flex-shrink-0 flex items-center gap-1">
              {/* Edit — a logged extra used to be delete-and-relog only */}
              {!isEditing && (
                <button
                  onClick={openEditor}
                  aria-label="Edit this logged meal"
                  className="text-xs font-sans px-2.5 py-1 rounded-lg transition-all text-dimmed hover:text-violet hover:bg-violet/10"
                >
                  Edit
                </button>
              )}

              {/* Delete button */}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label={confirmDelete ? 'Confirm delete' : 'Delete this logged meal'}
                className={`text-xs font-sans px-2.5 py-1 rounded-lg transition-all ${
                  confirmDelete
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-dimmed hover:text-red-400 hover:bg-red-500/10'
                } disabled:opacity-40`}
              >
                {isDeleting ? '…' : confirmDelete ? 'Confirm' : '✕'}
              </button>
            </div>
          </div>

          {/* Inline editor */}
          {isEditing && (
            <div className="mt-2 mb-3 rounded-xl border border-violet/25 bg-violet/[0.06] p-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[10px] font-sans uppercase tracking-wide text-secondary">
                  Quantity
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDraftQty(q => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))}
                    aria-label="Decrease quantity"
                    className="w-7 h-7 rounded-lg border border-violet/30 text-violet text-sm leading-none disabled:opacity-40"
                    disabled={draftQty <= 0.5}
                  >
                    −
                  </button>
                  <span className="text-sm font-sans font-semibold text-primary min-w-[3.5rem] text-center">
                    {draftQty} ×
                  </span>
                  <button
                    onClick={() => setDraftQty(q => Math.round((q + 0.5) * 10) / 10)}
                    aria-label="Increase quantity"
                    className="w-7 h-7 rounded-lg border border-violet/30 text-violet text-sm leading-none"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-sans text-secondary mb-3">
                {meal.servingSize} · about <span className="text-primary font-semibold">{previewCalories} kcal</span>
                {draftQty !== meal.servingQty && (
                  <span className="text-dimmed"> (was {Math.round(meal.calories)})</span>
                )}
              </div>

              <label className="block text-[10px] font-sans uppercase tracking-wide text-secondary mb-1">
                Meal
              </label>
              <select
                value={draftCat}
                onChange={e => setDraftCat(e.target.value)}
                className="w-full mb-3 rounded-lg bg-elevated border border-violet/20 px-2.5 py-1.5 text-xs font-sans text-primary"
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <label className="block text-[10px] font-sans uppercase tracking-wide text-secondary mb-1">
                Note
              </label>
              <input
                value={draftNote}
                onChange={e => setDraftNote(e.target.value)}
                placeholder="Optional"
                maxLength={200}
                className="w-full mb-3 rounded-lg bg-elevated border border-violet/20 px-2.5 py-1.5 text-xs font-sans text-primary"
              />

              {saveError && (
                <div className="mb-2 text-[11px] font-sans text-red-400">{saveError}</div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-violet/20 border border-violet/40 text-violet text-xs font-sans font-semibold py-1.5 disabled:opacity-40"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setSaveError(''); }}
                  disabled={isSaving}
                  className="flex-1 rounded-lg border border-white/10 text-dimmed text-xs font-sans py-1.5 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Macro pills */}
          <div className="flex gap-1.5 flex-wrap mt-2">
            <MacroPill label="kcal" value={`${Math.round(meal.calories)}`} color="text-primary" bg="bg-primary/[0.08]" bold />
            <MacroPill label="Protein" value={`${meal.proteinG}g`} color="text-success" bg="bg-success-fill" />
            <MacroPill label="Carbs"   value={`${meal.carbsG}g`}   color="text-accent"  bg="bg-accent-fill"  />
            <MacroPill label="Fat"     value={`${meal.fatG}g`}     color="text-violet"  bg="bg-violet-fill"  />
            <MacroPill label="Fibre"   value={`${meal.fibreG}g`}   color="text-fibre"   bg="bg-fibre-fill"   />
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroPill({ label, value, color, bg, bold }: {
  label: string; value: string; color: string; bg: string; bold?: boolean;
}) {
  return (
    <div className={`text-center rounded-full px-2.5 py-0.5 ${bg}`}>
      <span className={`text-[11px] font-mono font-semibold ${color} ${bold ? 'font-bold' : ''}`}>{value}</span>
      <span className="text-[9px] text-secondary font-sans ml-0.5">{label}</span>
    </div>
  );
}
