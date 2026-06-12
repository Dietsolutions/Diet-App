import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, LocalNotificationSchema } from '@capacitor/local-notifications';
import { useNotificationStore, NotificationPrefs } from '../store/notificationStore';

// ── Notification ID ranges (each category owns 100 IDs) ────────────────────
const ID = {
  MEAL_BREAKFAST:       100,
  MEAL_BREAKFAST_FU:    101, // follow-up if not logged
  MEAL_LUNCH:           110,
  MEAL_LUNCH_FU:        111,
  MEAL_DINNER:          120,
  MEAL_DINNER_FU:       121,
  MEAL_PLAN_EXPIRY:     130,
  MEAL_PLAN_READY:      131,
  WATER_BASE:           200, // 200-299 — repeating water reminders
  WATER_BEHIND:         299,
  WEIGHT_MORNING:       300,
  WEIGHT_FOLLOWUP:      301,
  WEIGHT_MILESTONE:     310, // 310-319
  WEIGHT_HALFWAY:       320,
  WEIGHT_GOAL:          321,
  SHOPPING:             400,
  SHOPPING_REMINDER:    401,
  AUDIO_READY:          500,
  DAILY_SUMMARY:        600,
  STREAK_3:             610,
  STREAK_7:             611,
  STREAK_14:            612,
  STREAK_30:            613,
  MEALS_PREPPED:        620,
  RECIPE_DIGEST:        700,
  TIPS:                 800,
  PROFILE_INCOMPLETE:   900,
  GOAL_RECALIBRATE:     901,
  CALORIE_RECALC:       902,
  REENGAGEMENT:         1000,
} as const;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// Parse "HH:MM" → { hour, minute }
function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h ?? 8, minute: m ?? 0 };
}

// Build a Date for "today at HH:MM", or tomorrow if that time has passed
function todayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

// Build a Date N hours from now
function hoursFromNow(n: number): Date {
  return new Date(Date.now() + n * 60 * 60 * 1000);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.requestPermissions();
    const granted = display === 'granted';
    useNotificationStore.getState().setPermissionGranted(granted);
    return granted;
  } catch {
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    const granted = display === 'granted';
    useNotificationStore.getState().setPermissionGranted(granted);
    return granted;
  } catch {
    return false;
  }
}

export async function cancelNotifications(ids: number[]): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch { /* noop */ }
}

export async function cancelMealFollowUp(mealLabel: 'breakfast' | 'lunch' | 'dinner'): Promise<void> {
  const fuId = mealLabel === 'breakfast' ? ID.MEAL_BREAKFAST_FU
    : mealLabel === 'lunch' ? ID.MEAL_LUNCH_FU
    : ID.MEAL_DINNER_FU;
  await cancelNotifications([fuId]);
}

// ── Schedule all enabled notifications ─────────────────────────────────────
export async function scheduleAllNotifications(
  prefs?: NotificationPrefs,
): Promise<void> {
  if (!isNative()) return;

  const p = prefs ?? useNotificationStore.getState().prefs;

  // Always cancel all managed IDs first to avoid duplicates
  const allIds = Object.values(ID);
  // Also cancel water range 200-298
  const waterIds = Array.from({ length: 99 }, (_, i) => 200 + i);
  await cancelNotifications([...allIds, ...waterIds]);

  if (!p.enabled) return;

  const granted = await checkNotificationPermission();
  if (!granted) return;

  const notifs: LocalNotificationSchema[] = [];

  // ── Meal reminders ──────────────────────────────────────────────────────
  if (p.mealReminders) {
    const bf = parseTime(p.mealTimes.breakfast);
    const lu = parseTime(p.mealTimes.lunch);
    const di = parseTime(p.mealTimes.dinner);

    notifs.push(
      { id: ID.MEAL_BREAKFAST, title: 'Breakfast time! 🍳', body: "Don't forget to log your breakfast", schedule: { at: todayAt(bf.hour, bf.minute), repeats: true, every: 'day' }, sound: 'default', smallIcon: 'ic_stat_notify', channelId: 'meals' },
      { id: ID.MEAL_LUNCH, title: 'Lunch time! 🥗', body: 'Time for your midday meal', schedule: { at: todayAt(lu.hour, lu.minute), repeats: true, every: 'day' }, sound: 'default', smallIcon: 'ic_stat_notify', channelId: 'meals' },
      { id: ID.MEAL_DINNER, title: 'Dinner time! 🍝', body: "Stick to your plan — dinner is ready", schedule: { at: todayAt(di.hour, di.minute), repeats: true, every: 'day' }, sound: 'default', smallIcon: 'ic_stat_notify', channelId: 'meals' },
    );

    // Follow-up 2 hours after each meal
    if (p.mealFollowUps) {
      const bfFu = parseTime(p.mealTimes.breakfast);
      bfFu.hour += 2;
      const luFu = parseTime(p.mealTimes.lunch);
      luFu.hour += 2;
      const diFu = parseTime(p.mealTimes.dinner);
      diFu.hour += 2;

      notifs.push(
        { id: ID.MEAL_BREAKFAST_FU, title: 'Did you eat breakfast?', body: 'Tap to log it — takes 5 seconds', schedule: { at: todayAt(bfFu.hour, bfFu.minute), repeats: true, every: 'day' }, sound: 'default', smallIcon: 'ic_stat_notify', channelId: 'meals' },
        { id: ID.MEAL_LUNCH_FU, title: 'Did you eat lunch?', body: 'Tap to log it — takes 5 seconds', schedule: { at: todayAt(luFu.hour, luFu.minute), repeats: true, every: 'day' }, sound: 'default', smallIcon: 'ic_stat_notify', channelId: 'meals' },
        { id: ID.MEAL_DINNER_FU, title: 'Did you eat dinner?', body: 'Tap to log it — takes 5 seconds', schedule: { at: todayAt(diFu.hour, diFu.minute), repeats: true, every: 'day' }, sound: 'default', smallIcon: 'ic_stat_notify', channelId: 'meals' },
      );
    }
  }

  // ── Water reminders ─────────────────────────────────────────────────────
  if (p.waterReminders) {
    const interval = p.waterIntervalHours;
    // Schedule up to 8 water reminders throughout the day
    const startHour = 8;
    const endHour = 22;
    let slot = 0;
    for (let h = startHour; h <= endHour; h += interval) {
      if (slot >= 10) break;
      const at = todayAt(h, 0);
      notifs.push({
        id: 200 + slot,
        title: 'Time to drink water 💧',
        body: `Stay hydrated — drink a glass now`,
        schedule: { at, repeats: true, every: 'day' },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'water',
      });
      slot++;
    }
  }

  // ── Weight reminders ────────────────────────────────────────────────────
  if (p.weightReminders) {
    const wt = parseTime(p.weightReminderTime);
    notifs.push({
      id: ID.WEIGHT_MORNING,
      title: 'Weigh-in time ⚖️',
      body: 'Same time, same scale — log your weight',
      schedule: { at: todayAt(wt.hour, wt.minute), repeats: true, every: 'day' },
      sound: 'default',
      smallIcon: 'ic_stat_notify',
      channelId: 'weight',
    });
    // Follow-up at 10 AM
    notifs.push({
      id: ID.WEIGHT_FOLLOWUP,
      title: 'Weight not logged yet',
      body: "Quick — log today's weight before you forget",
      schedule: { at: todayAt(10, 0), repeats: true, every: 'day' },
      sound: 'default',
      smallIcon: 'ic_stat_notify',
      channelId: 'weight',
    });
  }

  // ── Daily summary ───────────────────────────────────────────────────────
  if (p.dailySummary) {
    const ev = parseTime(p.eveningReminderTime);
    notifs.push({
      id: ID.DAILY_SUMMARY,
      title: 'Daily summary 📊',
      body: 'Tap to see how you did today',
      schedule: { at: todayAt(ev.hour, ev.minute), repeats: true, every: 'day' },
      sound: 'default',
      smallIcon: 'ic_stat_notify',
      channelId: 'summary',
    });
    // Evening prep reminder
    notifs.push({
      id: ID.MEALS_PREPPED,
      title: 'Plan for tomorrow 🍱',
      body: 'Your meals are set — check them now',
      schedule: { at: todayAt(20, 30), repeats: true, every: 'day' },
      sound: 'default',
      smallIcon: 'ic_stat_notify',
      channelId: 'summary',
    });
  }

  // ── Recipe digest (weekly, Sunday 10 AM) ──────────────────────────────
  if (p.recipeDigest) {
    const nextSunday = (() => {
      const d = new Date();
      d.setHours(10, 0, 0, 0);
      const dow = d.getDay();
      const daysUntilSunday = dow === 0 ? 7 : 7 - dow;
      d.setDate(d.getDate() + daysUntilSunday);
      return d;
    })();
    notifs.push({
      id: ID.RECIPE_DIGEST,
      title: 'New recipes for you 📖',
      body: 'Discover this week\'s top meal picks',
      schedule: { at: nextSunday, repeats: true, every: 'week' },
      sound: 'default',
      smallIcon: 'ic_stat_notify',
      channelId: 'digest',
    });
  }

  // ── Tips (weekly) ────────────────────────────────────────────────────
  if (p.tipsNotifs) {
    const nextMonday = (() => {
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      const dow = d.getDay();
      const daysUntilMon = dow === 1 ? 7 : ((8 - dow) % 7) || 7;
      d.setDate(d.getDate() + daysUntilMon);
      return d;
    })();
    notifs.push({
      id: ID.TIPS,
      title: 'New nutrition tip for you 📖',
      body: 'A small change can make a big difference',
      schedule: { at: nextMonday, repeats: true, every: 'week' },
      sound: 'default',
      smallIcon: 'ic_stat_notify',
      channelId: 'tips',
    });
  }

  if (notifs.length === 0) return;

  try {
    await LocalNotifications.schedule({ notifications: notifs } as ScheduleOptions);
  } catch (e) {
    console.warn('[Notifications] schedule failed:', e);
  }
}

// ── One-off notifications (called from app logic) ──────────────────────────

export async function notifyWeightMilestone(kgLost: number): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled || !p.weightMilestones) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID.WEIGHT_MILESTONE,
        title: `🎉 You've lost ${kgLost} kg!`,
        body: 'Amazing progress — keep it up!',
        schedule: { at: new Date(Date.now() + 1000) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'weight',
      }],
    });
  } catch { /* noop */ }
}

export async function notifyWeightGoalReached(): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled || !p.weightMilestones) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID.WEIGHT_GOAL,
        title: 'Goal weight reached! 🏆',
        body: 'You did it — you hit your target weight!',
        schedule: { at: new Date(Date.now() + 1000) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'weight',
      }],
    });
  } catch { /* noop */ }
}

export async function notifyStreakAchieved(days: number): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled || !p.streakNotifs) return;
  const milestones = [3, 7, 14, 30];
  if (!milestones.includes(days)) return;
  const idMap: Record<number, number> = { 3: ID.STREAK_3, 7: ID.STREAK_7, 14: ID.STREAK_14, 30: ID.STREAK_30 };
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: idMap[days],
        title: `🔥 ${days}-day streak!`,
        body: `${days} days of consistent tracking — you\'re on fire!`,
        schedule: { at: new Date(Date.now() + 1000) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'summary',
      }],
    });
  } catch { /* noop */ }
}

export async function notifyAudioGuideReady(mealName: string): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID.AUDIO_READY,
        title: 'Audio guide is ready 🔊',
        body: `Your step-by-step guide for ${mealName} is ready`,
        schedule: { at: new Date(Date.now() + 500) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'meals',
      }],
    });
  } catch { /* noop */ }
}

export async function notifyPlanExpiringSoon(daysLeft: number): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled || !p.planExpiry) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID.MEAL_PLAN_EXPIRY,
        title: `Meal plan expires in ${daysLeft} days`,
        body: 'Head to Profile to regenerate before it runs out',
        schedule: { at: new Date(Date.now() + 1000) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'meals',
      }],
    });
  } catch { /* noop */ }
}

export async function notifyNewPlanReady(): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled || !p.planExpiry) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: ID.MEAL_PLAN_READY,
        title: 'New meal plan is ready ✨',
        body: 'Your personalised plan has been generated',
        schedule: { at: new Date(Date.now() + 500) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'meals',
      }],
    });
  } catch { /* noop */ }
}

export async function notifyShoppingReminder(unboughtCount: number): Promise<void> {
  if (!isNative()) return;
  const p = useNotificationStore.getState().prefs;
  if (!p.enabled || !p.shoppingReminders) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: unboughtCount > 0 ? ID.SHOPPING_REMINDER : ID.SHOPPING,
        title: unboughtCount > 0 ? `${unboughtCount} items still unbought 🛒` : 'Your shopping list is waiting 🛒',
        body: unboughtCount > 0 ? 'Get those ingredients before you start cooking' : 'Tap to see what you need to buy',
        schedule: { at: new Date(Date.now() + 1000) },
        sound: 'default',
        smallIcon: 'ic_stat_notify',
        channelId: 'shopping',
      }],
    });
  } catch { /* noop */ }
}

// ── Android notification channels (call once on app start) ─────────────────
export async function createNotificationChannels(): Promise<void> {
  if (!isNative() || Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.createChannel({ id: 'meals', name: 'Meal Reminders', importance: 4, sound: 'default', vibration: true });
    await LocalNotifications.createChannel({ id: 'water', name: 'Water Reminders', importance: 3, sound: 'default', vibration: false });
    await LocalNotifications.createChannel({ id: 'weight', name: 'Weight Tracking', importance: 3, sound: 'default', vibration: true });
    await LocalNotifications.createChannel({ id: 'summary', name: 'Daily Summary', importance: 3, sound: 'default', vibration: false });
    await LocalNotifications.createChannel({ id: 'shopping', name: 'Shopping', importance: 3, sound: 'default', vibration: false });
    await LocalNotifications.createChannel({ id: 'digest', name: 'Recipes & Tips', importance: 2, sound: 'default', vibration: false });
    await LocalNotifications.createChannel({ id: 'tips', name: 'Nutrition Tips', importance: 2, sound: 'default', vibration: false });
  } catch { /* noop */ }
}
