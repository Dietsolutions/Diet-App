import { useState } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { requestNotificationPermission, scheduleAllNotifications } from '../lib/notifications';
import { s2 } from '../theme/tokens';
import { HairLabel, Card } from './ui';
import { Capacitor } from '@capacitor/core';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: on ? s2.accentFill : s2.line,
        cursor: 'pointer', position: 'relative', transition: 'background 200ms',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 200ms',
      }} />
    </button>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        borderRadius: s2.rMd,
        background: s2.surface2, border: `1px solid ${s2.line}`,
        color: s2.text, fontFamily: s2.mono, fontSize: 12,
        padding: '4px 8px', outline: 'none',
        colorScheme: 'dark',
      }}
    />
  );
}

function Row({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${s2.line}` }}>
      <div>
        <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.text }}>{label}</div>
        {sub && <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer, marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function NotificationSettings() {
  const { prefs, setPrefs, setMealTime, permissionGranted } = useNotificationStore();
  const [requesting, setRequesting] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    return (
      <Card padding={14}>
        <HairLabel style={{ marginBottom: 8 }}>NOTIFICATIONS</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDimmer, lineHeight: 1.5 }}>
          Push notifications are available in the iOS and Android apps.
        </div>
      </Card>
    );
  }

  const handleMasterToggle = async (on: boolean) => {
    if (on && !permissionGranted) {
      setRequesting(true);
      const granted = await requestNotificationPermission();
      setRequesting(false);
      if (!granted) return;
    }
    const next = { ...prefs, enabled: on };
    setPrefs({ enabled: on });
    await scheduleAllNotifications(next);
  };

  const handleToggle = async (key: keyof typeof prefs, val: boolean) => {
    const next = { ...prefs, [key]: val };
    setPrefs({ [key]: val });
    if (prefs.enabled) await scheduleAllNotifications(next);
  };

  const handleMealTime = async (meal: 'breakfast' | 'lunch' | 'dinner', time: string) => {
    setMealTime(meal, time);
    if (prefs.enabled) {
      await scheduleAllNotifications({ ...prefs, mealTimes: { ...prefs.mealTimes, [meal]: time } });
    }
  };

  const handleIntervalChange = async (hours: number) => {
    const next = { ...prefs, waterIntervalHours: hours };
    setPrefs({ waterIntervalHours: hours });
    if (prefs.enabled) await scheduleAllNotifications(next);
  };

  return (
    <div>
      {/* Master toggle */}
      <div style={{
            borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `1px solid ${prefs.enabled ? s2.accent : s2.line}`, background: prefs.enabled ? s2.accentFill : s2.surface, marginBottom: 2 }}>
        <div>
          <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, color: prefs.enabled ? s2.accent : s2.text }}>
            {requesting ? 'Requesting permission…' : 'Notifications'}
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer, marginTop: 2 }}>
            {prefs.enabled ? 'Active — tap to disable' : 'Enable to get reminders'}
          </div>
        </div>
        <Toggle on={prefs.enabled} onChange={handleMasterToggle} />
      </div>

      {prefs.enabled && (
        <Card padding={14}>
          {/* Meal reminders */}
          <HairLabel style={{ marginBottom: 8 }}>MEAL REMINDERS</HairLabel>
          <Row label="Meal reminders" sub="Breakfast, lunch & dinner alerts" on={prefs.mealReminders} onChange={(v) => handleToggle('mealReminders', v)} />
          <Row label="Follow-up if not logged" sub="2 hours after each meal time" on={prefs.mealFollowUps} onChange={(v) => handleToggle('mealFollowUps', v)} />
          <Row label="Plan expiry alerts" sub="2 days before plan ends" on={prefs.planExpiry} onChange={(v) => handleToggle('planExpiry', v)} />

          {prefs.mealReminders && (
            <div style={{ paddingTop: 10 }}>
              <HairLabel style={{ marginBottom: 8, fontSize: 8 }}>MEAL TIMES</HairLabel>
              {(['breakfast', 'lunch', 'dinner'] as const).map((m) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${s2.line}` }}>
                  <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, textTransform: 'capitalize' }}>{m}</div>
                  <TimeInput value={prefs.mealTimes[m]} onChange={(t) => handleMealTime(m, t)} />
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 14 }} />

          {/* Water */}
          <HairLabel style={{ marginBottom: 8 }}>WATER & WELLNESS</HairLabel>
          <Row label="Water reminders" sub={`Every ${prefs.waterIntervalHours}h — tap water to adjust`} on={prefs.waterReminders} onChange={(v) => handleToggle('waterReminders', v)} />
          {prefs.waterReminders && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${s2.line}` }}>
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim }}>Interval</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4].map((h) => (
                  <button key={h} onClick={() => handleIntervalChange(h)} style={{
                    borderRadius: s2.rPill,
                    padding: '4px 10px', border: `1px solid ${prefs.waterIntervalHours === h ? s2.accent : s2.line}`,
                    background: prefs.waterIntervalHours === h ? s2.accentFill : 'transparent',
                    fontFamily: s2.mono, fontSize: 10, color: prefs.waterIntervalHours === h ? s2.accent : s2.textDim,
                    cursor: 'pointer', letterSpacing: '0.06em',
                  }}>{h}h</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 14 }} />

          {/* Weight */}
          <HairLabel style={{ marginBottom: 8 }}>WEIGHT TRACKING</HairLabel>
          <Row label="Daily weigh-in reminder" sub="Morning reminder + 10 AM follow-up" on={prefs.weightReminders} onChange={(v) => handleToggle('weightReminders', v)} />
          <Row label="Milestone celebrations" sub="Every 1 kg lost, halfway, goal reached" on={prefs.weightMilestones} onChange={(v) => handleToggle('weightMilestones', v)} />
          {prefs.weightReminders && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${s2.line}` }}>
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim }}>Reminder time</div>
              <TimeInput value={prefs.weightReminderTime} onChange={async (t) => {
                const next = { ...prefs, weightReminderTime: t };
                setPrefs({ weightReminderTime: t });
                if (prefs.enabled) await scheduleAllNotifications(next);
              }} />
            </div>
          )}

          <div style={{ height: 14 }} />

          {/* Other */}
          <HairLabel style={{ marginBottom: 8 }}>OTHER REMINDERS</HairLabel>
          <Row label="Shopping reminders" sub="When items are unbought" on={prefs.shoppingReminders} onChange={(v) => handleToggle('shoppingReminders', v)} />
          <Row label="Daily summary" sub={`${prefs.eveningReminderTime} — how you did today`} on={prefs.dailySummary} onChange={(v) => handleToggle('dailySummary', v)} />
          <Row label="Streak notifications" sub="At 3, 7, 14, 30-day milestones" on={prefs.streakNotifs} onChange={(v) => handleToggle('streakNotifs', v)} />
          <Row label="Re-engagement reminder" sub="After 3+ days of inactivity" on={prefs.reengagement} onChange={(v) => handleToggle('reengagement', v)} />
          <Row label="Recipe digest" sub="Weekly new recipe picks" on={prefs.recipeDigest} onChange={(v) => handleToggle('recipeDigest', v)} />
          <div style={{ borderBottom: 'none' }}>
            <Row label="Nutrition tips" sub="Weekly knowledge & tips" on={prefs.tipsNotifs} onChange={(v) => handleToggle('tipsNotifs', v)} />
          </div>
        </Card>
      )}
    </div>
  );
}
