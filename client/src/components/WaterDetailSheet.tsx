// WaterDetailSheet — Fresh Light full-screen water detail. (ref: V3Water)
// Wired to the existing /api/water endpoint (same as WaterIntakeCard).
// 1 glass = 250 ml; goal comes from the profile — data rules unchanged.

import { useCallback, useEffect, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Ring, Btn } from './ui';
import { track } from '../lib/analytics';

interface Props {
  date: string;
  onClose: () => void;
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

  const litres     = (glasses * 0.25).toFixed(1);
  const goalLitres = (goal * 0.25).toFixed(1);
  const pct        = goal > 0 ? Math.round((glasses / goal) * 100) : 0;
  const avgLitres  = history.length
    ? (history.reduce((a, h) => a + h.glasses, 0) / history.length * 0.25).toFixed(1)
    : null;

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
      <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onClose}
          style={{
            background: s2.surface,
            border: 'none',
            borderRadius: s2.rPill,
            width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: s2.text,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11">
            <path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <HairLabel>HYDRATION</HairLabel>
          <div style={{ fontFamily: s2.disp, fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 2 }}>Water</div>
        </div>
        <span style={{
          fontFamily: s2.sans, fontSize: 11, fontWeight: 700,
          background: s2.surface, color: s2.text,
          borderRadius: s2.rPill, padding: '7px 12px', whiteSpace: 'nowrap',
        }}>
          Goal {goalLitres} L
        </span>
      </div>

      {/* Sky hero — dashed-remainder ring */}
      <div style={{ padding: '20px 20px 0' }}>
        <Card bg={s2.sky} radius={32} padding={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring pct={goal > 0 ? glasses / goal : 0} size={144} thick={14} color={s2.ink} track="rgba(15,20,15,0.14)" dashRemainder>
              <div>
                <div style={{ fontFamily: s2.disp, fontSize: 34, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1, color: s2.ink }}>{litres}</div>
                <div style={{ fontFamily: s2.sans, fontSize: 10.5, fontWeight: 700, color: 'rgba(15,20,15,0.5)', marginTop: 4 }}>of {goalLitres} L</div>
              </div>
            </Ring>
            <div>
              <div style={{ fontFamily: s2.disp, fontSize: 30, fontWeight: 700, letterSpacing: '-0.04em', color: s2.ink }}>{pct}%</div>
              <div style={{ fontFamily: s2.sans, fontSize: 12, fontWeight: 600, color: 'rgba(15,20,15,0.5)', marginTop: 5 }}>
                {glasses} of {goal} glasses
              </div>
              <div style={{ fontFamily: s2.sans, fontSize: 11.5, fontWeight: 500, color: 'rgba(15,20,15,0.45)', marginTop: 10, lineHeight: 1.5 }}>
                {glasses >= goal ? 'Goal hit for today.' : `${goal - glasses} glasses left to hit your goal.`}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Glass grid — 5 columns, tap to set/unset */}
      <div style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {Array.from({ length: goal }, (_, i) => {
          const on = i < glasses;
          return (
            <button
              key={i}
              onClick={() => handleTap(i + 1)}
              style={{
                aspectRatio: '2/3',
                borderRadius: '10px 10px 16px 16px',
                cursor: 'pointer',
                background: on ? s2.water : s2.surface,
                border: on ? 'none' : `1.5px solid ${s2.line}`,
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                padding: 0,
                transition: 'background 200ms ease-out',
              }}
            >
              {on && <div style={{ position: 'absolute', left: 0, right: 0, top: '26%', height: 1, background: 'rgba(255,255,255,0.55)' }} />}
              <span style={{ fontFamily: s2.sans, fontSize: 12, fontWeight: 700, color: on ? s2.ink : s2.textDimmer, zIndex: 1 }}>{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Quick-log — 250 ml per glass */}
      <div style={{ padding: '18px 20px 0', display: 'flex', gap: 8 }}>
        {[
          { label: '+1 glass', add: 1 },
          { label: '+ Bottle', add: 2 },
          { label: '+ 1 litre', add: 4 },
        ].map((x) => (
          <Btn key={x.label} small kind="light" full onClick={() => quickLog(x.add)}>
            {x.label}
          </Btn>
        ))}
      </div>

      {/* 7-day history card */}
      {history.length > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <Card radius={26} padding={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <HairLabel>LAST 7 DAYS</HairLabel>
              {avgLitres && (
                <span style={{ fontFamily: s2.sans, fontSize: 11.5, fontWeight: 700, color: s2.waterText }}>
                  Avg {avgLitres} L
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96, marginTop: 16 }}>
              {history.map((h) => {
                const isToday = h.date === date;
                const dayLetter = format(parseISO(h.date), 'EEEEE');
                return (
                  <div key={h.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${Math.min(goal > 0 ? h.glasses / goal : 0, 1) * 100}%`,
                      minHeight: 3,
                      borderRadius: 10,
                      background: isToday ? s2.water : 'rgba(99,184,232,0.30)',
                    }} />
                    <span style={{ fontFamily: s2.sans, fontSize: 9.5, fontWeight: 700, color: isToday ? s2.waterText : s2.textDimmer }}>
                      {dayLetter}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
