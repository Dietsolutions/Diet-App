import { s2 } from '../../theme/tokens';

interface Props {
  on: boolean;
  color?: string;
  size?: number;
}

/** Round checkbox — filled lime when on, hairline border when off. (ref: V3Check) */
export function Check({ on, color, size = 14 }: Props) {
  const c = color ?? s2.accentFill;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: s2.rPill,
      border: on ? 'none' : `1.5px solid ${s2.lineStrong}`,
      background: on ? c : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {on && (
        <svg width={size - 4} height={size - 4} viewBox="0 0 10 10">
          <path
            d="M1.5 5 L4 7.5 L8.5 2.5"
            stroke={s2.ink}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
