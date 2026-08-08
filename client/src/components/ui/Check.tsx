import { s2 } from '../../theme/tokens';

interface Props {
  on: boolean;
  color?: string;
  size?: number;
}

/** Square checkbox — filled accent when on, hairline border when off. No border-radius. */
export function Check({ on, color, size = 14 }: Props) {
  const c = color ?? s2.accent;
  return (
    <div style={{
      width: size,
      height: size,
      border: `1px solid ${on ? c : s2.lineStrong}`,
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
            strokeLinecap="square"
          />
        </svg>
      )}
    </div>
  );
}
