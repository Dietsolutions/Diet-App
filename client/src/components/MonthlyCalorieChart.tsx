import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip, Cell,
} from 'recharts';
import { useAppStore } from '../store/appStore';

// ── Types ──────────────────────────────────────────────────────────────────
type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fibre';

interface MacroTotals {
  consumed: number; target: number; delta: number; deltaPct: number; dailyAvg: number;
}

interface DailyMacroPoint {
  day: number; date: string; hasData: boolean;
  calories: { consumed: number; target: number; delta: number };
  protein:  { consumed: number; target: number; delta: number };
  carbs:    { consumed: number; target: number; delta: number };
  fat:      { consumed: number; target: number; delta: number };
  fibre:    { consumed: number; target: number; delta: number };
}

interface MonthlyMacroData {
  month: string;
  planDaysElapsed: number;
  totalPlanDaysInMonth: number;
  targets:  { calories: number; protein: number; carbs: number; fat: number; fibre: number };
  totals:   { calories: MacroTotals; protein: MacroTotals; carbs: MacroTotals; fat: MacroTotals; fibre: MacroTotals };
  dailyData: DailyMacroPoint[];
}

// ── Per-macro config ───────────────────────────────────────────────────────
const MACRO_CONFIG: Record<MacroKey, {
  label: string; unit: string; color: string;
  // deficit direction: true = under target is GOOD (cal/carbs/fat), false = BAD (protein/fibre)
  deficitGood: boolean;
}> = {
  calories: { label: 'Calories', unit: 'kcal', color: '#C4713A', deficitGood: true  },
  protein:  { label: 'Protein',  unit: 'g',    color: '#2D6A4F', deficitGood: false },
  carbs:    { label: 'Carbs',    unit: 'g',    color: '#7B6CF6', deficitGood: true  },
  fat:      { label: 'Fat',      unit: 'g',    color: '#F0B429', deficitGood: true  },
  fibre:    { label: 'Fibre',    unit: 'g',    color: '#64B5F6', deficitGood: false },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtAmount(n: number, unit: string): string {
  return unit === 'kcal'
    ? Math.abs(n).toLocaleString()
    : Math.abs(Math.round(n)).toString();
}

// Bar colour: same 80/110 threshold for all macros in the chart
function getDailyBarColor(consumed: number, target: number, hasData: boolean): string {
  if (!hasData || target === 0) return '#2A2D3E';
  const pct = consumed / target;
  if (pct > 1.10)  return '#DC2626';
  if (pct >= 0.80) return '#2D6A4F';
  return '#F0B429';
}

// Cumulative progress bar colour (same thresholds, based on total consumed/target)
function getProgressColor(consumed: number, target: number): string {
  if (target === 0) return '#2D6A4F';
  const pct = consumed / target;
  if (pct > 1.10)  return '#DC2626';
  if (pct >= 0.80) return '#2D6A4F';
  return '#F0B429';
}

function getMonthlyInsight(deltaPct: number, daysElapsed: number, macro: MacroKey): string {
  if (daysElapsed === 0) return `Start logging meals to see your monthly ${MACRO_CONFIG[macro].label.toLowerCase()} progress.`;
  const { deficitGood, label } = MACRO_CONFIG[macro];
  const m = label.toLowerCase();

  if (deficitGood) {
    if (deltaPct < -20) return `⚠️ Significantly under your ${m} target. Check your plan adherence.`;
    if (deltaPct < -5)  return `✅ Healthy ${m} deficit. On track for your goal.`;
    if (deltaPct <= 5)  return `🎯 Right on your ${m} target. Great consistency.`;
    if (deltaPct <= 15) return `⚠️ Slightly over your ${m} target. Balance the remaining days.`;
    return `🚨 Significantly over ${m} target this month.`;
  } else {
    if (deltaPct < -20) return `🚨 Significantly under your ${m} target. Prioritise ${m}-rich foods.`;
    if (deltaPct < -5)  return `⚠️ Below your ${m} target. Try to increase ${m} intake.`;
    if (deltaPct <= 10) return `✅ ${label} intake is on target. Well done.`;
    return `ℹ️ Slightly above ${m} target — not a concern for ${m}.`;
  }
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function makeTooltip(macro: MacroKey) {
  const { unit, label } = MACRO_CONFIG[macro];
  return function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as DailyMacroPoint & { consumed: number; target: number; delta: number };
    const dateLabel = (() => {
      try { return format(new Date(d.date + 'T12:00:00'), 'd MMMM'); } catch { return d.date; }
    })();
    const deltaColor = d.delta > 0 ? '#DC2626' : d.delta < 0 ? '#2D6A4F' : '#9CA3AF';
    const sign = d.delta > 0 ? '+' : '';

    return (
      <div style={{
        background: '#1A1D27', border: '1px solid #2A2D3E', borderRadius: 8,
        padding: '8px 12px', fontSize: 12, fontFamily: 'sans-serif', lineHeight: 1.6,
      }}>
        <p style={{ color: '#E2E8F0', fontWeight: 700, marginBottom: 4 }}>{dateLabel}</p>
        <p style={{ color: '#9CA3AF' }}>
          {label}: <span style={{ color: '#E2E8F0', fontFamily: 'DM Mono, monospace' }}>
            {fmtAmount(d.consumed, unit)}{unit === 'g' ? 'g' : ' kcal'}
          </span>
        </p>
        <p style={{ color: '#9CA3AF' }}>
          Target: <span style={{ color: '#E2E8F0', fontFamily: 'DM Mono, monospace' }}>
            {fmtAmount(d.target, unit)}{unit === 'g' ? 'g' : ' kcal'}
          </span>
        </p>
        <p style={{ color: '#9CA3AF' }}>
          Delta: <span style={{ color: deltaColor, fontFamily: 'DM Mono, monospace' }}>
            {sign}{fmtAmount(d.delta, unit)}{unit === 'g' ? 'g' : ' kcal'}
          </span>
        </p>
      </div>
    );
  };
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3 card-glow">
      <div className="flex justify-between items-center">
        <div className="h-4 w-40 bg-elevated rounded animate-pulse" />
        <div className="h-3 w-20 bg-elevated rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-14 bg-elevated rounded-xl animate-pulse" />)}
      </div>
      <div className="h-3 w-32 bg-elevated rounded animate-pulse" />
      <div className="h-40 bg-elevated rounded-xl animate-pulse" />
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-elevated rounded-xl p-2.5 border border-border/60 text-center">
      <p className="text-[10px] font-sans text-dimmed uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`font-display font-bold text-base leading-tight ${color}`}>{value}</p>
      <p className="text-[10px] font-sans text-dimmed">{sub}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function MonthlyCalorieChart() {
  const { trackerCalendarMonth } = useAppStore();
  const [data, setData]                 = useState<MonthlyMacroData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [selectedMacro, setSelectedMacro] = useState<MacroKey>('calories');
  const [fading, setFading]             = useState(false);
  const isFirstRender                   = useRef(true);

  // Fade transition when macro switches
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setFading(true);
    const t = setTimeout(() => setFading(false), 150);
    return () => clearTimeout(t);
  }, [selectedMacro]);

  const fetchData = useCallback(async (month: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/tracker/monthly-macros', {
        params: { month },
        withCredentials: true,
      });
      setData(res.data);
    } catch {
      setError('Could not load monthly data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(trackerCalendarMonth);
  }, [trackerCalendarMonth, fetchData]);

  if (loading) return <Skeleton />;
  if (error || !data) return (
    <div className="bg-surface rounded-2xl border border-border p-4 card-glow">
      <p className="text-dimmed text-xs font-sans text-center">{error || 'No data'}</p>
    </div>
  );

  const { planDaysElapsed, totalPlanDaysInMonth, targets, totals, dailyData, month } = data;
  const cfg      = MACRO_CONFIG[selectedMacro];
  const macroTot = totals[selectedMacro];
  const noData   = planDaysElapsed === 0;

  // Flatten selected macro values onto each daily point for recharts
  const chartData = useMemo(() =>
    dailyData.map(d => ({
      ...d,
      consumed: d[selectedMacro].consumed,
      target:   d[selectedMacro].target,
      delta:    d[selectedMacro].delta,
    }))
  , [dailyData, selectedMacro]);

  const pctConsumed = macroTot.target > 0
    ? Math.min((macroTot.consumed / macroTot.target) * 100, 100)
    : 0;
  const progressColor = getProgressColor(macroTot.consumed, macroTot.target);

  const monthLabel = (() => {
    try { return format(new Date(month + '-01T12:00:00'), 'MMMM yyyy'); } catch { return month; }
  })();

  const maxAbs = chartData.length > 0
    ? Math.max(...chartData.map(d => Math.abs(d.delta)), 10)
    : 10;
  const yDomain = [-Math.ceil(maxAbs / 10) * 10, Math.ceil(maxAbs / 10) * 10];

  const deficitZoneLine = -(targets[selectedMacro] * 0.1);
  const TooltipContent  = useMemo(() => makeTooltip(selectedMacro), [selectedMacro]);

  const deltaSign = macroTot.delta > 0 ? '+' : '';
  const deltaStr  = `${deltaSign}${fmtAmount(macroTot.delta, cfg.unit)}${cfg.unit === 'g' ? 'g' : ' kcal'}`;

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 card-glow space-y-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="font-sans font-semibold text-primary text-sm">Monthly Macro Tracker</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary font-sans">{monthLabel}</span>
          {/* Macro selector */}
          <select
            value={selectedMacro}
            onChange={e => setSelectedMacro(e.target.value as MacroKey)}
            style={{
              background:   'var(--color-background-secondary, #1A1D27)',
              border:       '0.5px solid var(--color-border-secondary, #2A2D3E)',
              borderRadius: '8px',
              padding:      '4px 10px',
              fontSize:     '12px',
              fontWeight:   500,
              color:        'var(--color-text-primary, #E2E8F0)',
              cursor:       'pointer',
              outline:      'none',
              fontFamily:   'DM Sans, sans-serif',
            }}
          >
            <option value="calories">Calories</option>
            <option value="protein">Protein</option>
            <option value="carbs">Carbs</option>
            <option value="fat">Fat</option>
            <option value="fibre">Fibre</option>
          </select>
        </div>
      </div>

      {/* ── Reactive content (fades on macro switch) ─────────────── */}
      <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 150ms ease' }}>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Consumed"
            value={`${macroTot.consumed.toLocaleString()}${cfg.unit === 'g' ? 'g' : ''}`}
            sub={`${cfg.unit === 'kcal' ? 'kcal' : cfg.label.toLowerCase()} so far`}
            color="text-primary"
          />
          <StatCard
            label="Target"
            value={`${macroTot.target.toLocaleString()}${cfg.unit === 'g' ? 'g' : ''}`}
            sub={`${cfg.unit === 'kcal' ? 'kcal' : cfg.label.toLowerCase()} so far`}
            color="text-secondary"
          />
          <StatCard
            label="Delta"
            value={deltaStr}
            sub={macroTot.delta > 0 ? 'over' : 'under'}
            color={macroTot.delta > 0 ? 'text-red-400' : 'text-success'}
          />
        </div>

        {/* Progress text */}
        {!noData && (
          <p className="text-xs text-secondary font-sans mt-2">
            <span className="text-primary font-semibold font-mono">{planDaysElapsed}</span> of{' '}
            <span className="text-primary font-semibold font-mono">{totalPlanDaysInMonth}</span> plan days progressed{' '}
            <span className="text-dimmed">({Math.round((planDaysElapsed / totalPlanDaysInMonth) * 100)}%)</span>
          </p>
        )}

        {/* Bar chart */}
        {noData ? (
          <div className="h-40 flex items-center justify-center">
            <p className="text-dimmed text-xs font-sans">No meal data for this month yet</p>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <p className="text-[10px] text-dimmed font-sans uppercase tracking-wide mb-1">
                Daily {cfg.label} Balance
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'DM Mono, monospace' }}
                    axisLine={false} tickLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'DM Mono, monospace' }}
                    axisLine={false} tickLine={false} tickCount={5}
                  />
                  <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                  <ReferenceLine
                    y={deficitZoneLine}
                    stroke="#2D6A4F" strokeDasharray="4 4" strokeOpacity={0.4}
                    label={{ value: 'Deficit zone', position: 'insideBottomRight', fontSize: 8, fill: '#2D6A4F', opacity: 0.7 }}
                  />
                  <Bar dataKey="delta" radius={[2, 2, 0, 0]} maxBarSize={18}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getDailyBarColor(entry.consumed, entry.target, entry.hasData)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative progress bar */}
            <div className="mt-2">
              <p className="text-[10px] text-dimmed font-sans uppercase tracking-wide mb-1.5">
                Cumulative Progress
              </p>
              <div className="h-3 bg-border rounded-full overflow-hidden">
                <div style={{
                  width: `${pctConsumed}%`,
                  backgroundColor: progressColor,
                  height: '100%',
                  borderRadius: 9999,
                  transition: 'width 400ms ease',
                }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] font-mono text-dimmed">0</span>
                <span className="text-[10px] font-mono text-secondary font-semibold">
                  {pctConsumed.toFixed(1)}% of {cfg.label.toLowerCase()} target
                </span>
                <span className="text-[10px] font-mono text-dimmed">
                  {macroTot.target.toLocaleString()}{cfg.unit === 'kcal' ? ' kcal' : 'g'}
                </span>
              </div>
              <p className={`text-xs font-sans mt-1.5 font-medium ${macroTot.delta > 0 ? 'text-red-400' : 'text-success'}`}>
                You are {fmtAmount(macroTot.delta, cfg.unit)}{cfg.unit === 'g' ? 'g' : ' kcal'}{' '}
                {macroTot.delta > 0 ? 'over' : 'under'} {cfg.label.toLowerCase()} target for the month
              </p>
              <p className="text-[11px] font-sans text-dimmed mt-0.5">
                Daily average:{' '}
                <span className="font-mono text-secondary">
                  {macroTot.dailyAvg.toLocaleString()}{cfg.unit === 'g' ? 'g' : ''}
                </span>{' '}
                vs{' '}
                <span className="font-mono text-secondary">
                  {targets[selectedMacro].toLocaleString()}{cfg.unit === 'g' ? 'g' : ''}{' '}
                  {cfg.unit === 'kcal' ? 'kcal' : ''}
                </span>{' '}
                goal
              </p>
            </div>

            {/* Insight */}
            <p className="text-xs font-sans text-secondary bg-elevated rounded-xl px-3 py-2.5 border border-border/60 mt-2">
              {getMonthlyInsight(macroTot.deltaPct, planDaysElapsed, selectedMacro)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
