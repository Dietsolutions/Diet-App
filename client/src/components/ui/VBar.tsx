import { s2 } from '../../theme/tokens';

interface Props {
  /** 0..1 fill fraction */
  pct: number;
  color?: string;
  /** Height in px. Default 80. */
  h?: number;
}

/** Vertical progress bar that fills from the bottom — rounded. Used in macro detail views. */
export function VBar({ pct, color, h = 80 }: Props) {
  return (
    <div style={{
      width: 10,
      height: h,
      background: 'rgba(15,20,15,0.10)',
      borderRadius: s2.rPill,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${Math.min(100, Math.max(0, pct * 100))}%`,
        borderRadius: s2.rPill,
        background: color ?? s2.accentSoft,
        transition: 'height 400ms ease-out',
      }} />
    </div>
  );
}
