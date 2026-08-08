import { s2 } from '../../theme/tokens';

interface Props {
  /** 0..1 fill fraction */
  pct: number;
  color?: string;
  /** Height in px. Default 80. */
  h?: number;
}

/** Vertical progress bar that fills from the bottom — used in macro detail views. */
export function VBar({ pct, color, h = 80 }: Props) {
  return (
    <div style={{
      width: 10,
      height: h,
      background: s2.line,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${Math.min(100, Math.max(0, pct * 100))}%`,
        background: color ?? s2.accentFill,
      }} />
    </div>
  );
}
