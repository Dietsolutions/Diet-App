interface CircularMacroRingProps {
  label: string;
  consumed: number;
  target: number;
  unit: 'kcal' | 'g';
  color: string;
  size?: number;
  strokeWidth?: number;
}

// Three-state colour logic:
//   >100% → red, 80–100% → green, <80% → amber
// baseColor is no longer used for the ring stroke — kept for API compatibility
function getMacroColor(consumed: number, target: number): string {
  if (target <= 0) return '#F0B429';
  const pct = consumed / target;
  if (pct > 1.0)  return '#DC2626'; // red  — over target
  if (pct >= 0.8) return '#4CAF82'; // green — 80-100%
  return '#F0B429';                  // amber — below 80%
}

export function CircularMacroRing({
  label, consumed, target, unit,
  size = 56, strokeWidth = 5,
}: CircularMacroRingProps) {
  // Uncapped pct for text display; capped at 1 for ring fill
  const rawPct    = target > 0 ? consumed / target : 0;
  const fillPct   = Math.min(rawPct, 1);
  const displayPct = Math.round(rawPct * 100); // can exceed 100

  const radius       = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - fillPct);

  const displayColor = getMacroColor(consumed, target);

  const consumedDisplay = unit === 'kcal'
    ? Math.round(consumed).toLocaleString()
    : Math.round(consumed).toString();
  const targetDisplay = unit === 'kcal'
    ? Math.round(target).toLocaleString()
    : Math.round(target).toString();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
    }}>
      {/* SVG ring */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2A2D3E"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={displayColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
            }}
          />
        </svg>

        {/* Centre text — percentage */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: displayColor,
            fontFamily: 'DM Mono, monospace',
            lineHeight: 1,
          }}>
            {displayPct}%
          </span>
        </div>
      </div>

      {/* Consumed / Target */}
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: displayColor,
            fontFamily: 'DM Mono, monospace',
          }}>
            {consumedDisplay}
          </span>
          <span style={{ fontSize: 9, color: '#6B7280' }}>
            {unit === 'kcal' ? '' : 'g'}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: '#6B7280' }}>
            /{targetDisplay}{unit === 'kcal' ? 'kcal' : 'g'}
          </span>
        </div>
      </div>

      {/* Label — below consumed/target */}
      <span style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.3px',
        textTransform: 'uppercase',
        color: 'var(--color-dimmed, #6B7280)',
        fontFamily: 'sans-serif',
      }}>
        {label}
      </span>
    </div>
  );
}

export const MACRO_COLORS = {
  calories: '#E8845A',
  protein:  '#4CAF82',
  carbs:    '#7B6CF6',
  fat:      '#F0B429',
  fibre:    '#64B5F6',
} as const;
