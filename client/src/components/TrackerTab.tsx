import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PullRefreshWrapper } from './ui/PullRefreshWrapper';
import { format, parseISO, startOfMonth, getDaysInMonth, getDay, addDays, startOfWeek } from 'date-fns';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { trackPage } from '../lib/analytics';
import { notifyPlanExpiringSoon } from '../lib/notifications';
import { useMealReplacerStore } from '../store/mealReplacerStore';
import { useTracker } from '../hooks/useTracker';
import { TrackerSummary, GoalCountdown, MonthlyMacroData, DailyMacroPoint } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import { MonthlyCalorieChart } from './MonthlyCalorieChart';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, H } from './ui';

// ── helpers ────────────────────────────────────────────────────────────────
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

// ── Metric switcher config (ref: V3_TRK) ───────────────────────────────────
type MetricKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'water' | 'adh';

const METRICS: Record<MetricKey, { label: string; unit: string; color: string; higherIsBetter: boolean }> = {
  kcal:    { label: 'Calories',  unit: 'kcal', color: s2.accentFill, higherIsBetter: false },
  protein: { label: 'Protein',   unit: 'g',    color: s2.protein,    higherIsBetter: true  },
  carbs:   { label: 'Carbs',     unit: 'g',    color: s2.carbs,      higherIsBetter: false },
  fat:     { label: 'Fat',       unit: 'g',    color: s2.fat,        higherIsBetter: false },
  fibre:   { label: 'Fibre',     unit: 'g',    color: s2.fibre,      higherIsBetter: true  },
  water:   { label: 'Water',     unit: 'L',    color: s2.water,      higherIsBetter: true  },
  adh:     { label: 'Adherence', unit: '%',    color: s2.lilac,      higherIsBetter: true  },
};

// ── TrackerTab ─────────────────────────────────────────────────────────────
export function TrackerTab() {
  const { weekData, stats, loadWeekData } = useTracker();
  const {
    selectedDate, setSelectedDate,
    trackerCalendarMonth,
  } = useAppStore();
  const { fetchReplacementsForWeek } = useMealReplacerStore();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadWeekData(),
      fetchReplacementsForWeek(),
    ]);
  }, [loadWeekData, fetchReplacementsForWeek]);

  const [weeklySummary,  setWeeklySummary]  = useState<TrackerSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<TrackerSummary | null>(null);
  const [goalCountdown,  setGoalCountdown]  = useState<GoalCountdown  | null>(null);
  const [metric,         setMetric]         = useState<MetricKey>('kcal');
  const [monthly,        setMonthly]        = useState<MonthlyMacroData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyError,   setMonthlyError]   = useState('');
  const [waterDays,      setWaterDays]      = useState<Record<string, number>>({});
  const [waterGoal,      setWaterGoal]      = useState(8);
  const monthlyChartRef = useRef<HTMLDivElement>(null);

  // Track page view once on mount
  useEffect(() => { trackPage('tracker_tab'); }, []);

  const today = todayStr();

  useEffect(() => { fetchReplacementsForWeek(); }, [fetchReplacementsForWeek]);

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

  // Per-day macro series + adherence for the visible month. One fetch serves the
  // metric switcher, the adherence calendar, the under/over cards and the
  // monthly macros card below — they all read the same response, so they cannot
  // disagree, and the month's query runs once per visit rather than twice.
  useEffect(() => {
    let cancelled = false;
    setMonthlyLoading(true);
    setMonthlyError('');
    axios.get('/api/tracker/monthly-macros', { params: { month: trackerCalendarMonth }, withCredentials: true })
      .then(res => {
        if (cancelled) return;
        setMonthly(res.data ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setMonthly(null);
        setMonthlyError('Could not load monthly data.');
      })
      .finally(() => { if (!cancelled) setMonthlyLoading(false); });
    return () => { cancelled = true; };
  }, [trackerCalendarMonth]);

  const dailyMacros: DailyMacroPoint[] = Array.isArray(monthly?.dailyData) ? monthly!.dailyData : [];

  // Water series — rolling 14 days ending today
  useEffect(() => {
    const end   = todayStr();
    const start = format(addDays(new Date(), -13), 'yyyy-MM-dd');
    axios.get('/api/water/range', { params: { start, end }, withCredentials: true })
      .then(res => {
        const map: Record<string, number> = {};
        (res.data?.days ?? []).forEach((d: { date: string; glasses: number }) => { map[d.date] = d.glasses; });
        setWaterDays(map);
        if (res.data?.goalGlasses) setWaterGoal(res.data.goalGlasses);
      })
      .catch(() => setWaterDays({}));
  }, []);

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
  // Days this month whose calorie total fell either side of target. Mirrors
  // MonthlyCalorieChart's KCAL test so the two never disagree.
  const targetDayCounts = useMemo(() => {
    const withData = dailyMacros.filter(d => d.hasData);
    const delta = (d: DailyMacroPoint) => d.calories.consumed - d.calories.target;
    return {
      under: withData.filter(d => delta(d) < 0).length,
      over:  withData.filter(d => delta(d) > 0).length,
      total: withData.length,
    };
  }, [dailyMacros]);

  // ── Metric series (last 14 entries with data) ────────────────────────────
  const m = METRICS[metric];
  const { series, target, avg } = (() => {
    if (metric === 'water') {
      const dates = Array.from({ length: 14 }, (_, i) => format(addDays(new Date(), i - 13), 'yyyy-MM-dd'));
      const s = dates.map(d => (waterDays[d] ?? 0) * 0.25);
      const t = waterGoal * 0.25;
      const a = s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
      return { series: s, target: t, avg: a };
    }
    const window14 = dailyMacros.slice(-14);
    if (metric === 'adh') {
      const s = window14.map(d => d.adherencePct ?? 0);
      const a = s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
      return { series: s, target: 100, avg: a };
    }
    const key = metric === 'kcal' ? 'calories' : metric;
    const s = window14.map(d => (d as any)[key]?.consumed ?? 0);
    const t = window14.length ? ((window14[window14.length - 1] as any)[key]?.target ?? 0) : 0;
    const a = s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
    return { series: s, target: t, avg: a };
  })();

  const fmtVal = (v: number) => metric === 'water' ? v.toFixed(1) : String(Math.round(v));
  const delta      = avg - target;
  const deltaGood  = m.higherIsBetter ? delta >= 0 : delta <= 0;
  const deltaLabel = `${delta >= 0 ? '+' : '−'}${fmtVal(Math.abs(delta))} / day`;

  // Chart geometry (ref: V3Tracker)
  const W = 300, CH = 104, PT = 10, PB = 10;
  const hasSeries = series.length >= 2;
  const maxV = Math.max(target, ...series, 1) * 1.06;
  const minV = Math.max(0, Math.min(...(series.length ? series : [0])) * 0.86);
  const xs = series.map((_, i) => (i / Math.max(series.length - 1, 1)) * W);
  const ys = series.map(v => CH - PB - ((v - minV) / (maxV - minV)) * (CH - PT - PB));
  const tY = CH - PB - ((target - minV) / (maxV - minV)) * (CH - PT - PB);
  const linePath = xs.map((x, i) => `${i ? 'L' : 'M'} ${x} ${ys[i]}`).join(' ');
  const windowDates = metric === 'water'
    ? { first: format(addDays(new Date(), -13), 'd MMM'), last: format(new Date(), 'd MMM') }
    : {
        first: dailyMacros.length ? format(parseISO(dailyMacros.slice(-14)[0].date), 'd MMM') : '',
        last:  dailyMacros.length ? format(parseISO(dailyMacros[dailyMacros.length - 1].date), 'd MMM') : '',
      };

  // ── Adherence calendar cells ─────────────────────────────────────────────
  const adherenceByDate: Record<string, DailyMacroPoint> = {};
  dailyMacros.forEach(d => { adherenceByDate[d.date] = d; });

  const calendarMonthDate = parseISO(trackerCalendarMonth + '-01');
  const firstDayOfMonth   = startOfMonth(calendarMonthDate);
  const daysInMonth       = getDaysInMonth(calendarMonthDate);
  const firstDayWeekday   = (getDay(firstDayOfMonth) + 6) % 7;
  const calendarCells: Array<string | null> = [
    ...Array(firstDayWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      format(addDays(firstDayOfMonth, i), 'yyyy-MM-dd')
    ),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const calendarWeeks = Array.from({ length: calendarCells.length / 7 }, (_, i) => calendarCells.slice(i * 7, i * 7 + 7));

  return (
    <PullRefreshWrapper onRefresh={handleRefresh} style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 110 }}>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0' }}>
        <HairLabel>{format(calendarMonthDate, 'MMMM yyyy').toUpperCase()}</HairLabel>
        <H size={32} style={{ marginTop: 6 }}>Tracker</H>
      </div>

      {/* ── Empty state ── shown when no meals have ever been logged ─────── */}
      {stats != null && stats.total === 0 && weekData.length === 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <Card padding={28} radius={28} border={s2.lineStrong} style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: s2.rPill, background: s2.bg, margin: '0 auto 14px', display: 'grid', placeItems: 'center', fontSize: 24 }}>📋</div>
            <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 700, color: s2.text }}>
              No data yet
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, fontWeight: 500, color: s2.textDimmer, lineHeight: 1.6, maxWidth: 260, margin: '8px auto 0' }}>
              Start logging meals on the Meals tab and your tracking stats will appear here.
            </div>
          </Card>
        </div>
      )}

      {/* ── Big-3 pastel summary ──────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <StatCard
          bg={s2.mint}
          label="THIS WEEK"
          big={`${Math.round(weeklySummary?.adherencePct ?? adherenceValue)}`}
          unit="%"
          sub={`${weeklySummary?.eaten ?? stats?.eaten ?? 0} / ${weeklySummary?.total ?? stats?.total ?? 0} meals`}
        />
        <StatCard
          bg={s2.butter}
          label="THIS MONTH"
          big={`${Math.round(monthlySummary?.adherencePct ?? 0)}`}
          unit="%"
          sub={`${monthlySummary?.eaten ?? 0} / ${monthlySummary?.total ?? 0} meals`}
        />
        <GoalStatCard goalCountdown={goalCountdown} />
      </div>

      {/* ── Under / over target days ───────────────────────────────────────
          Moved up from inside the monthly-macros card. There they were
          recomputed per macro tab; here they sit above the tabs, so they are
          fixed to calories — the default tab and the only reading that makes
          sense out of that context. Same source and the same test the chart
          uses (a day with data whose delta falls either side of target). */}
      {targetDayCounts.total > 0 && (
        <div style={{ padding: '8px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          <StatCard
            bg={s2.mint}
            label="UNDER TARGET"
            big={String(targetDayCounts.under)}
            unit="days"
            sub="calories below plan"
          />
          <StatCard
            bg={s2.peach}
            label="OVER TARGET"
            big={String(targetDayCounts.over)}
            unit="days"
            sub="calories above plan"
          />
        </div>
      )}

      {/* ── Metric switcher chart (dark card) ─────────────────────────────── */}
      <div style={{ padding: '12px 20px 0' }}>
        <Card bg={s2.ink} radius={30} padding={18}>
          {/* metric pills */}
          <div className="scrollbar-hide" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 16 }}>
            {(Object.keys(METRICS) as MetricKey[]).map(k => {
              const on = k === metric;
              return (
                <button key={k} onClick={() => setMetric(k)} style={{
                  border: 'none', cursor: 'pointer', borderRadius: s2.rPill, padding: '7px 13px', flexShrink: 0,
                  background: on ? METRICS[k].color : 'rgba(246,247,243,0.09)',
                  color: on ? s2.ink : s2.onDarkDim, fontFamily: s2.sans, fontSize: 11.5, fontWeight: 700,
                }}>{METRICS[k].label}</button>
              );
            })}
          </div>

          {/* average + delta */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <HairLabel color={s2.onDarkDimmer}>DAILY AVERAGE · 14 DAYS</HairLabel>
              <div style={{ fontFamily: s2.disp, fontSize: 40, fontWeight: 700, letterSpacing: '-0.045em', color: s2.onDark, lineHeight: 1, marginTop: 7 }}>
                {fmtVal(avg)}
                <span style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 600, color: s2.onDarkDim, marginLeft: 5 }}>{m.unit}</span>
              </div>
            </div>
            <span style={{
              fontFamily: s2.sans, fontSize: 10.5, fontWeight: 700,
              background: deltaGood ? 'rgba(198,242,78,0.16)' : 'rgba(229,72,77,0.18)',
              color: deltaGood ? s2.accentFill : '#FF8A8D',
              borderRadius: s2.rPill, padding: '6px 11px', whiteSpace: 'nowrap',
            }}>
              {delta <= 0 ? '▼' : '▲'} {deltaLabel}
            </span>
          </div>

          {/* line chart */}
          <div style={{ height: CH, marginTop: 14 }}>
            {hasSeries ? (
              <svg width="100%" height="100%" viewBox={`0 0 ${W} ${CH}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`trkGrad_${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={m.color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={m.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1={tY} x2={W} y2={tY} stroke="rgba(246,247,243,0.28)" strokeDasharray="3,4" strokeWidth="0.7" />
                <path d={`${linePath} L ${W} ${CH} L 0 ${CH} Z`} fill={`url(#trkGrad_${metric})`} />
                <path d={linePath} fill="none" stroke={m.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.4" fill={m.color} />
              </svg>
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontFamily: s2.sans, fontSize: 12, fontWeight: 600, color: s2.onDarkDimmer }}>
                Not enough data yet
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: s2.sans, fontSize: 10, fontWeight: 600, color: s2.onDarkDimmer, fontVariantNumeric: 'tabular-nums' }}>
            <span>{windowDates.first}</span>
            <span>Target {fmtVal(target)}{m.unit}</span>
            <span>{windowDates.last}</span>
          </div>
        </Card>
      </div>

      {/* ── Plan adherence calendar ───────────────────────────────────────── */}
      <div style={{ padding: '12px 20px 0' }}>
        <Card radius={26} padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <HairLabel>PLAN ADHERENCE · {format(calendarMonthDate, 'MMMM').toUpperCase()}</HairLabel>
            <span
              style={{ fontFamily: s2.sans, fontSize: 12, fontWeight: 700, color: s2.accent, cursor: 'pointer' }}
              onClick={() => monthlyChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Monthly macros →
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 6 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: s2.sans, fontSize: 9.5, fontWeight: 700, color: s2.textDimmer }}>{d}</div>
            ))}
          </div>
          {calendarWeeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
              {week.map((date, di) => {
                if (!date) return <div key={di} />;
                const entry   = adherenceByDate[date];
                const pct     = entry?.adherencePct ?? null;
                const has     = pct != null && date <= today;
                const isToday = date === today;
                const dayNum  = parseInt(date.slice(8), 10);
                return (
                  <div
                    key={di}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      aspectRatio: '1', borderRadius: 11, display: 'grid', placeItems: 'center', cursor: 'pointer',
                      background: !has
                        ? 'rgba(15,20,15,0.04)'
                        : pct! >= 100
                          ? s2.accentFill
                          : `rgba(198,242,78,${0.25 + (pct! / 100) * 0.5})`,
                      boxShadow: isToday
                        ? `inset 0 0 0 1.5px ${s2.ink}`
                        : date === selectedDate
                          ? `inset 0 0 0 1.5px ${s2.accent}`
                          : 'none',
                    }}
                  >
                    <span style={{ fontFamily: s2.sans, fontSize: 10, fontWeight: isToday ? 800 : 700, color: has ? s2.ink : s2.textDimmer }}>
                      {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            {([['All meals', s2.accentFill], ['Partial', 'rgba(198,242,78,0.5)'], ['No data', 'rgba(15,20,15,0.04)']] as const).map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
                <HairLabel style={{ fontSize: 7.5 }}>{label}</HairLabel>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Monthly macros chart ──────────────────────────────────────────── */}
      <div ref={monthlyChartRef} style={{ padding: '18px 20px 0' }}>
        <ErrorBoundary fallback={<div />}>
          <MonthlyCalorieChart data={monthly} loading={monthlyLoading} error={monthlyError} />
        </ErrorBoundary>
      </div>

      <div style={{ height: 16 }} />
    </PullRefreshWrapper>
  );
}

// ── StatCard (pastel) ──────────────────────────────────────────────────────
function StatCard({ bg, label, big, unit, sub }: { bg: string; label: string; big: string; unit: string; sub: string }) {
  return (
    <Card bg={bg} radius={20} padding={14}>
      <HairLabel color="rgba(15,20,15,0.5)">{label}</HairLabel>
      <div style={{ fontFamily: s2.disp, fontSize: 30, fontWeight: 700, color: s2.ink, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 8 }}>
        {big}<span style={{ fontSize: 14 }}>{unit}</span>
      </div>
      <div style={{ fontFamily: s2.sans, fontSize: 9.5, fontWeight: 600, color: 'rgba(15,20,15,0.5)', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>
    </Card>
  );
}

// ── GoalStatCard (peach) ───────────────────────────────────────────────────
function GoalStatCard({ goalCountdown }: { goalCountdown: GoalCountdown | null }) {
  if (!goalCountdown) {
    return <StatCard bg={s2.peach} label="GOAL ETA" big="—" unit="" sub="loading" />;
  }

  const { daysLeft, goalDate, targetWeight } = goalCountdown;

  // Server returns null for users without a weight goal (e.g. eat_healthy, maintain)
  if (daysLeft == null || !goalDate) {
    return <StatCard bg={s2.peach} label="GOAL ETA" big="—" unit="" sub="no weight goal set" />;
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
    <StatCard bg={s2.peach} label="GOAL ETA" big={bigText} unit={bigUnit} sub={`${targetWeight} kg · ${goalDateLabel}`} />
  );
}
