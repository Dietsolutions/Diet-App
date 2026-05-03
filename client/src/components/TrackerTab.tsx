import { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, addMonths, subMonths, getDaysInMonth, getDay, addDays, startOfWeek } from 'date-fns';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { track, trackPage } from '../lib/analytics';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useAdditionalMealsStore } from '../store/additionalMealsStore';
import { useTracker } from '../hooks/useTracker';
import { TrackerSummary, GoalCountdown } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { MonthlyCalorieChart } from './MonthlyCalorieChart';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Bar } from './ui';

// ── helpers (unchanged from original) ─────────────────────────────────────
function getMonthStr(date: Date): string { return format(date, 'yyyy-MM'); }
function todayStr(): string { return format(new Date(), 'yyyy-MM-dd'); }
function getWeekStartStr(): string {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  return monday.toISOString().split('T')[0];
}

// ── TrackerTab ─────────────────────────────────────────────────────────────
export function TrackerTab() {
  const { weekData, stats, toggleMeal } = useTracker();
  const {
    selectedDate, setSelectedDate,
    trackerCalendarMonth, setTrackerCalendarMonth,
    mealsPerDay, planDuration,
  } = useAppStore();
  const { fetchReplacementsForWeek } = useMealReplacerStore();
  const { fetchForDate, getForDate } = useAdditionalMealsStore();

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
      if (goalRes.status  === 'fulfilled') setGoalCountdown(goalRes.value.data);
    });
  }, [trackerCalendarMonth]);

  const weekDataByDate: Record<string, typeof weekData[0]> = {};
  weekData.forEach(d => { weekDataByDate[d.date] = d; });

  const adherenceValue   = typeof stats?.adherence === 'number' ? stats.adherence : 0;
  const selectedDayData  = weekDataByDate[selectedDate] ?? null;
  const selectedDayIndex = selectedDayData?.dayIndex ?? weekData.findIndex(d => d.date === selectedDate);
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
    <div style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0' }}>
        <HairLabel>{format(calendarMonthDate, 'MMMM yyyy').toUpperCase()}</HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 400, letterSpacing: '-0.025em', marginTop: 4, lineHeight: 1 }}>
          Tracker
        </div>
      </div>

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

      {/* ── Month calendar ─────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 20px 0' }}>
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button
            onClick={() => {
              const newMonth = getMonthStr(subMonths(calendarMonthDate, 1));
              setTrackerCalendarMonth(newMonth);
              track('macro_chart_month_navigated', { direction: 'back', month: newMonth });
            }}
            style={{ background: 'transparent', border: `1px solid ${s2.lineStrong}`, width: 28, height: 28, color: s2.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M6 1 L2 5 L6 9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </button>
          <HairLabel>{format(calendarMonthDate, 'MMMM yyyy').toUpperCase()}</HairLabel>
          <button
            onClick={() => {
              if (!canGoForwardMonth) return;
              const newMonth = getMonthStr(addMonths(calendarMonthDate, 1));
              setTrackerCalendarMonth(newMonth);
              track('macro_chart_month_navigated', { direction: 'forward', month: newMonth });
            }}
            disabled={!canGoForwardMonth}
            style={{ background: 'transparent', border: `1px solid ${s2.lineStrong}`, width: 28, height: 28, color: canGoForwardMonth ? s2.text : s2.textDimmer, cursor: canGoForwardMonth ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M4 1 L8 5 L4 9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </button>
        </div>

        <Card padding={14}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {calendarCells.map((date, idx) => {
              if (!date) return <div key={idx} />;
              const isFuture  = date > today;
              const isSelected = date === selectedDate;
              const dayData   = weekDataByDate[date];
              const isPlan    = !!dayData;
              const eaten     = dayData?.meals.filter(m => m.eaten).length ?? 0;
              const adherePct = isPlan ? Math.round((eaten / Math.max(mealsPerDay, 1)) * 100) : 0;

              return (
                <button
                  key={date}
                  onClick={() => { if (!isFuture) setSelectedDate(date); }}
                  disabled={isFuture}
                  style={{
                    aspectRatio: '1',
                    background: isSelected
                      ? s2.accent
                      : isPlan && !isFuture
                        ? `rgba(255,106,42,${adherePct / 100 * 0.5})`
                        : s2.surface2,
                    border: `1px solid ${isSelected ? s2.accent : s2.line}`,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: isFuture ? 'default' : 'pointer',
                    opacity: isFuture ? 0.35 : 1,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: 4,
                    fontFamily: s2.mono,
                    fontSize: 9,
                    fontWeight: 600,
                    color: isSelected ? '#0C0907' : isPlan && adherePct === 100 ? s2.accent : s2.textDim,
                    zIndex: 2,
                  }}>
                    {format(parseISO(date), 'd')}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Selected day detail ────────────────────────────────────────────── */}
      {selectedDate && selectedDayData && (
        <div style={{ padding: '18px 20px 0' }}>
          <Card padding={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <HairLabel>DAY {selectedDayIndex + 1} OF {planDuration}</HairLabel>
                <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, marginTop: 4, letterSpacing: '-0.02em' }}>
                  {format(parseISO(selectedDate), 'EEEE, d MMM')}
                </div>
              </div>
              <div style={{
                fontFamily: s2.mono,
                fontSize: 11,
                letterSpacing: '0.15em',
                color: allEaten ? s2.accent : s2.textDim,
                border: `1px solid ${allEaten ? s2.accent : s2.lineStrong}`,
                padding: '4px 8px',
                textTransform: 'uppercase',
              }}>
                {eatenCount}/{mealsPerDay} EATEN
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginBottom: 6 }}>
                <span>MEALS</span>
                <span>{Math.round((eatenCount / Math.max(mealsPerDay, 1)) * 100)}%</span>
              </div>
              <Bar pct={eatenCount / Math.max(mealsPerDay, 1)} color={s2.accent} h={3} />
            </div>

            {/* Extra meals for selected day */}
            {additionalMeals.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${s2.line}` }}>
                <HairLabel style={{ marginBottom: 8 }}>EXTRA MEALS LOGGED</HairLabel>
                {additionalMeals.map(extra => (
                  <div key={extra.id} style={{ display: 'flex', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${s2.line}` }}>
                    <div style={{ flex: 1, fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>{extra.foodName}</div>
                    <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer }}>
                      {Math.round(extra.calories)} kcal
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
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
