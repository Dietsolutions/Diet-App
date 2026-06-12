import { ReactNode, CSSProperties } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { s2 } from '../../theme/tokens';

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
}

export function PullRefreshWrapper({ onRefresh, children, style, disabled }: Props) {
  const { containerRef, indicatorRef } = usePullToRefresh({ onRefresh, disabled });

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', overflowY: 'auto', height: '100%', ...style }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="ptr-indicator"
        data-spinning="false"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateY(-40px) scale(0.6) translateX(-50%)',
          marginLeft: 0,
          opacity: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `2px solid ${s2.line}`,
          borderTopColor: s2.accent,
          pointerEvents: 'none',
          zIndex: 10,
          transition: 'opacity 120ms, transform 120ms',
          willChange: 'transform, opacity',
        }}
      />
      {children}
    </div>
  );
}
