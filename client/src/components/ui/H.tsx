import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: CSSProperties;
}

/** Archivo display headline — tight tracking. (ref: V3H) */
export function H({ children, size = 34, color, weight = 700, style }: Props) {
  return (
    <div style={{
      fontFamily: s2.disp,
      fontSize: size,
      fontWeight: weight,
      letterSpacing: '-0.042em',
      lineHeight: 1.02,
      color: color ?? s2.text,
      ...style,
    }}>
      {children}
    </div>
  );
}
