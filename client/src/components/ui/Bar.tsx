import { s2 } from '../../theme/tokens';

interface Props {
  /** 0..1 fill fraction */
  pct: number;
  color?: string;
  /** Height in px. Default 2. */
  h?: number;
  bg?: string;
}

/** Horizontal progress bar — flat, no border-radius. */
export function Bar({ pct, color, h = 2, bg }: Props) {
  return (
    <div style={{ height: h, background: bg ?? s2.line, position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: `${Math.max(0, Math.min(100, pct * 100))}%`,
        background: color ?? s2.accent,
      }} />
    </div>
  );
}
