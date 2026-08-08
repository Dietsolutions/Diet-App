import { CSSProperties, ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
  full?: boolean;
  small?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}

/** Sharp-corner button. primary=true fills with accent; default is ghost with border. */
export function Btn({ children, primary, onClick, full, small, disabled, style }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        cursor: disabled ? 'default' : 'pointer',
        border: primary ? 'none' : `1px solid ${s2.lineStrong}`,
        background: primary ? s2.accentFill : 'transparent',
        color: primary ? s2.ink : s2.text,
        padding: small ? '10px 14px' : '15px 20px',
        width: full ? '100%' : 'auto',
        fontFamily: s2.mono,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
