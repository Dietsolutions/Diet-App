import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MealTimes {
  breakfast: string; // "HH:MM"
  lunch: string;
  dinner: string;
}

export interface NotificationPrefs {
  // Master switch
  enabled: boolean;
  // Per-category toggles
  mealReminders: boolean;
  mealFollowUps: boolean;
  waterReminders: boolean;
  weightReminders: boolean;
  weightMilestones: boolean;
  shoppingReminders: boolean;
  dailySummary: boolean;
  streakNotifs: boolean;
  recipeDigest: boolean;
  tipsNotifs: boolean;
  planExpiry: boolean;
  reengagement: boolean;
  // Configurable times
  mealTimes: MealTimes;
  waterIntervalHours: number;
  eveningReminderTime: string; // "HH:MM"
  weightReminderTime: string;  // "HH:MM"
}

interface NotificationState {
  prefs: NotificationPrefs;
  permissionGranted: boolean;
  setPrefs: (update: Partial<NotificationPrefs>) => void;
  setMealTime: (meal: keyof MealTimes, time: string) => void;
  setPermissionGranted: (granted: boolean) => void;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  mealReminders: true,
  mealFollowUps: true,
  waterReminders: true,
  weightReminders: true,
  weightMilestones: true,
  shoppingReminders: true,
  dailySummary: true,
  streakNotifs: true,
  recipeDigest: false,
  tipsNotifs: false,
  planExpiry: true,
  reengagement: true,
  mealTimes: { breakfast: '08:00', lunch: '13:00', dinner: '19:00' },
  waterIntervalHours: 2,
  eveningReminderTime: '21:00',
  weightReminderTime: '07:00',
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      permissionGranted: false,
      setPrefs: (update) =>
        set((state) => ({ prefs: { ...state.prefs, ...update } })),
      setMealTime: (meal, time) =>
        set((state) => ({
          prefs: {
            ...state.prefs,
            mealTimes: { ...state.prefs.mealTimes, [meal]: time },
          },
        })),
      setPermissionGranted: (granted) => set({ permissionGranted: granted }),
    }),
    { name: 'notif-prefs-v1' },
  ),
);
