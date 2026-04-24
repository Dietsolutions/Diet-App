// WeightStatsHeader — Strain v2 visual. All store logic preserved.

import { useWeightStore } from '../../store/weightStore';
import { s2 } from '../../theme/tokens';
import { HairLabel, Bar } from '../ui';

export function WeightStatsHeader() {
  const { logs, openLogModal, getCurrentWeight, getTotalLost, getProgressPercent } = useWeightStore();

  if (logs.length === 0) {
    return (
      <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <HairLabel>WEIGHT PROGRESS</HairLabel>
        <button
          onClick={() => openLogModal()}
          style={{
            padding: '7px 14px',
            background: s2.accent,
            border: 'none',
            fontFamily: s2.mono,
            fontSize: 9,
            letterSpacing: '0.15em',
            color: s2.bg,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          + LOG WEIGHT
        </button>
      </div>
    );
  }

  const startW    = logs[0].weightKg;
  const currentW  = getCurrentWeight();
  const totalLost = getTotalLost();
  const progress  = getProgressPercent();
  const lostColor = totalLost > 0 ? '#4CAF82' : totalLost < 0 ? s2.warn : s2.text;

  return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <HairLabel>WEIGHT PROGRESS</HairLabel>
        <button
          onClick={() => openLogModal()}
          style={{
            padding: '6px 12px',
            background: s2.accent,
            border: 'none',
            fontFamily: s2.mono,
            fontSize: 9,
            letterSpacing: '0.15em',
            color: s2.bg,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          + LOG
        </button>
      </div>

      {/* 3-column stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 18, fontWeight: 400, color: s2.text }}>{startW}</div>
          <HairLabel style={{ marginTop: 4 }}>STARTED</HairLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 18, fontWeight: 400, color: s2.accent }}>{currentW}</div>
          <HairLabel style={{ marginTop: 4 }}>CURRENT</HairLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 18, fontWeight: 400, color: lostColor }}>
            {totalLost > 0 ? '-' : totalLost < 0 ? '+' : ''}{Math.abs(totalLost)} kg
          </div>
          <HairLabel style={{ marginTop: 4 }}>LOST</HairLabel>
        </div>
      </div>

      {/* Progress bar */}
      <Bar pct={progress / 100} color={s2.accent} h={2} />
      <HairLabel style={{ marginTop: 6, textAlign: 'right' }}>{progress}% TO GOAL</HairLabel>
    </div>
  );
}
