// MonthlyCalorieChart — Strain v2 visual. All fetch/hook/chart logic preserved.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, ReferenceLine,
  ResponsiveContainer, Tooltip, Cell,
} from 'recharts';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel, Bar as SBar } from './ui';

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
  targets:   { calories: number; protein: number; carbs: number; fat: number; fibre: number };
  totals:    { calories: MacroTotals; protein: MacroTotals; carbs: MacroTotals; fat: MacroTotals; fibre: MacroTotals };
  dailyData: DailyMacroPoint[];
}

// ── Per-macro config (Strain v2 colours) ───────────────────────────────────
const MACRO_CONFIG: Record<MacroKey, {
  label: string; unit: string; color: string; deficitGood: boolean;
}> = {
  calories: { label: 'Calories', unit: 'kcal', color: s2.accent,   deficitGood: true  },
  protein:  { label: 'Protein',  unit: 'g',    color: s2.protein,  deficitGood: false },
  carbs:    { label: 'Carbs',    unit: 'g',    color: s2.carbs,    deficitGood: true  },
  fat:      { label: 'Fat',      unit: 'g',    color: s2.fat,      deficitGood: true  },
  fibre:    { label: 'Fibre',    unit: 'g',    color: s2.fibre,    deficitGood: false },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtAmount(n: number, unit: string): string {
  return unit === 'kcal'
    ? Math.abs(n).toLocaleString()
    : Math.abs(Math.round(n)).toString();
}

function getDailyBarColor(consumed: number, target: number, hasData: boolean): string {
  if (!hasData || target === 0) return s2.line;
  const pct = consumed / target;
  if (pct > 1.10)  return s2.warn;
  if (pct >= 0.80) return s2.fibre;
  return s2.fat;
}

function getProgressColor(consumed: number, target: number): string {
  if (target === 0) return s2.fibre;
  const pct = consumed / target;
  if (pct > 1.10)  return s2.warn;
  if (pct >= 0.80) return s2.fibre;
  return s2.fat;
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
    const deltaColor = d.delta > 0 ? s2.warn : d.delta < 0 ? s2.fibre : s2.textDimmer;
    const sign = d.delta > 0 ? '+' : '';

    return (
      <div style={{
        background: s2.surface2,
        border: `1px solid ${s2.lineStrong}`,
        padding: '8px 12px',
        fontFamily: s2.mono,
        fontSize: 10,
        lineHeight: 1.7,
      }}>
        <div style={{ color: s2.textDim, marginBottom: 2 }}>{dateLabel}</div>
        <div style={{ color: s2.textDim }}>
          {label}:{' '}
          <span style={{ color: s2.text }}>
            {fmtAmount(d.consumed, unit)}{unit === 'g' ? 'g' : ' kcal'}
          </span>
        </div>
        <div style={{ color: s2.textDim }}>
          Target:{' '}
          <span style={{ color: s2.text }}>
            {fmtAmount(d.target, unit)}{unit === 'g' ? 'g' : ' kcal'}
          </span>
        </div>
        <div style={{ color: s2.textDim }}>
          Delta:{' '}
          <span style={{ color: deltaColor }}>
            {sign}{fmtAmount(d.delta, unit)}{unit === 'g' ? 'g' : ' kcal'}
          </span>
        </div>
      </div>
    );
  };
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 140, height: 10, background: s2.surface2 }} />
        <div style={{ width: 80, height: 10, background: s2.surface2 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 56, background: s2.surface2 }} />)}
      </div>
      <div style={{ height: 160, background: s2.surface2 }} />
    </div>
  );
}

// ── StatCell ──────────────────────────────────────────────────────────────
function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      border: `1px solid ${s2.line}`,
      background: s2.surface2,
      padding: '10px 8px',
      textAlign: 'center',
    }}>
      <HairLabel style={{ marginBottom: 6, fontSize: 7 }}>{label}</HairLabel>
      <div style={{
        fontFamily: s2.mono,
        fontSize: 14,
        fontWeight: 500,
        color: color ?? s2.text,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── MacroTab ──────────────────────────────────────────────────────────────
function MacroTab({
  macro, label, selected, color, onClick,
}: { macro: MacroKey; label: string; selected: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '7px 4px',
        background: selected ? 'transparent' : 'transparent',
        border: 'none',
        borderBottom: selected ? `2px solid ${color}` : '2px solid transparent',
        fontFamily: s2.mono,
        fontSize: 8,
        letterSpacing: '0.12em',
        color: selected ? color : s2.textDimmer,
        cursor: 'pointer',
        textTransform: 'uppercase',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function MonthlyCalorieChart() {
  const { trackerCalendarMonth } = useAppStore();
  const [data,         setData]         = useState<MonthlyMacroData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selectedMacro, setSelectedMacro] = useState<MacroKey>('calories');
  const [fading,       setFading]       = useState(false);
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

  useEffect(() => { fetchData(trackerCalendarMonth); }, [trackerCalendarMonth, fetchData]);

  // ── useMemo hooks MUST come before conditional early returns ─────────────
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dailyData.map(d => ({
      ...d,
      consumed: d[selectedMacro]?.consumed ?? 0,
      target:   d[selectedMacro]?.target   ?? 0,
      delta:    d[selectedMacro]?.delta    ?? 0,
    }));
  }, [data, selectedMacro]);

  const TooltipContent = useMemo(() => makeTooltip(selectedMacro), [selectedMacro]);

  if (loading) return <Skeleton />;
  if (error || !data) return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>
      <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, textAlign: 'center' }}>
        {error || 'No data'}
      </div>
    </div>
  );

  const { planDaysElapsed, totalPlanDaysInMonth, targets, totals, month } = data;
  const cfg      = MACRO_CONFIG[selectedMacro];
  const macroTot = totals[selectedMacro];
  const noData   = planDaysElapsed === 0;

  const pctConsumed = macroTot.target > 0
    ? Math.min((macroTot.consumed / macroTot.target) * 100, 100)
    : 0;
  const progressColor = getProgressColor(macroTot.consumed, macroTot.target);

  const monthLabel = (() => {
    try { return format(new Date(month + '-01T12:00:00'), 'MMMM yyyy').toUpperCase(); } catch { return month; }
  })();

  const maxAbs = chartData.length > 0
    ? Math.max(...chartData.map(d => Math.abs(d.delta)), 10)
    : 10;
  const yDomain = [-Math.ceil(maxAbs / 10) * 10, Math.ceil(maxAbs / 10) * 10];

  const deficitZoneLine = -(targets[selectedMacro] * 0.1);
  const deltaSign = macroTot.delta > 0 ? '+' : '';
  const deltaStr  = `${deltaSign}${fmtAmount(macroTot.delta, cfg.unit)}${cfg.unit === 'g' ? 'g' : ''}`;

  return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <HairLabel>MONTHLY MACROS</HairLabel>
        <HairLabel>{monthLabel}</HairLabel>
      </div>

      {/* ── Macro tab strip ────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${s2.line}`,
        marginBottom: 14,
      }}>
        {(Object.keys(MACRO_CONFIG) as MacroKey[]).map(mk => (
          <MacroTab
            key={mk}
            macro={mk}
            label={mk === 'calories' ? 'KCAL' : mk.toUpperCase()}
            selected={selectedMacro === mk}
            color={MACRO_CONFIG[mk].color}
            onClick={() => setSelectedMacro(mk)}
          />
        ))}
      </div>

      {/* ── Reactive content (fades on macro switch) ───────────────── */}
      <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 150ms ease' }}>

        {/* Stat cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 14 }}>
          <StatCell
            label="CONSUMED"
            value={`${macroTot.consumed.toLocaleString()}${cfg.unit === 'g' ? 'g' : ''}`}
          />
          <StatCell
            label="TARGET"
            value={`${macroTot.target.toLocaleString()}${cfg.unit === 'g' ? 'g' : ''}`}
            color={s2.textDim}
          />
          <StatCell
            label="DELTA"
            value={deltaStr}
            color={macroTot.delta > 0 ? s2.warn : s2.fibre}
          />
        </div>

        {/* Progress days text */}
        {!noData && (
          <div style={{
            fontFamily: s2.mono,
            fontSize: 9,
            color: s2.textDimmer,
            letterSpacing: '0.1em',
            marginBottom: 14,
          }}>
            <span style={{ color: s2.text }}>{planDaysElapsed}</span> OF{' '}
            <span style={{ color: s2.text }}>{totalPlanDaysInMonth}</span> PLAN DAYS PROGRESSED{' '}
            ({Math.round((planDaysElapsed / totalPlanDaysInMonth) * 100)}%)
          </div>
        )}

        {/* Bar chart */}
        {noData ? (
          <div style={{
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>
              No meal data for this month yet
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <HairLabel style={{ marginBottom: 6, fontSize: 7 }}>
                DAILY {cfg.label.toUpperCase()} BALANCE
              </HairLabel>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fill: s2.textDimmer, fontFamily: 'IBM Plex Mono, monospace' }}
                    axisLine={false} tickLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 9, fill: s2.textDimmer, fontFamily: 'IBM Plex Mono, monospace' }}
                    axisLine={false} tickLine={false} tickCount={5}
                  />
                  <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(255,182,128,0.05)' }} />
                  <ReferenceLine y={0} stroke={s2.lineStrong} strokeDasharray="3 3" />
                  <ReferenceLine
                    y={deficitZoneLine}
                    stroke={s2.fibre} strokeDasharray="4 4" strokeOpacity={0.4}
                    label={{ value: 'Deficit zone', position: 'insideBottomRight', fontSize: 7, fill: s2.fibre, opacity: 0.7 }}
                  />
                  <Bar dataKey="delta" maxBarSize={16}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={getDailyBarColor(entry.consumed, entry.target, entry.hasData)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative progress bar */}
            <div style={{ marginBottom: 14 }}>
              <HairLabel style={{ marginBottom: 6, fontSize: 7 }}>CUMULATIVE PROGRESS</HairLabel>
              <SBar pct={pctConsumed / 100} color={progressColor} h={4} />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontFamily: s2.mono,
                fontSize: 9,
                color: s2.textDimmer,
              }}>
                <span>0</span>
                <span style={{ color: progressColor }}>
                  {pctConsumed.toFixed(1)}% of {cfg.label.toLowerCase()} target
                </span>
                <span>{macroTot.target.toLocaleString()}{cfg.unit === 'kcal' ? ' kcal' : 'g'}</span>
              </div>
              <div style={{
                marginTop: 6,
                fontFamily: s2.mono,
                fontSize: 9,
                color: macroTot.delta > 0 ? s2.warn : s2.fibre,
                letterSpacing: '0.04em',
              }}>
                {fmtAmount(macroTot.delta, cfg.unit)}{cfg.unit === 'g' ? 'g' : ' kcal'}{' '}
                {macroTot.delta > 0 ? 'OVER' : 'UNDER'} {cfg.label.toUpperCase()} TARGET
              </div>
              <div style={{
                marginTop: 4,
                fontFamily: s2.mono,
                fontSize: 9,
                color: s2.textDimmer,
              }}>
                Daily avg:{' '}
                <span style={{ color: s2.text }}>
                  {macroTot.dailyAvg.toLocaleString()}{cfg.unit === 'g' ? 'g' : ''}
                </span>{' '}
                vs{' '}
                <span style={{ color: s2.text }}>
                  {targets[selectedMacro].toLocaleString()}{cfg.unit === 'g' ? 'g' : ''}{' '}
                  {cfg.unit === 'kcal' ? 'kcal' : ''}
                </span>{' '}
                goal
              </div>
            </div>

            {/* Insight */}
            <div style={{
              border: `1px solid ${s2.line}`,
              background: s2.surface2,
              padding: '10px 12px',
              fontFamily: s2.sans,
              fontSize: 12,
              color: s2.textDim,
              lineHeight: 1.5,
            }}>
              {getMonthlyInsight(macroTot.deltaPct, planDaysElapsed, selectedMacro)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
