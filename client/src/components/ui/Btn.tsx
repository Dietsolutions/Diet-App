import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

export type BtnKind = 'lime' | 'dark' | 'light' | 'ghost' | 'onDark' | 'warn';

interface Props {
  children: ReactNode;
  /** Preferred: one of the six Fresh Light kinds. */
  kind?: BtnKind;
  /** Legacy: primary=true → lime, otherwise ghost. Kept for existing call sites. */
  primary?: boolean;
  onClick?: () => void;
  full?: boolean;
  small?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}

const KINDS: Record<BtnKind, CSSProperties> = {
  lime:   { background: s2.accentFill, color: s2.ink, border: 'none' },
  dark:   { background: s2.ink, color: s2.onDark, border: 'none' },
  light:  { background: s2.surface, color: s2.text, border: `1px solid ${s2.lineStrong}` },
  ghost:  { background: 'transparent', color: s2.textDim, border: `1px solid ${s2.lineStrong}` },
  onDark: { background: 'rgba(246,247,243,0.10)', color: s2.onDark, border: `1px solid ${s2.lineDark}` },
  warn:   { background: 'transparent', color: s2.warn, border: `1px solid rgba(229,72,77,0.35)` },
};

/** Fresh Light pill button — six kinds. (ref: V3Btn) */
export function Btn({ children, kind, primary, onClick, full, small, disabled, style }: Props) {
  const resolved: BtnKind = kind ?? (primary ? 'lime' : 'ghost');
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...KINDS[resolved],
        borderRadius: s2.rPill,
        padding: small ? '11px 18px' : '16px 24px',
        width: full ? '100%' : 'auto',
        fontFamily: s2.sans,
        fontSize: small ? 13 : 15,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 200ms ease-out',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
