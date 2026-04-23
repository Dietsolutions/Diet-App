import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

/** 9 px IBM Plex Mono uppercase kicker — the eyebrow label of the design system. */
export function HairLabel({ children, color, style }: Props) {
  return (
    <div style={{
      fontFamily: s2.mono,
      fontSize: 9,
      letterSpacing: '0.22em',
      color: color ?? s2.textDimmer,
      fontWeight: 500,
      textTransform: 'uppercase',
      ...style,
    }}>
      {children}
    </div>
  );
}
