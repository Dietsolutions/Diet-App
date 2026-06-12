import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Unit = 'kg' | 'lbs';

interface UnitsState {
  unit: Unit;
  setUnit: (u: Unit) => void;
  toDisplay: (kg: number) => number;
  unitLabel: string;
}

export const useUnitsStore = create<UnitsState>()(
  persist(
    (set, get) => ({
      unit: 'kg',
      setUnit: (unit) => set({ unit }),
      get unitLabel() { return get().unit; },
      toDisplay: (kg) => {
        const u = get().unit;
        if (u === 'lbs') return Math.round(kg * 2.20462 * 10) / 10;
        return Math.round(kg * 10) / 10;
      },
    }),
    { name: 'units-pref-v1' },
  ),
);
