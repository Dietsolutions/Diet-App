import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import { WeightLog, WeightProjectionPoint, TimeRange } from '../types';

interface WeightState {
  logs: WeightLog[];
  projection: WeightProjectionPoint[];
  goalDate: string | null;
  weeklyLossKg: number;
  startWeight: number;
  isLoading: boolean;
  isLogModalOpen: boolean;
  editingLog: WeightLog | null;
  selectedTimeRange: TimeRange;

  fetchLogs: () => Promise<void>;
  fetchProjection: () => Promise<void>;
  logWeight: (data: { weightKg: number; note?: string; loggedAt?: string }) => Promise<WeightLog>;
  updateLog: (id: string, data: { weightKg?: number; note?: string }) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  setTimeRange: (range: TimeRange) => void;
  openLogModal: (editLog?: WeightLog) => void;
  closeLogModal: () => void;

  // Computed helpers
  getCurrentWeight: () => number;
  getTotalLost: () => number;
  getProgressPercent: () => number;
}

export const useWeightStore = create<WeightState>((set, get) => ({
  logs: [],
  projection: [],
  goalDate: null,
  weeklyLossKg: 0.5,
  startWeight: 0,
  isLoading: false,
  isLogModalOpen: false,
  editingLog: null,
  selectedTimeRange: 'all',

  fetchLogs: async () => {
    try {
      const res = await apiFetch('/api/weight/logs');
      if (!res.ok) return;
      const data = await res.json();
      // Validate that data.logs is actually an array of log objects
      if (Array.isArray(data.logs) && data.logs.every((l: any) => l && typeof l.weightKg === 'number')) {
        set({ logs: data.logs });
      } else {
        set({ logs: [] });
      }
    } catch {
      set({ logs: [] });
    }
  },

  fetchProjection: async () => {
    try {
      const res = await apiFetch('/api/weight/projection');
      if (!res.ok) return;
      const data = await res.json();
      // Validate that data.projection is an array of {date, weightKg} objects
      if (Array.isArray(data.projection) && data.projection.every((p: any) => p && typeof p.weightKg === 'number' && typeof p.date === 'string')) {
        set({
          projection: data.projection,
          goalDate: typeof data.goalDate === 'string' ? data.goalDate : null,
          weeklyLossKg: typeof data.weeklyLossKg === 'number' ? data.weeklyLossKg : 0.5,
          startWeight: typeof data.startWeight === 'number' ? data.startWeight : 0
        });
      } else {
        set({ projection: [], goalDate: null, weeklyLossKg: 0.5, startWeight: 0 });
      }
    } catch {
      set({ projection: [], goalDate: null, weeklyLossKg: 0.5, startWeight: 0 });
    }
  },

  logWeight: async (input) => {
    const res = await apiFetch('/api/weight/log', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to log weight');
    // Refresh both logs and projection
    await Promise.all([get().fetchLogs(), get().fetchProjection()]);
    return data.log;
  },

  updateLog: async (id, input) => {
    const res = await apiFetch(`/api/weight/log/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update');
    }
    await Promise.all([get().fetchLogs(), get().fetchProjection()]);
  },

  deleteLog: async (id) => {
    const res = await apiFetch(`/api/weight/log/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete');
    }
    await Promise.all([get().fetchLogs(), get().fetchProjection()]);
  },

  setTimeRange: (range) => set({ selectedTimeRange: range }),
  openLogModal: (editLog) => set({ isLogModalOpen: true, editingLog: editLog || null }),
  closeLogModal: () => set({ isLogModalOpen: false, editingLog: null }),

  getCurrentWeight: () => {
    const { logs, startWeight } = get();
    if (logs.length === 0) return startWeight;
    return logs[logs.length - 1].weightKg;
  },

  getTotalLost: () => {
    const { logs } = get();
    if (logs.length < 1) return 0;
    const start = logs[0].weightKg;
    const current = logs[logs.length - 1].weightKg;
    return Math.round((start - current) * 10) / 10;
  },

  getProgressPercent: () => {
    const { logs } = get();
    if (logs.length < 1) return 0;
    const start = logs[0].weightKg;
    const current = logs[logs.length - 1].weightKg;
    // Get target from projection endpoint or profile
    const { projection } = get();
    if (projection.length === 0) return 0;
    const target = projection[projection.length - 1].weightKg;
    const totalToLose = start - target;
    if (totalToLose === 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((start - current) / totalToLose) * 100)));
  }
}));
