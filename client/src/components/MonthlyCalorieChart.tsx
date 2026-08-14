// MonthlyCalorieChart — dark treatment (ref: design-reference/v3-screens-monthly.jsx,
// V3KcalDark). Fetch, month-navigation and macro-tab state are unchanged; this is a
// restyle of the card around them.
//
// The chart is hand-built rather than Recharts: the reference draws three distinct
// column states (logged bar, elapsed-but-unlogged tick, future rail) around a goal
// line, which a Bar series cannot express.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

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
  const v = Math.round(Math.abs(n));
  return unit === 'kcal' ? v.toLocaleString() : `${v}g`;
}

/**
 * The message under the card, as tone + copy.
 *
 * Same thresholds and wording as the light card used — only the emoji prefix is
 * gone, because the pop-out carries a ! / ✓ badge instead. Tone is not "is the
 * user under target": on a cut, being under on calories, carbs or fat is the
 * plan working, which is what `deficitGood` encodes.
 */
function getMonthlyNote(deltaPct: number, daysElapsed: number, macro: MacroKey): {
  tone: 'good' | 'warn'; title: string; text: string;
} {
  const { deficitGood, label } = MACRO_CONFIG[macro];
  const m = label.toLowerCase();
  if (daysElapsed === 0) {
    return { tone: 'good', title: `${label} not started`, text: `Start logging meals to see your monthly ${m} progress.` };
  }

  const under = deltaPct < 0;
  const title = (tone: 'good' | 'warn') =>
    tone === 'good' ? `${label} on track` : under ? `${label} deficit` : `${label} over target`;

  if (deficitGood) {
    if (deltaPct < -20) return { tone: 'warn', title: title('warn'), text: `Significantly under your ${m} target. Check your plan adherence.` };
    if (deltaPct < -5)  return { tone: 'good', title: title('good'), text: `Healthy ${m} deficit. On track for your goal.` };
    if (deltaPct <= 5)  return { tone: 'good', title: title('good'), text: `Right on your ${m} target. Great consistency.` };
    if (deltaPct <= 15) return { tone: 'warn', title: title('warn'), text: `Slightly over your ${m} target. Balance the remaining days.` };
    return { tone: 'warn', title: title('warn'), text: `Significantly over ${m} target this month.` };
  }
  if (deltaPct < -20) return { tone: 'warn', title: title('warn'), text: `Significantly under your ${m} target. Prioritise ${m}-rich foods.` };
  if (deltaPct < -5)  return { tone: 'warn', title: title('warn'), text: `Below your ${m} target. Try to increase ${m} intake.` };
  if (deltaPct <= 10) return { tone: 'good', title: title('good'), text: `${label} intake is on target. Well done.` };
  return { tone: 'good', title: title('good'), text: `Slightly above ${m} target — not a concern for ${m}.` };
}

/** Local calendar date, so "future" matches the user's day rather than UTC's. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIM_RAIL   = 'rgba(246,247,243,0.09)';
const TICK_RAIL  = 'rgba(246,247,243,0.13)';
const FUTURE_RAIL = 'rgba(246,247,243,0.05)';

function Skeleton() {
  return (
    <div style={{ background: s2.ink, borderRadius: 32, padding: 20, minHeight: 340 }}>
      <div style={{ height: 12, width: 120, borderRadius: 6, background: DIM_RAIL }} />
      <div style={{ display: 'flex', gap: 5, marginTop: 16 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 30, borderRadius: 999, background: DIM_RAIL }} />
        ))}
      </div>
      <div style={{ height: 46, width: 180, borderRadius: 10, background: DIM_RAIL, marginTop: 22 }} />
      <div style={{ height: 148, borderRadius: 12, background: DIM_RAIL, marginTop: 22 }} />
    </div>
  );
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Main Component ─────────────────────────────────────────────────────────
export function MonthlyCalorieChart() {
  const { trackerCalendarMonth, setTrackerCalendarMonth } = useAppStore();
  const [data,         setData]         = useState<MonthlyMacroData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selectedMacro, setSelectedMacro] = useState<MacroKey>('calories');
  const [fading,       setFading]       = useState(false);
  const isFirstRender                   = useRef(true);

  // Month navigation — shared with Tracker calendar via trackerCalendarMonth
  const now             = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth  = trackerCalendarMonth >= currentMonthStr;

  function navigateMonth(dir: -1 | 1) {
    const [y, m] = trackerCalendarMonth.split('-').map(Number);
    let nm = m + dir;
    let ny = y;
    if (nm < 1)  { nm = 12; ny -= 1; }
    if (nm > 12) { nm = 1;  ny += 1; }
    const next = `${ny}-${String(nm).padStart(2, '0')}`;
    if (next <= currentMonthStr) setTrackerCalendarMonth(next);
  }

  const [chartY, chartM] = trackerCalendarMonth.split('-').map(Number);

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
  const cfg = MACRO_CONFIG[selectedMacro];

  /**
   * Every figure on the card is derived here from the per-day values and the
   * daily goal — consumed, target, delta, the missed count and the cumulative
   * percentage are all reductions over the same array the chart plots, so the
   * headline and the bars cannot drift apart. (The response also carries a
   * server-computed `totals`, which the light card used; deriving instead is
   * what keeps the two in agreement.)
   */
  const derived = useMemo(() => {
    if (!data) return null;
    const goal    = data.targets[selectedMacro] ?? 0;
    const days    = data.dailyData;
    const elapsed = data.planDaysElapsed;
    const logged  = days.filter(d => d.hasData);

    const consumed = logged.reduce((a, d) => a + (d[selectedMacro]?.consumed ?? 0), 0);
    const target   = goal * elapsed;
    const delta    = consumed - target;
    const missed   = Math.max(0, elapsed - logged.length);
    const pct      = target > 0 ? (consumed / target) * 100 : 0;
    const deltaPct = target > 0 ? (delta / target) * 100 : 0;

    const today = localToday();
    const cols  = days.map(d => ({
      day:    d.day,
      date:   d.date,
      future: d.date > today,
      delta:  d.hasData ? (d[selectedMacro]?.consumed ?? 0) - goal : null,
    }));

    const magnitudes = cols.map(c => (c.delta == null ? 0 : Math.abs(c.delta)));
    const maxAbs = Math.max(...magnitudes, 1);
    const yMax   = Math.max(Math.ceil(maxAbs / 5) * 5, 5);

    return { goal, elapsed, consumed, target, delta, missed, pct, deltaPct, cols, yMax };
  }, [data, selectedMacro]);

  if (loading) return <Skeleton />;
  if (error || !data || !derived) return (
    <div style={{ background: s2.ink, borderRadius: 32, padding: 20 }}>
      <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.onDarkDim, textAlign: 'center' }}>
        {error || 'No data'}
      </div>
    </div>
  );

  const { totalPlanDaysInMonth } = data;
  const { goal, elapsed, consumed, target, delta, missed, pct, deltaPct, cols, yMax } = derived;
  const noData = elapsed === 0;
  const note   = getMonthlyNote(deltaPct, elapsed, selectedMacro);

  // Over-goal must never land on the macro's own colour — on the Fat tab it
  // would, and both directions would read as one hue.
  const cUnder = cfg.color;
  const cOver  = cfg.color === s2.fat ? s2.lilac : s2.fat;

  const H = 148, half = H / 2;
  const unitSuffix = cfg.unit === 'kcal' ? ' kcal' : 'g';

  // x labels: first, quarters, last of the plotted range.
  const labelIdx = cols.length
    ? Array.from(new Set([0, Math.floor(cols.length * 0.25), Math.floor(cols.length * 0.5), Math.floor(cols.length * 0.75), cols.length - 1]))
    : [];

  return (
    <div>
      <div style={{ background: s2.ink, borderRadius: 32, padding: 20, paddingBottom: 38 }}>

        {/* ── Month navigator, in the card header ─────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <HairLabel color={s2.onDarkDimmer}>MONTHLY MACROS</HairLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
              style={{
                width: 28, height: 28, borderRadius: s2.rPill, border: 'none',
                background: DIM_RAIL, color: s2.onDark,
                fontSize: 15, lineHeight: 1, cursor: 'pointer',
              }}
            >‹</button>
            <span style={{
              fontFamily: s2.sans, fontSize: 10, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: s2.onDark, minWidth: 88, textAlign: 'center',
            }}>
              {MONTH_NAMES[chartM - 1]} {chartY}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              disabled={isCurrentMonth}
              aria-label="Next month"
              style={{
                width: 28, height: 28, borderRadius: s2.rPill, border: 'none',
                background: DIM_RAIL,
                color: isCurrentMonth ? s2.onDarkDimmer : s2.onDark,
                fontSize: 15, lineHeight: 1,
                cursor: isCurrentMonth ? 'default' : 'pointer',
              }}
            >›</button>
          </div>
        </div>

        {/* ── Macro pills ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 5, marginTop: 16 }}>
          {(Object.keys(MACRO_CONFIG) as MacroKey[]).map(mk => {
            const on = mk === selectedMacro;
            return (
              <button
                key={mk}
                onClick={() => setSelectedMacro(mk)}
                style={{
                  flex: 1, border: 'none', cursor: 'pointer',
                  borderRadius: s2.rPill, padding: '8px 0',
                  background: on ? MACRO_CONFIG[mk].color : DIM_RAIL,
                  color: on ? s2.ink : s2.onDarkDim,
                  fontFamily: s2.sans, fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '-0.01em',
                  transition: 'background 180ms ease-out',
                }}
              >
                {mk === 'calories' ? 'Kcal' : MACRO_CONFIG[mk].label}
              </button>
            );
          })}
        </div>

        <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 150ms ease' }}>

          {/* ── Hero: consumed against target ─────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
            <div style={{ minWidth: 0 }}>
              <HairLabel color={s2.onDarkDimmer}>{cfg.label.toUpperCase()} CONSUMED</HairLabel>
              <div style={{
                fontFamily: s2.disp, fontSize: 42, fontWeight: 700,
                letterSpacing: '-0.045em', color: s2.onDark, lineHeight: 1, marginTop: 8,
              }}>
                {cfg.unit === 'kcal' ? Math.round(consumed).toLocaleString() : Math.round(consumed)}
                <span style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 600, color: s2.onDarkDim, marginLeft: 5 }}>
                  {cfg.unit === 'kcal' ? 'kcal' : 'g'} / {fmtAmount(target, cfg.unit)}
                </span>
              </div>
            </div>
            <span style={{
              flexShrink: 0,
              fontFamily: s2.sans, fontSize: 10.5, fontWeight: 700,
              borderRadius: s2.rPill, padding: '6px 11px', whiteSpace: 'nowrap',
              background: delta > 0 ? 'rgba(255,138,107,0.18)' : 'rgba(198,242,78,0.16)',
              color:      delta > 0 ? '#FFA98F' : s2.accentFill,
            }}>
              {delta > 0 ? '▲' : '▼'} {fmtAmount(delta, cfg.unit)} {delta > 0 ? 'over' : 'under'}
            </span>
          </div>

          {/* ── Progress through the month ────────────────────────────── */}
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 3, borderRadius: s2.rPill, background: 'rgba(246,247,243,0.10)', overflow: 'hidden' }}>
              <div style={{
                width: `${totalPlanDaysInMonth > 0 ? (elapsed / totalPlanDaysInMonth) * 100 : 0}%`,
                height: '100%', background: 'rgba(246,247,243,0.42)',
              }} />
            </div>
            <div style={{
              fontFamily: s2.sans, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '0.1em', color: s2.onDarkDimmer, marginTop: 8, textTransform: 'uppercase',
            }}>
              <span style={{ color: s2.onDark }}>{elapsed}</span> of{' '}
              <span style={{ color: s2.onDark }}>{totalPlanDaysInMonth}</span> plan days progressed
              {' '}({totalPlanDaysInMonth > 0 ? Math.round((elapsed / totalPlanDaysInMonth) * 100) : 0}%)
              {/* only when there is something missed — never hardcoded */}
              {missed > 0 ? ` · ${missed} not logged` : ''}
            </div>
          </div>

          {noData ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.onDarkDim }}>
                No meal data for this month yet
              </div>
            </div>
          ) : (
            <>
              {/* ── Daily balance ──────────────────────────────────────── */}
              <div style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <HairLabel color={s2.onDarkDimmer} style={{ fontSize: 7.5 }}>
                    DAILY {cfg.label.toUpperCase()} BALANCE
                  </HairLabel>
                  <span style={{
                    fontFamily: s2.sans, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: s2.onDarkDimmer, textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>
                    vs {Math.round(goal)}{unitSuffix} goal
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
                  {/* y axis */}
                  <div style={{ width: 24, height: H, position: 'relative', flexShrink: 0 }}>
                    {([[0, `+${yMax}`], [half - 5, '0'], [H - 10, `−${yMax}`]] as [number, string][]).map(([top, l]) => (
                      <span key={l} style={{
                        position: 'absolute', top, right: 0,
                        fontFamily: s2.sans, fontSize: 8.5, fontWeight: 700, color: s2.onDarkDimmer,
                      }}>{l}</span>
                    ))}
                  </div>

                  {/* plot */}
                  <div style={{ flex: 1, height: H, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: half, borderTop: '1px dashed rgba(246,247,243,0.32)' }} />
                    <div style={{
                      position: 'absolute', left: 0, right: 0,
                      top: half - half * 0.18, height: half * 0.36,
                      background: 'rgba(246,247,243,0.04)', borderRadius: 3,
                    }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
                      {cols.map((c, i) => {
                        if (c.future) {
                          return <div key={i} style={{ flex: 1, alignSelf: 'center', height: 2, borderRadius: 2, background: FUTURE_RAIL }} />;
                        }
                        if (c.delta == null) {
                          return (
                            <div key={i} style={{ flex: 1, position: 'relative' }} title={`Day ${c.day} · not logged`}>
                              <div style={{ position: 'absolute', left: 0, right: 0, top: half - 1.5, height: 3, borderRadius: 2, background: TICK_RAIL }} />
                            </div>
                          );
                        }
                        const h  = Math.max((Math.abs(c.delta) / yMax) * half, 3);
                        const up = c.delta > 0;
                        return (
                          <div
                            key={i}
                            style={{ flex: 1, position: 'relative' }}
                            /* native tooltip keeps the per-day detail the old
                               Recharts hover gave, without altering the visual */
                            title={`Day ${c.day} · ${up ? '+' : '−'}${fmtAmount(c.delta, cfg.unit)} ${up ? 'over' : 'under'} goal`}
                          >
                            <div style={{
                              position: 'absolute', left: 0, right: 0, height: h,
                              top: up ? half - h : half,
                              background: up ? cOver : cUnder, opacity: 0.9,
                              borderRadius: up ? '3px 3px 1px 1px' : '1px 1px 3px 3px',
                            }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginLeft: 33, marginTop: 8,
                  fontFamily: s2.sans, fontSize: 8.5, fontWeight: 700, color: s2.onDarkDimmer,
                }}>
                  {labelIdx.map(i => <span key={i}>{cols[i]?.day ?? ''}</span>)}
                </div>

                {/* legend — reads the same two variables the bars do */}
                <div style={{ display: 'flex', gap: 14, marginTop: 12, marginLeft: 33, flexWrap: 'wrap' }}>
                  {([['Under goal', cUnder], ['Over goal', cOver], ['Not logged', TICK_RAIL]] as [string, string][]).map(([l, c]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c, opacity: c.startsWith('rgba') ? 1 : 0.9 }} />
                      <span style={{
                        fontFamily: s2.sans, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em',
                        color: s2.onDarkDimmer, textTransform: 'uppercase',
                      }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Cumulative progress ────────────────────────────────── */}
              <div style={{ marginTop: 22 }}>
                <HairLabel color={s2.onDarkDimmer} style={{ fontSize: 7.5, marginBottom: 9 }}>CUMULATIVE PROGRESS</HairLabel>
                <div style={{ height: 6, borderRadius: s2.rPill, background: 'rgba(246,247,243,0.10)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: s2.rPill, background: cfg.color }} />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8,
                  fontFamily: s2.sans, fontSize: 9.5, fontWeight: 700, color: s2.onDarkDimmer,
                }}>
                  <span>0</span>
                  <span style={{ color: cfg.color, textAlign: 'center' }}>
                    {pct.toFixed(1)}% of {cfg.label.toLowerCase()} target
                  </span>
                  <span>{fmtAmount(target, cfg.unit)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── The message pops out over the card's bottom edge ───────────── */}
      <div style={{ margin: '-24px 14px 0', position: 'relative' }}>
        <div style={{
          background: note.tone === 'warn' ? s2.peach : s2.accentFill,
          borderRadius: 22, padding: 15,
          boxShadow: '0 14px 32px rgba(15,20,15,0.22)',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 26, height: 26, borderRadius: s2.rPill, flexShrink: 0,
              background: 'rgba(15,20,15,0.14)',
              display: 'grid', placeItems: 'center',
              fontFamily: s2.sans, fontSize: 13, fontWeight: 800, color: s2.ink,
            }}>
              {note.tone === 'warn' ? '!' : '✓'}
            </div>
            <div>
              <HairLabel color="rgba(15,20,15,0.5)">{note.title.toUpperCase()}</HairLabel>
              <div style={{
                fontFamily: s2.sans, fontSize: 13.5, fontWeight: 600,
                color: s2.ink, lineHeight: 1.45, marginTop: 6,
              }}>
                {note.text}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
