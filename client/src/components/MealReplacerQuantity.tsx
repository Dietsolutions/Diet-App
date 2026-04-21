import { useState } from 'react';
import { useMealReplacerStore } from '../store/mealReplacerStore';

interface Props {
  onBack: () => void;
}

export function MealReplacerQuantity({ onBack }: Props) {
  const {
    selectedFood,
    selectedServing,
    quantity,
    computedMacros,
    setQuantity,
    setServing,
    setNote,
    note,
    submitReplacement,
    addMode,
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
    <div className="space-y-5 px-1">
      <button onClick={onBack} className="text-accent text-sm font-sans font-semibold">
        ← Back
      </button>

      <div>
        <h3 className="font-display text-lg font-bold text-primary">{selectedFood.name}</h3>
        <p className="text-xs text-secondary font-sans mt-0.5">Adjust your portion</p>
      </div>

      {/* Serving size dropdown */}
      <div>
        <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-1.5">Serving size</p>
        <select
          value={selectedServing.label}
          onChange={(e) => {
            const s = selectedFood.servingSizes.find(sv => sv.label === e.target.value);
            if (s) setServing(s);
          }}
          className="w-full bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm font-sans text-primary appearance-none cursor-pointer"
        >
          {selectedFood.servingSizes.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label} ({s.grams}g)
            </option>
          ))}
        </select>

        {/* Shortcut chips */}
        <div className="flex gap-2 mt-2">
          {shortcuts.map((s) => (
            <button
              key={s}
              onClick={() => setQuantity(s)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-sans font-medium transition-colors ${
                quantity === s
                  ? 'bg-accent text-white'
                  : 'bg-elevated text-secondary border border-border hover:bg-accent/10'
              }`}
            >
              {s === 0.5 ? '½' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div>
        <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-1.5">Quantity</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => adjustQty(-0.5)}
            disabled={quantity <= 0.5}
            className="w-10 h-10 rounded-xl bg-elevated border border-border text-primary text-lg font-bold flex items-center justify-center disabled:opacity-30 hover:bg-accent/10 transition-colors"
          >
            −
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setQuantity(v);
            }}
            className="w-20 text-center bg-elevated border border-border rounded-xl px-2 py-2 text-lg font-mono font-bold text-primary"
            min="0.5"
            step="0.5"
          />
          <button
            onClick={() => adjustQty(0.5)}
            className="w-10 h-10 rounded-xl bg-elevated border border-border text-primary text-lg font-bold flex items-center justify-center hover:bg-accent/10 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Live macro preview */}
      <div className="bg-surface rounded-2xl p-4 border border-border">
        <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-2">Your portion</p>
        <p className="text-2xl font-bold font-mono text-primary mb-2">
          {computedMacros.calories} <span className="text-sm text-secondary">kcal</span>
        </p>
        <div className="flex gap-2">
          <MacroRow label="Protein" value={`${computedMacros.protein}g`} color="text-success" />
          <MacroRow label="Carbs" value={`${computedMacros.carbs}g`} color="text-accent" />
          <MacroRow label="Fat" value={`${computedMacros.fat}g`} color="text-violet" />
          <MacroRow label="Fibre" value={`${computedMacros.fibre}g`} color="text-fibre" />
        </div>
      </div>

      {/* Note */}
      <div>
        <p className="text-xs text-dimmed font-sans uppercase tracking-wide mb-1.5">Note (optional)</p>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. "Office lunch"'
          className="w-full bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm font-sans text-primary placeholder-dimmed outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      <p className="text-[10px] text-dimmed font-sans text-center">
        Macros are estimates. Actual values may vary.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-300 text-sm px-3 py-2 rounded-xl font-sans">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full bg-accent text-white font-semibold font-sans py-3.5 rounded-[14px] text-base active:scale-95 transition-all disabled:opacity-50"
      >
        {isSubmitting ? 'Logging...' : addMode ? 'Add to My Day' : 'Log This Meal'}
      </button>
    </div>
  );
}

function MacroRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 text-center">
      <p className={`text-sm font-semibold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-secondary font-sans">{label}</p>
    </div>
  );
}
