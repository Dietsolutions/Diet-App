import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

/** Uppercase kicker/eyebrow label — 10px Plus Jakarta Sans, weight 700. (ref: V3Kick) */
export function HairLabel({ children, color, style }: Props) {
  return (
    <div style={{
      fontFamily: s2.sans,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: color ?? s2.textDimmer,
      ...style,
    }}>
      {children}
    </div>
  );
}
