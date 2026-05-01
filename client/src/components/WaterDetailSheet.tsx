// WaterDetailSheet — Strain v2 full-screen water detail.
// New screen wired to the existing /api/water endpoint (same as WaterIntakeCard).

import { useCallback, useEffect, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';
import { track } from '../lib/analytics';

interface Props {
  date: string;
  onClose: () => void;
}

// ── SVG beaker glass (flat-top silhouette, 2:3 aspect) ──────────────────────
function WaterGlass({ on, index, onClick }: { on: boolean; index: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        aspectRatio: '2/3',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 30 45" preserveAspectRatio="none">
        {/* Beaker body: narrow at top, flares to base */}
        <path
          d="M 5 3 L 25 3 L 27 42 L 3 42 Z"
          fill={on ? s2.accent : 'transparent'}
          stroke={on ? s2.accent : s2.lineStrong}
          strokeWidth="1.5"
          strokeLinejoin="miter"
        />
        {/* Waterline on filled glasses */}
        {on && <line x1="4" y1="14" x2="26" y2="14" stroke="#0C0907" strokeWidth="1" opacity="0.35" />}
      </svg>
      {/* Number */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        textAlign: 'center',
        fontFamily: s2.mono,
        fontSize: 11,
        fontWeight: 600,
        color: on ? '#0C0907' : s2.textDimmer,
        letterSpacing: '0.05em',
        lineHeight: 1,
      }}>
        {index + 1}
      </div>
    </button>
  );
}

// ── WaterDetailSheet ───────────────────────────────────────────────────────
export function WaterDetailSheet({ date, onClose }: Props) {
  const { waterByDate, setWater, profile } = useAppStore();
  const goal    = profile?.waterIntakeGoal ?? 8;
  const glasses = waterByDate[date] ?? 0;

  // Last 7 days history
  const [history, setHistory] = useState<{ date: string; glasses: number }[]>([]);

  const fetchWater = useCallback(async () => {
    try {
      const res = await axios.get('/api/water', { params: { date }, withCredentials: true });
      setWater(date, res.data.glasses ?? 0);
    } catch {
      setWater(date, 0);
    }
  }, [date, setWater]);

  // Fetch 7-day history
  const fetchHistory = useCallback(async () => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return format(d, 'yyyy-MM-dd');
    });

    const results = await Promise.allSettled(
      days.map(d => axios.get('/api/water', { params: { date: d }, withCredentials: true }))
    );

    const hist = days.map((d, i) => ({
      date: d,
      glasses: results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<any>).value.data.glasses ?? 0 : 0,
    }));
    setHistory(hist);
  }, []);

  useEffect(() => {
    fetchWater();
    fetchHistory();
  }, [date, fetchWater, fetchHistory]);

  const handleTap = async (n: number) => {
    const newVal = glasses === n ? n - 1 : n;
    const clamped = Math.max(0, newVal);
    setWater(date, clamped);
    try {
      await axios.post('/api/water', { date, glasses: clamped }, { withCredentials: true });
      track('water_logged', {
        glasses:      clamped,
        goal_glasses: goal,
        pct_of_goal:  goal > 0 ? Math.round((clamped / goal) * 100) : 0,
      });
    } catch {
      setWater(date, glasses);
    }
  };

  // Quick-log helpers (250ml = 1 glass, 500ml = 2 glasses, 1L = 4 glasses)
  const quickLog = async (addGlasses: number) => {
    const newVal = Math.min(glasses + addGlasses, goal * 2);
    setWater(date, newVal);
    try {
      await axios.post('/api/water', { date, glasses: newVal }, { withCredentials: true });
      track('water_logged', {
        glasses:      newVal,
        goal_glasses: goal,
        pct_of_goal:  goal > 0 ? Math.round((newVal / goal) * 100) : 0,
      });
    } catch {
      setWater(date, glasses);
    }
  };

  const litres    = (glasses * 0.25).toFixed(1);
  const goalLitres = (goal * 0.25).toFixed(1);
  const pct       = goal > 0 ? Math.round((glasses / goal) * 100) : 0;

  const maxHistory = Math.max(...history.map(h => h.glasses), goal);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: s2.bg,
      zIndex: 40,
      overflowY: 'auto',
      paddingBottom: 40,
    }}>
      {/* Top bar */}
      <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: `1px solid ${s2.lineStrong}`,
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: s2.text,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11">
            <path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <HairLabel>HYDRATION</HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, marginTop: 2 }}>Water intake</div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Hero metric */}
      <div style={{ padding: '28px 20px 0', textAlign: 'center' }}>
        <HairLabel>TODAY · GOAL {goalLitres} L</HairLabel>
        <div style={{
          fontFamily: s2.sans,
          fontSize: 88,
          fontWeight: 200,
          letterSpacing: '-0.05em',
          color: s2.accent,
          lineHeight: 1,
          marginTop: 10,
        }}>
          {litres}<span style={{ fontSize: 22, color: s2.textDim, marginLeft: 6 }}>L</span>
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDim, marginTop: 6, letterSpacing: '0.15em' }}>
          {pct}% · {glasses} OF {goal} GLASSES
        </div>
      </div>

      {/* 5×2 glass grid */}
      <div style={{ padding: '32px 28px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {Array.from({ length: goal }, (_, i) => (
            <WaterGlass
              key={i}
              on={i < glasses}
              index={i}
              onClick={() => handleTap(i + 1)}
            />
          ))}
        </div>
      </div>

      {/* Quick-log buttons */}
      <div style={{ padding: '28px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: '+1 GLASS', sub: '250 ml', add: 1 },
          { label: '+BOTTLE',  sub: '500 ml', add: 2 },
          { label: '+LITER',   sub: '1.0 L',  add: 4 },
        ].map((x) => (
          <button
            key={x.label}
            onClick={() => quickLog(x.add)}
            style={{
              background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              padding: '14px 8px',
              cursor: 'pointer',
              color: s2.text,
            }}
          >
            <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: s2.accent, textTransform: 'uppercase' }}>
              {x.label}
            </div>
            <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, marginTop: 4, letterSpacing: '0.1em' }}>
              {x.sub}
            </div>
          </button>
        ))}
      </div>

      {/* 7-day bar chart */}
      {history.length > 0 && (
        <div style={{ padding: '28px 20px 0' }}>
          <HairLabel style={{ marginBottom: 12 }}>LAST 7 DAYS</HairLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {history.map((h, i) => {
              const isToday  = h.date === date;
              const barH     = maxHistory > 0 ? (h.glasses / maxHistory) * 54 : 0;
              const dayLetter = format(parseISO(h.date), 'EEEEE');
              return (
                <div key={h.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <HairLabel style={{ fontSize: 8 }}>{(h.glasses * 0.25).toFixed(1)}L</HairLabel>
                  <div style={{ width: '100%', background: s2.surface2, height: 54, position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      height: barH,
                      background: isToday ? s2.accent : s2.accentSoft,
                      opacity: isToday ? 1 : 0.4,
                    }} />
                  </div>
                  <HairLabel style={{ fontSize: 8 }}>{dayLetter}</HairLabel>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
