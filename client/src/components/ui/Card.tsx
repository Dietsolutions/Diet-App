import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  padding?: number | string;
  /** Surface colour — pass a pastel or s2.ink for a dark card. */
  bg?: string;
  /** Border colour; defaults to transparent (Fresh Light cards are borderless). */
  border?: string;
  /** Corner radius; defaults to the large card radius (24). */
  radius?: number;
  onClick?: () => void;
  style?: CSSProperties;
}

/** Fresh Light surface card — rounded, borderless, soft. (ref: V3Card) */
export function Card({ children, padding = 18, bg, border, radius = s2.rLg, onClick, style }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg ?? s2.surface,
        borderRadius: radius,
        border: border ? `1px solid ${border}` : '1px solid transparent',
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 200ms ease-out',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
