import { ReactNode } from 'react';
import { s2 } from '../../theme/tokens';
import { HairLabel } from './HairLabel';

interface Props {
  onBack?: () => void;
  title?: string;
  kicker?: string;
  right?: ReactNode;
}

/** Back-arrow header bar used on detail / flow screens. */
export function TopBar({ onBack, title, kicker, right }: Props) {
  return (
    <div style={{
      padding: '6px 20px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: `1px solid ${s2.lineStrong}`,
          width: 36,
          height: 36,
          color: s2.text,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11">
          <path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>

      {/* Centre text */}
      <div style={{ textAlign: 'center', flex: 1 }}>
        {kicker && <HairLabel>{kicker}</HairLabel>}
        {title && (
          <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, marginTop: 2 }}>
            {title}
          </div>
        )}
      </div>

      {/* Right slot */}
      <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {right}
      </div>
    </div>
  );
}
