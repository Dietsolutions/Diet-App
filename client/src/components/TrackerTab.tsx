import { useState, useEffect } from 'react';
import { format, parseISO, startOfMonth, addMonths, subMonths, getDaysInMonth, getDay, addDays, startOfWeek } from 'date-fns';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useTracker } from '../hooks/useTracker';
import { TrackerSummary, GoalCountdown } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { MonthlyCalorieChart } from './MonthlyCalorieChart';

// ── Helpers ────────────────────────────────────────────────────────────────
// Use format() (local time) not toISOString() (UTC) to avoid timezone off-by-one
function getMonthStr(date: Date): string {
  return format(date, 'yyyy-MM');
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function getWeekStartStr(): string {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  return monday.toISOString().split('T')[0];
}

// ── TrackerTab ─────────────────────────────────────────────────────────────
export function TrackerTab() {
  const { weekData, stats, weekStart, toggleMeal } = useTracker();
  const {
    selectedDate, setSelectedDate,
    trackerCalendarMonth, setTrackerCalendarMonth,
    navigateToMealsFromTracker, mealsPerDay, planDuration
  } = useAppStore();
  const { fetchReplacementsForWeek } = useMealReplacerStore();

  const [weeklySummary, setWeeklySummary] = useState<TrackerSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<TrackerSummary | null>(null);
  const [goalCountdown, setGoalCountdown] = useState<GoalCountdown | null>(null);

  const today = todayStr();
  // Use format() (local time) to stay consistent with getMonthStr
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const canGoForwardMonth = trackerCalendarMonth < currentMonthStr;

  useEffect(() => {
    fetchReplacementsForWeek();
  }, [fetchReplacementsForWeek]);

  // Fetch weekly + monthly summaries + goal countdown
  useEffect(() => {
    const weekStartStr = getWeekStartStr();
    const monthStr = trackerCalendarMonth;

    Promise.allSettled([
      axios.get('/api/tracker/summary', { params: { period: 'week', weekStart: weekStartStr }, withCredentials: true }),
      axios.get('/api/tracker/summary', { params: { period: 'month', month: monthStr }, withCredentials: true }),
      axios.get('/api/tracker/goal-countdown', { withCredentials: true }),
    ]).then(([weekRes, monthRes, goalRes]) => {
      if (weekRes.status === 'fulfilled') setWeeklySummary(weekRes.value.data);
      if (monthRes.status === 'fulfilled') setMonthlySummary(monthRes.value.data);
      if (goalRes.status === 'fulfilled') setGoalCountdown(goalRes.value.data);
    });
  }, [trackerCalendarMonth]);

  // Map weekData by date for quick lookup
  const weekDataByDate: Record<string, typeof weekData[0]> = {};
  weekData.forEach(d => { weekDataByDate[d.date] = d; });

  const adherenceValue = typeof stats?.adherence === 'number' ? stats.adherence : 0;

  const selectedDayData = weekDataByDate[selectedDate] ?? null;
  const selectedDayIndex = selectedDayData?.dayIndex ?? weekData.findIndex(d => d.date === selectedDate);

  const eatenCount = selectedDayData?.meals.filter(m => m.eaten).length ?? 0;
  const allEaten = eatenCount === mealsPerDay;

  const handleMarkAll = () => {
    if (!selectedDayData) return;
    selectedDayData.meals.forEach(m => {
      if (!m.eaten) toggleMeal(selectedDayData.date, m.mealIndex, false);
    });
  };

  const handleUnmarkAll = () => {
    if (!selectedDayData) return;
    selectedDayData.meals.forEach(m => {
      if (m.eaten) toggleMeal(selectedDayData.date, m.mealIndex, true);
    });
  };

  // Month calendar
  const calendarMonthDate = parseISO(trackerCalendarMonth + '-01');
  const firstDayOfMonth = startOfMonth(calendarMonthDate);
  const daysInMonth = getDaysInMonth(calendarMonthDate);
  // day-of-week of first day (0=Sun → 6=Sat, we want Mon=0)
  const firstDayWeekday = (getDay(firstDayOfMonth) + 6) % 7; // 0=Mon, 6=Sun
  const totalCells = firstDayWeekday + daysInMonth;

  const calendarCells: Array<string | null> = [
    ...Array(firstDayWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      addDays(firstDayOfMonth, i).toISOString().split('T')[0]
    )
  ];
  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      {/* ── Summary Row: Week | Month | Goal ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <AdherenceCard
          label="This Week"
          eaten={weeklySummary?.eaten ?? stats?.eaten ?? 0}
          total={weeklySummary?.total ?? stats?.total ?? 0}
          pct={weeklySummary?.adherencePct ?? adherenceValue}
        />
        <AdherenceCard
          label="This Month"
          eaten={monthlySummary?.eaten ?? 0}
          total={monthlySummary?.total ?? 0}
          pct={monthlySummary?.adherencePct ?? 0}
        />
        <GoalCard goalCountdown={goalCountdown} />
      </div>

      {/* ── Monthly Calorie Chart ──────────────────────────────────────── */}
      <ErrorBoundary fallback={<div />}>
        <MonthlyCalorieChart />
      </ErrorBoundary>

      {/* ── Month Calendar ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setTrackerCalendarMonth(getMonthStr(subMonths(calendarMonthDate, 1)))}
            className="p-1.5 rounded-lg text-primary hover:bg-elevated transition-colors"
          >
            ←
          </button>
          <h2 className="font-display font-bold text-primary text-base">
            {format(calendarMonthDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => canGoForwardMonth && setTrackerCalendarMonth(getMonthStr(addMonths(calendarMonthDate, 1)))}
            disabled={!canGoForwardMonth}
            className={`p-1.5 rounded-lg transition-colors ${canGoForwardMonth ? 'text-primary hover:bg-elevated' : 'text-dimmed/40 cursor-not-allowed'}`}
          >
            →
          </button>
        </div>

        <div className="bg-surface rounded-2xl p-3 border border-border card-glow">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <div key={d} className="text-center text-[10px] text-dimmed font-sans font-semibold py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((date, idx) => {
              if (!date) return <div key={idx} />;
              const isFuture = date > today;
              const isToday = date === today;
              const isSelected = date === selectedDate;
              const dayData = weekDataByDate[date];
              const isPlan = !!dayData;
              const eaten = dayData?.meals.filter(m => m.eaten).length ?? 0;
              const total = mealsPerDay;

              return (
                <button
                  key={date}
                  onClick={() => { if (!isFuture) setSelectedDate(date); }}
                  disabled={isFuture}
                  className={`flex flex-col items-center py-1.5 rounded-lg transition-all ${
                    isFuture ? 'opacity-35 cursor-not-allowed' :
                    isSelected ? 'bg-accent text-white' :
                    isToday ? 'bg-accent/20' : 'hover:bg-elevated'
                  }`}
                >
                  <span className={`text-xs font-mono font-bold ${
                    isSelected ? 'text-white' : isToday ? 'text-accent' : 'text-primary'
                  }`}>
                    {format(parseISO(date), 'd')}
                  </span>
                  {isPlan && (
                    <div className="flex gap-[2px] mt-0.5">
                      {Array.from({ length: Math.min(total, 4) }, (_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-1 rounded-full ${
                            i < eaten
                              ? isSelected ? 'bg-white' : 'bg-success'
                              : isSelected ? 'bg-white/40' : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Selected Day Detail ─────────────────────────────────────────── */}
      {selectedDate && selectedDayData && (
        <div className="bg-surface rounded-2xl p-4 space-y-4 border border-border card-glow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dimmed text-xs font-sans uppercase tracking-wide">
                Day {selectedDayIndex + 1} of {planDuration}
              </p>
              <h3 className="font-display font-bold text-primary text-xl">
                {format(parseISO(selectedDate), 'EEEE, MMM d')}
              </h3>
            </div>
            <div className={`text-sm font-semibold font-sans px-3 py-1 rounded-full ${
              allEaten ? 'bg-success-fill text-success' : 'bg-elevated text-secondary'
            }`}>
              {eatenCount}/{mealsPerDay} eaten
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-sans text-secondary">
              <span>Meals eaten</span>
              <span className="font-mono">{Math.round(eatenCount / mealsPerDay * 100)}%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-success to-success/70 rounded-full progress-fill"
                style={{ width: `${(eatenCount / mealsPerDay) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigateToMealsFromTracker(selectedDayIndex, selectedDate)}
              className="flex-1 bg-accent text-white font-semibold font-sans py-2.5 rounded-[14px] text-sm active:scale-95 transition-all"
            >
              View Meal Plan
            </button>
            <button
              onClick={allEaten ? handleUnmarkAll : handleMarkAll}
              className="flex-1 bg-elevated text-primary font-semibold font-sans py-2.5 rounded-[14px] text-sm active:scale-95 transition-all hover:bg-elevated/80 border border-border"
            >
              {allEaten ? 'Unmark All' : 'Mark All Eaten'}
            </button>
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

// ── AdherenceCard ─────────────────────────────────────────────────────────
// Compact card used in the 3-column summary row
function AdherenceCard({ label, eaten, total, pct }: { label: string; eaten: number; total: number; pct: number }) {
  return (
    <div style={{
      background: '#1A1D27',
      border: '1px solid #2A2D3E',
      borderRadius: 12,
      padding: '12px 10px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    }}>
      <p style={{ fontSize: 10, fontFamily: 'sans-serif', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontFamily: 'Playfair Display, serif', fontWeight: 700, color: '#E2E8F0', lineHeight: 1, margin: 0 }}>
        {pct}<span style={{ fontSize: 13, color: '#9CA3AF' }}>%</span>
      </p>
      <p style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#9CA3AF', margin: 0 }}>
        {eaten}/{total} meals
      </p>
      <div style={{ width: '100%', height: 4, background: '#2A2D3E', borderRadius: 9999, overflow: 'hidden', marginTop: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#4CAF82', borderRadius: 9999, transition: 'width 500ms ease' }} />
      </div>
    </div>
  );
}

// ── GoalCard ───────────────────────────────────────────────────────────────
// Compact goal countdown card for the 3-column summary row
function GoalCard({ goalCountdown }: { goalCountdown: GoalCountdown | null }) {
  if (!goalCountdown) {
    return (
      <div style={{
        background: '#1A1D27',
        border: '1px solid #2A2D3E',
        borderRadius: 12,
        padding: '12px 10px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}>
        <p style={{ fontSize: 10, fontFamily: 'sans-serif', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          🎯 Goal
        </p>
        <p style={{ fontSize: 18, fontFamily: 'Playfair Display, serif', fontWeight: 700, color: '#6B7280', lineHeight: 1, margin: 0 }}>
          —
        </p>
        <p style={{ fontSize: 10, fontFamily: 'sans-serif', color: '#6B7280', margin: 0 }}>
          loading…
        </p>
      </div>
    );
  }

  const { daysLeft, weeksLeft, goalDate, targetWeight } = goalCountdown;

  // Display format
  let bigText: string;
  if (daysLeft <= 0) bigText = '🎉';
  else if (daysLeft < 7) bigText = `${daysLeft}d`;
  else bigText = `${Math.ceil(daysLeft / 7)}wks`;

  // Colour thresholds
  const bigColor = daysLeft <= 0
    ? '#4CAF82'
    : daysLeft < 7
      ? '#DC2626'
      : daysLeft <= 28
        ? '#F0B429'
        : '#E2E8F0';

  const goalDateLabel = (() => {
    try { return format(parseISO(goalDate), 'd MMM yy'); } catch { return goalDate; }
  })();

  return (
    <div style={{
      background: '#1A1D27',
      border: '1px solid #2A2D3E',
      borderRadius: 12,
      padding: '12px 10px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    }}>
      <p style={{ fontSize: 10, fontFamily: 'sans-serif', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
        🎯 Goal
      </p>
      <p style={{ fontSize: 20, fontFamily: 'Playfair Display, serif', fontWeight: 700, color: bigColor, lineHeight: 1, margin: 0 }}>
        {bigText}
      </p>
      <p style={{ fontSize: 10, fontFamily: 'sans-serif', color: '#9CA3AF', margin: 0 }}>
        {targetWeight}kg · {goalDateLabel}
      </p>
      {daysLeft > 0 && (
        <div style={{ width: '100%', height: 4, background: '#2A2D3E', borderRadius: 9999, overflow: 'hidden', marginTop: 2 }} />
      )}
    </div>
  );
}
