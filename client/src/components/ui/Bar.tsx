import { s2 } from '../../theme/tokens';

interface Props {
  /** 0..1 fill fraction */
  pct: number;
  color?: string;
  /** Height in px. Default 2 (kept for existing call sites; pass 8 for the chunky ref look). */
  h?: number;
  bg?: string;
  /** Striped fill (dark-deck inspiration). */
  striped?: boolean;
}

/** Horizontal progress bar — rounded ends. (ref: V3Bar) */
export function Bar({ pct, color, h = 2, bg, striped }: Props) {
  const c = color ?? s2.accentSoft;
  return (
    <div style={{ height: h, borderRadius: s2.rPill, background: bg ?? 'rgba(15,20,15,0.10)', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct * 100))}%`,
        height: '100%',
        borderRadius: s2.rPill,
        background: striped
          ? `repeating-linear-gradient(115deg, ${c} 0 7px, rgba(255,255,255,0.45) 7px 12px)`
          : c,
        transition: 'width 400ms ease-out',
      }} />
    </div>
  );
}
