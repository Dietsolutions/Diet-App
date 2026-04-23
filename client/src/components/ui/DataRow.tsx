import { s2 } from '../../theme/tokens';

interface Props {
  label: string;
  value: string | number;
  accent?: string;
  unit?: string;
  last?: boolean;
}

/** Flex row with mono label on the left and value on the right, separated by a hairline border. */
export function DataRow({ label, value, accent, unit, last }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${s2.line}`,
    }}>
      <div style={{
        fontFamily: s2.mono,
        fontSize: 9,
        letterSpacing: '0.22em',
        color: s2.textDimmer,
        fontWeight: 500,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: s2.mono,
        fontSize: 13,
        fontWeight: 500,
        color: accent ?? s2.text,
        letterSpacing: '-0.01em',
      }}>
        {value}
        {unit && (
          <span style={{ color: s2.textDim, marginLeft: 3, fontSize: 10 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}
