import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';
import { HairLabel } from './HairLabel';

interface Props {
  kicker?: string;
  title: string;
  right?: ReactNode;
}

/** Large screen header: 9 px mono kicker above 30 px display title, optional right slot. */
export function SectionTitle({ kicker, title, right }: Props) {
  return (
    <div style={{
      padding: '14px 20px 0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    }}>
      <div>
        {kicker && <HairLabel>{kicker}</HairLabel>}
        <div style={{
          fontFamily: s2.sans,
          fontSize: 30,
          fontWeight: 400,
          letterSpacing: '-0.025em',
          marginTop: 4,
          lineHeight: 1,
          color: s2.text,
        }}>
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}
