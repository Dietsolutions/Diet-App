import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  color?: string;
  filled?: boolean;
}

/** Pill chip — outlined by default, solid lime (or `color`) when filled. (ref: V3Chip) */
export function Pill({ children, color, filled }: Props) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: s2.sans,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
      color: filled ? s2.ink : (color ?? s2.text),
      background: filled ? (color ?? s2.accentFill) : 'transparent',
      border: filled ? 'none' : `1px solid ${color ?? s2.lineStrong}`,
      borderRadius: s2.rPill,
      padding: '6px 11px',
    }}>
      {children}
    </span>
  );
}
