import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';

interface Props {
  label: ReactNode;
  value: ReactNode;
  color?: string;
  last?: boolean;
  onClick?: () => void;
  chevron?: boolean;
}

/** List row: label left, value right, hairline divider. (ref: V3Row) */
export function Row({ label, value, color, last, onClick, chevron }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 0',
        borderBottom: last ? 'none' : `1px solid ${s2.line}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontFamily: s2.sans, fontSize: 13.5, fontWeight: 500, color: s2.textDim }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: s2.sans, fontSize: 13.5, fontWeight: 700, color: color ?? s2.text }}>
        {value}{chevron && <span style={{ color: s2.textDimmer, fontWeight: 600 }}>→</span>}
      </span>
    </div>
  );
}
