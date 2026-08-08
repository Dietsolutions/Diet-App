import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  color?: string;
  filled?: boolean;
}

/** 9 px mono chip — outlined by default, solid when filled=true. */
export function Pill({ children, color, filled }: Props) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: s2.mono,
      fontSize: 9,
      letterSpacing: '0.15em',
      fontWeight: 600,
      textTransform: 'uppercase',
      color: filled ? s2.ink : (color ?? s2.text),
      background: filled ? (color ?? s2.accentFill) : 'transparent',
      border: filled ? 'none' : `1px solid ${color ?? s2.lineStrong}`,
      padding: '3px 7px',
    }}>
      {children}
    </span>
  );
}
