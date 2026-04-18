// ── Arc gauge geometry ────────────────────────────────────────────────────
// 270° speedometer arc: gap at the bottom.
// Angles use the convention: 0° = top, 90° = right, 180° = bottom, 270° = left
// Start: 225° (lower-left)   End: 135° (lower-right)   Direction: clockwise

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function makeArcPath(cx: number, cy: number, r: number): string {
  const start = polarToCartesian(cx, cy, r, 225); // lower-left
  const end   = polarToCartesian(cx, cy, r, 135); // lower-right
  // large-arc=1 (270° > 180°), sweep=1 (clockwise)
  return [
    `M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
    `A ${r} ${r} 0 1 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
  ].join(' ');
}

// ── Colour logic ──────────────────────────────────────────────────────────
function getGaugeColor(consumed: number, target: number): string {
  if (target <= 0) return '#FFB300';
  const pct = consumed / target;
  if (pct > 1.0)  return '#FF2D2D'; // red   — over 100%
  if (pct >= 0.8) return '#00FF88'; // neon green — 80–100%
  return '#FFB300';                  // amber — below 80%
}

// ── ArcGauge ──────────────────────────────────────────────────────────────
export interface ArcGaugeProps {
  label: string;
  consumed: number;
  target: number;
  unit: 'kcal' | 'g';
  size: number;
  strokeWidth: number;
  isCenter?: boolean;
}

export function ArcGauge({
  label, consumed, target, unit,
  size, strokeWidth, isCenter = false,
}: ArcGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;

  // Arc length for 270° portion of the full circumference
  const arcLength = 2 * Math.PI * radius * (270 / 360);

  const rawPct    = target > 0 ? consumed / target : 0;
  const fillPct   = Math.min(rawPct, 1);          // caps at 1 for visual fill
  const dashOffset = arcLength * (1 - fillPct);
  const displayPct = Math.round(rawPct * 100);    // uncapped — can show 124%

  const gaugeColor = getGaugeColor(consumed, target);
  // Unique filter ID per label to prevent glow bleed across gauges
  const filterId = `glow-macro-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

  const trackPath = makeArcPath(cx, cy, radius);

  const consumedDisplay = unit === 'kcal'
    ? Math.round(consumed).toLocaleString()
    : Math.round(consumed).toString();
  const targetDisplay = unit === 'kcal'
    ? Math.round(target).toLocaleString()
    : Math.round(target).toString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {/* Label above — only for the 4 small gauges */}
      {!isCenter && (
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'sans-serif',
        }}>
          {label}
        </span>
      )}

      {/* SVG ring + overlaid text */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            {/* Per-gauge glow filter — scoped by unique ID */}
            <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track arc — full 270°, dark fill */}
          <path
            d={trackPath}
            fill="none"
            stroke="#1A1A2E"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress arc — glow applied only here */}
          <path
            d={trackPath}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={dashOffset}
            filter={`url(#${filterId})`}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
          />
        </svg>

        {/* Inner text — absolutely positioned over the SVG */}
        {isCenter ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 16,
            gap: 3,
          }}>
            <span style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 1,
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
            }}>
              Calories
            </span>
            <span style={{
              fontSize: 28,
              fontWeight: 900,
              color: gaugeColor,
              fontFamily: 'Playfair Display, serif',
              lineHeight: 1,
            }}>
              {displayPct}%
            </span>
            <span style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'DM Mono, monospace',
            }}>
              {consumedDisplay} / {targetDisplay}
            </span>
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'sans-serif',
            }}>
              kcal
            </span>
          </div>
        ) : (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 8,
            gap: 1,
          }}>
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              color: gaugeColor,
              fontFamily: 'DM Mono, monospace',
              lineHeight: 1,
            }}>
              {displayPct}%
            </span>
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.45)',
              fontFamily: 'DM Mono, monospace',
            }}>
              {consumedDisplay}{unit === 'kcal' ? '' : 'g'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Legacy export (unused by new design — kept for safety) ─────────────────
export const MACRO_COLORS = {
  calories: '#E8845A',
  protein:  '#4CAF82',
  carbs:    '#7B6CF6',
  fat:      '#F0B429',
  fibre:    '#64B5F6',
} as const;

// Backwards-compat shim so any stale import of CircularMacroRing still compiles
export { ArcGauge as CircularMacroRing };
