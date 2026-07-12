import { useState, useEffect, useCallback } from 'react';
import { PullRefreshWrapper } from './ui/PullRefreshWrapper';
import { format, parseISO, startOfMonth, addMonths, subMonths, getDaysInMonth, getDay, addDays, startOfWeek } from 'date-fns';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { getPlanDayIndex } from '../utils/planUtils';
import { track, trackPage } from '../lib/analytics';
import { notifyPlanExpiringSoon } from '../lib/notifications';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { useTracker } from '../hooks/useTracker';
import { TrackerSummary, GoalCountdown } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { MonthlyCalorieChart } from './MonthlyCalorieChart';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Bar } from './ui';

// ── helpers ────────────────────────────────────────────────────────────────
function getMonthStr(date: Date): string { return format(date, 'yyyy-MM'); }
function todayStr(): string { return format(new Date(), 'yyyy-MM-dd'); }
function getWeekStartStr(): string {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  return monday.toISOString().split('T')[0];
}
/** Monday of the week containing dateStr (for tracker fetch) */
function getMondayOfWeek(dateStr: string): string {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}
// ── TrackerTab ─────────────────────────────────────────────────────────────
export function TrackerTab() {
  const { weekData, stats, loadWeekData } = useTracker();
  const {
    selectedDate, setSelectedDate,
    trackerCalendarMonth, setTrackerCalendarMonth,
    mealsPerDay, planDuration, planWeekStartDate,
  } = useAppStore();
  const { fetchReplacementsForWeek } = useMealReplacerStore();
  const { fetchForDate, getForDate } = useAdditionalMealsStore();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadWeekData(),
      fetchReplacementsForWeek(),
    ]);
  }, [loadWeekData, fetchReplacementsForWeek]);

  const [weeklySummary,  setWeeklySummary]  = useState<TrackerSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<TrackerSummary | null>(null);
  const [goalCountdown,  setGoalCountdown]  = useState<GoalCountdown  | null>(null);

  // Track page view once on mount
  useEffect(() => { trackPage('tracker_tab'); }, []);

  const today = todayStr();
  const currentMonthStr  = format(new Date(), 'yyyy-MM');
  const canGoForwardMonth = trackerCalendarMonth < currentMonthStr;

  useEffect(() => { fetchReplacementsForWeek(); }, [fetchReplacementsForWeek]);

  useEffect(() => {
    if (selectedDate && selectedDate <= today) fetchForDate(selectedDate);
  }, [selectedDate, fetchForDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const additionalMeals = getForDate(selectedDate);

  useEffect(() => {
    const weekStartStr = getWeekStartStr();
    const monthStr     = trackerCalendarMonth;
    Promise.allSettled([
      axios.get('/api/tracker/summary', { params: { period: 'week',  weekStart: weekStartStr }, withCredentials: true }),
      axios.get('/api/tracker/summary', { params: { period: 'month', month: monthStr         }, withCredentials: true }),
      axios.get('/api/tracker/goal-countdown', { withCredentials: true }),
    ]).then(([weekRes, monthRes, goalRes]) => {
      if (weekRes.status  === 'fulfilled') setWeeklySummary(weekRes.value.data);
      if (monthRes.status === 'fulfilled') setMonthlySummary(monthRes.value.data);
      if (goalRes.status  === 'fulfilled') {
        const countdown = goalRes.value.data;
        setGoalCountdown(countdown);
        // Notify when plan end is within 2 days
        const daysLeft = countdown?.daysLeft;
        if (typeof daysLeft === 'number' && daysLeft > 0 && daysLeft <= 2) {
          void notifyPlanExpiringSoon(daysLeft);
        }
      }
    });
  }, [trackerCalendarMonth]);

  const weekDataByDate: Record<string, typeof weekData[0]> = {};
  weekData.forEach(d => { weekDataByDate[d.date] = d; });

  // When the user taps a date in the month calendar, re-fetch tracker logs
  // for that date's week if we don't already have them.
  useEffect(() => {
    if (!weekDataByDate[selectedDate]) {
      loadWeekData(getMondayOfWeek(selectedDate));
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const adherenceValue   = typeof stats?.adherence === 'number' ? stats.adherence : 0;
  const selectedDayData  = weekDataByDate[selectedDate] ?? null;
  // Use modulo-based dayIndex so cycling plans show the correct "DAY X OF Y" label
  const selectedDayIndex = getPlanDayIndex(selectedDate, planWeekStartDate, planDuration);
  const eatenCount       = selectedDayData?.meals.filter(m => m.eaten).length ?? 0;
  const allEaten         = eatenCount === mealsPerDay;

  // Calendar grid
  const calendarMonthDate = parseISO(trackerCalendarMonth + '-01');
  const firstDayOfMonth   = startOfMonth(calendarMonthDate);
  const daysInMonth       = getDaysInMonth(calendarMonthDate);
  const firstDayWeekday   = (getDay(firstDayOfMonth) + 6) % 7;
  const calendarCells: Array<string | null> = [
    ...Array(firstDayWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      addDays(firstDayOfMonth, i).toISOString().split('T')[0]
    ),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <PullRefreshWrapper onRefresh={handleRefresh} style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0' }}>
        <HairLabel>{format(calendarMonthDate, 'MMMM yyyy').toUpperCase()}</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 400, letterSpacing: '-0.025em', marginTop: 4, lineHeight: 1 }}>
          Tracker
        </div>
      </div>

      {/* ── Empty state ── shown when no meals have ever been logged ─────── */}
      {stats != null && stats.total === 0 && weekData.length === 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{
            border: `1px solid ${s2.lineStrong}`,
            background: s2.surface,
            padding: '24px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500, color: s2.text, marginBottom: 6 }}>
              No data yet
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDimmer, lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
              Start logging meals on the Meals tab and your tracking stats will appear here.
            </div>
          </div>
        </div>
      )}

      {/* ── Big-3 summary ─────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <StatCard
          label="THIS WEEK"
          big={`${Math.round(weeklySummary?.adherencePct ?? adherenceValue)}`}
          unit="%"
          sub={`${weeklySummary?.eaten ?? stats?.eaten ?? 0}/${weeklySummary?.total ?? stats?.total ?? 0}`}
        />
        <StatCard
          label="THIS MONTH"
          big={`${Math.round(monthlySummary?.adherencePct ?? 0)}`}
          unit="%"
          sub={`${monthlySummary?.eaten ?? 0}/${monthlySummary?.total ?? 0}`}
        />
        <GoalStatCard goalCountdown={goalCountdown} />
      </div>

      {/* ── Monthly calorie chart ──────────────────────────────────────────── */}
      <div style={{ padding: '18px 20px 0' }}>
        <ErrorBoundary fallback={<div />}>
          <MonthlyCalorieChart />
        </ErrorBoundary>
      </div>

      <div style={{ height: 16 }} />
    </PullRefreshWrapper>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ label, big, unit, sub }: { label: string; big: string; unit: string; sub: string }) {
  return (
    <div style={{ border: `1px solid ${s2.line}`, padding: '12px 10px', background: s2.surface }}>
      <HairLabel>{label}</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, color: s2.accent, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>
        {big}<span style={{ fontSize: 14, color: s2.textDim }}>{unit}</span>
      </div>
      <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, letterSpacing: '0.15em', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ── GoalStatCard ───────────────────────────────────────────────────────────
function GoalStatCard({ goalCountdown }: { goalCountdown: GoalCountdown | null }) {
  if (!goalCountdown) {
    return (
      <div style={{ border: `1px solid ${s2.line}`, padding: '12px 10px', background: s2.surface }}>
        <HairLabel>GOAL ETA</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, color: s2.textDimmer, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>
          —
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing: '0.15em', marginTop: 4 }}>loading</div>
      </div>
    );
  }

  const { daysLeft, goalDate, targetWeight } = goalCountdown;

  // Server returns null for users without a weight goal (e.g. eat_healthy, maintain)
  if (daysLeft == null || !goalDate) {
    return (
      <div style={{ border: `1px solid ${s2.line}`, padding: '12px 10px', background: s2.surface }}>
        <HairLabel>GOAL ETA</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, color: s2.textDimmer, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>—</div>
        <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing: '0.15em', marginTop: 4 }}>no weight goal set</div>
      </div>
    );
  }

  let bigText: string;
  if      (daysLeft <= 0) bigText = 'DONE';
  else if (daysLeft < 7)  bigText = `${daysLeft}`;
  else                    bigText = `${Math.ceil(daysLeft / 7)}`;
  const bigUnit = daysLeft <= 0 ? '' : daysLeft < 7 ? 'd' : 'w';

  const goalDateLabel = (() => {
    try { return format(parseISO(goalDate), 'd MMM yy'); } catch { return goalDate; }
  })();

  return (
    <div style={{ border: `1px solid ${s2.line}`, padding: '12px 10px', background: s2.surface }}>
      <HairLabel>GOAL ETA</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, color: s2.accent, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>
        {bigText}<span style={{ fontSize: 14, color: s2.textDim }}>{bigUnit}</span>
      </div>
      <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, letterSpacing: '0.15em', marginTop: 4 }}>
        {targetWeight}kg · {goalDateLabel}
      </div>
    </div>
  );
}
