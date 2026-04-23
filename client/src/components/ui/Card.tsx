import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  padding?: number | string;
  onClick?: () => void;
  style?: CSSProperties;
}

/** Surface card — warm-dark bg + hairline warm border, zero border-radius. */
export function Card({ children, padding = 16, onClick, style }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: s2.surface,
        border: `1px solid ${s2.line}`,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 180ms',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
