// AddMealButton — dashed button to open the add-meal sheet.
// Hidden for future dates.

import { useMealReplacerStore } from '../store/mealReplacerStore';

interface Props {
  date: string;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function AddMealButton({ date }: Props) {
  const { openAdder } = useMealReplacerStore();

  // Don't show for future dates
  if (date > todayStr()) return null;

  return (
    <button
      onClick={() => openAdder(date)}
      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-violet/30 bg-violet/5 px-4 py-3.5 text-sm font-sans font-medium text-violet/80 hover:bg-violet/10 hover:border-violet/50 hover:text-violet transition-all active:scale-95"
    >
      <span className="text-lg leading-none">+</span>
      <span>Add a meal you had today</span>
    </button>
  );
}
