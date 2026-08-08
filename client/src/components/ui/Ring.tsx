import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  /** 0..1 fill fraction */
  pct?: number;
  size?: number;
  thick?: number;
  color?: string;
  track?: string;
  /** Dashed remainder track (Fresh Light gauge look). */
  dashRemainder?: boolean;
  children?: ReactNode;
}

/** Donut gauge with optional dashed-remainder track. (ref: V3Ring) */
export function Ring({ pct = 0, size = 148, thick = 14, color, track, dashRemainder, children }: Props) {
  const c = color ?? s2.accentFill;
  const r = (size - thick) / 2;
  const C = 2 * Math.PI * r;
  const trackColor = track ?? 'rgba(15,20,15,0.10)';
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={trackColor} strokeWidth={thick}
          strokeDasharray={dashRemainder ? '2 6' : undefined}
          strokeLinecap={dashRemainder ? 'round' : 'butt'}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={c} strokeWidth={thick} strokeLinecap="round"
          strokeDasharray={`${C * Math.min(1, Math.max(0, pct))} ${C}`}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}
