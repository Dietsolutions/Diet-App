// WeightProgressChart — Strain v2 visual. All hook logic preserved.

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useWeightStore } from '../../store/weightStore';
import { useWeightChart } from '../../hooks/useWeightChart';
import { TimeRange } from '../../types';
import { s2 } from '../../theme/tokens';
import { HairLabel } from '../ui';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', 'all'];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div style={{
      borderRadius: s2.rMd,
      background: s2.surface2,
      border: `1px solid ${s2.lineStrong}`,
      padding: '8px 12px',
      fontFamily: s2.mono,
      fontSize: 11,
    }}>
      <div style={{ color: s2.textDim, marginBottom: 4, fontSize: 9, letterSpacing: '0.1em' }}>{dateStr}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, lineHeight: 1.6 }}>
          {entry.dataKey === 'projected' ? 'Projected' : 'Actual'}: {entry.value} kg
        </div>
      ))}
    </div>
  );
}

export function WeightProgressChart() {
  const { logs, projection, selectedTimeRange, setTimeRange } = useWeightStore();
  const { chartData, domain } = useWeightChart(logs, projection, selectedTimeRange);

  if (chartData.length === 0) {
    return (
      <div style={{
 borderRadius: s2.rMd, border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>
        <HairLabel style={{ marginBottom: 10 }}>WEIGHT CHART</HairLabel>
        <div style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>
            Log your weight to see the chart
          </div>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().substring(0, 10);

  const safeChartData = chartData
    .map(point => ({
      ...point,
      date:      typeof point.date      === 'string' ? point.date      : '',
      projected: typeof point.projected === 'number' ? point.projected : undefined,
      actual:    typeof point.actual    === 'number' ? point.actual    : undefined,
    }))
    .filter(point => typeof point.date === 'string' && point.date.length > 0);

  return (
    <div style={{
 borderRadius: s2.rMd, border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <HairLabel>WEIGHT CHART</HairLabel>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              style={{
                padding: '4px 8px',
                background: selectedTimeRange === r ? s2.accentFill : 'transparent',
                border: `1px solid ${selectedTimeRange === r ? s2.accent : s2.lineStrong}`,
                fontFamily: s2.mono,
                fontSize: 8,
                letterSpacing: '0.12em',
                color: selectedTimeRange === r ? s2.ink : s2.textDim,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {r === 'all' ? 'ALL' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 1, background: s2.carbs, borderTop: `2px dashed ${s2.carbs}` }} />
          <span style={{ fontFamily: s2.mono, fontSize: 8, color: s2.textDimmer, letterSpacing: '0.1em' }}>PROJECTED</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: s2.accentFill }} />
          <span style={{ fontFamily: s2.mono, fontSize: 8, color: s2.textDimmer, letterSpacing: '0.1em' }}>ACTUAL</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={safeChartData} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={s2.line} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: s2.textDimmer, fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
            interval="preserveStartEnd"
            stroke={s2.line}
            axisLine={{ stroke: s2.line }}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 9, fill: s2.textDimmer, fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
            tickFormatter={(v: number) => `${v}`}
            stroke={s2.line}
            axisLine={{ stroke: s2.line }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: s2.lineStrong, strokeWidth: 1 }} />
          <ReferenceLine x={todayStr} stroke={s2.lineStrong} strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="projected"
            stroke={s2.carbs}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={s2.accent}
            strokeWidth={2}
            dot={{ r: 3, fill: s2.accent, stroke: s2.ink, strokeWidth: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
