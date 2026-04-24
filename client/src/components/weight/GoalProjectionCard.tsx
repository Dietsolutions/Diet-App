// GoalProjectionCard — Strain v2 visual. All hook logic preserved.

import { useGoalProjection } from '../../hooks/useGoalProjection';
import { s2 } from '../../theme/tokens';
import { HairLabel } from '../ui';

export function GoalProjectionCard() {
  const { weeksLeft, monthsLeft, goalDate, targetWeight, weeklyLossKg } = useGoalProjection();

  if (!goalDate) return null;

  const formattedDate = new Date(goalDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div style={{
      marginTop: 10,
      border: `1px solid ${s2.accent}`,
      background: s2.accentFill,
      padding: '12px 14px',
    }}>
      <HairLabel color={s2.accentSoft} style={{ marginBottom: 10 }}>GOAL PROJECTION</HairLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 14, color: s2.accent }}>{targetWeight} kg</div>
          <HairLabel style={{ marginTop: 4 }}>TARGET</HairLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 12, color: s2.text }}>{formattedDate}</div>
          <HairLabel style={{ marginTop: 4 }}>EST. DATE</HairLabel>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 14, color: s2.text }}>
            {monthsLeft > 0 ? `${monthsLeft}mo` : `${weeksLeft}w`}
          </div>
          <HairLabel style={{ marginTop: 4 }}>REMAINING</HairLabel>
        </div>
      </div>
      <HairLabel style={{ marginTop: 10, textAlign: 'center', fontSize: 7 }}>
        ~{weeklyLossKg} KG/WEEK PROJECTED LOSS RATE
      </HairLabel>
    </div>
  );
}
