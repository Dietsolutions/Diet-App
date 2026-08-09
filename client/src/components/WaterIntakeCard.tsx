import { useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAppStore } from '../store/appStore';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui/HairLabel';
import { Card } from './ui/Card';

interface Props {
  date: string;
  /** Called when the user taps the card body (navigate to water detail). Optional. */
  onExpand?: () => void;
}

/** Sky pastel hydration card. (ref: V3Meals hydration) */
export function WaterIntakeCard({ date, onExpand }: Props) {
  const { waterByDate, setWater, profile } = useAppStore();
  const goal = profile?.waterIntakeGoal ?? 8;
  const glasses = waterByDate[date] ?? -1; // -1 = not yet loaded

  const fetchWater = useCallback(async () => {
    try {
      const res = await axios.get('/api/water', { params: { date }, withCredentials: true });
      setWater(date, res.data.glasses ?? 0);
    } catch {
      setWater(date, 0);
    }
  }, [date, setWater]);

  useEffect(() => {
    if (glasses === -1) fetchWater();
  }, [date, glasses, fetchWater]);

  const handleTap = async (n: number) => {
    // Toggle: tapping the filled dot toggles it off; tapping an empty one fills up to it
    const newVal = glasses === n ? n - 1 : n;
    const clamped = Math.max(0, newVal);
    setWater(date, clamped);
    try {
      await axios.post('/api/water', { date, glasses: clamped }, { withCredentials: true });
    } catch {
      setWater(date, glasses);
    }
  };

  const displayGlasses = glasses === -1 ? 0 : glasses;
  const litres = (displayGlasses * 0.25).toFixed(1);
  const goalLitres = (goal * 0.25).toFixed(1);
  const pct = goal > 0 ? displayGlasses / goal : 0;
  const pctDisplay = Math.round(pct * 100);

  return (
    <Card bg={s2.sky} radius={24} padding={16} onClick={onExpand}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {/* Left: kicker + litres headline */}
        <div>
          <HairLabel color="rgba(15,20,15,0.5)">HYDRATION</HairLabel>
          <div style={{
            fontFamily: s2.disp,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            marginTop: 5,
            color: s2.ink,
          }}>
            {litres}
            <span style={{ fontFamily: s2.sans, fontSize: 12, fontWeight: 600, color: 'rgba(15,20,15,0.55)' }}>
              {' '}/ {goalLitres}L · {pctDisplay}%
            </span>
          </div>
        </div>

        {/* Right: tappable vertical bars */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: goal }, (_, i) => {
            const filled = i < displayGlasses;
            return (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation(); // don't fire onExpand
                  handleTap(i + 1);
                }}
                style={{
                  width: 9,
                  height: 30,
                  borderRadius: 3,
                  background: filled ? s2.ink : 'rgba(15,20,15,0.18)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 150ms',
                }}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}
