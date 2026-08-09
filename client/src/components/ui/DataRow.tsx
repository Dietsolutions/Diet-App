import { s2 } from '../../theme/tokens';

interface Props {
  label: string;
  value: string | number;
  accent?: string;
  unit?: string;
  last?: boolean;
}

/** Flex row: label left, value right, hairline divider. (Fresh Light — sans, tabular value) */
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
        fontFamily: s2.sans,
        fontSize: 10,
        letterSpacing: '0.14em',
        color: s2.textDimmer,
        fontWeight: 700,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: s2.sans,
        fontSize: 13,
        fontWeight: 700,
        color: accent ?? s2.text,
        letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        {unit && (
          <span style={{ color: s2.textDim, marginLeft: 3, fontSize: 10, fontWeight: 600 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}
