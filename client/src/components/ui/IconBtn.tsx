import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  bg?: string;
  color?: string;
  size?: number;
  border?: string;
}

/** Circular icon button. (ref: V3IconBtn) */
export function IconBtn({ children, onClick, bg, color, size = 42, border }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: s2.rPill,
        background: bg ?? s2.surface,
        color: color ?? s2.text,
        border: border ?? 'none',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        fontFamily: s2.sans,
        fontSize: 16,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
