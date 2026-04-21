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
  const { deleteAdditionalMeal } = useAdditionalMealsStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

            {/* Delete button */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`flex-shrink-0 text-xs font-sans px-2.5 py-1 rounded-lg transition-all ${
                confirmDelete
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-dimmed hover:text-red-400 hover:bg-red-500/10'
              } disabled:opacity-40`}
            >
              {isDeleting ? '…' : confirmDelete ? 'Confirm' : '✕'}
            </button>
          </div>

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
