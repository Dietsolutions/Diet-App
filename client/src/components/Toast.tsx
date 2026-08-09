// Toast — Strain v2. All hook logic preserved.

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { s2 } from '../theme/tokens';

export interface ToastHandle {
  show: (message: string) => void;
}

export const Toast = forwardRef<ToastHandle>((_, ref) => {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    show: (msg: string) => {
      setMessage(msg);
      setVisible(true);
    },
  }));

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible || !message) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 88,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 60,
      width: 'calc(100% - 40px)',
      maxWidth: 320,
    }}>
      <div style={{
        borderRadius: s2.rMd,
        background: s2.surface2,
        border: `1px solid ${s2.lineStrong}`,
        padding: '12px 16px',
        fontFamily: s2.sans,
        fontSize: 13,
        color: s2.text,
        textAlign: 'center',
        lineHeight: 1.45,
        letterSpacing: '-0.01em',
      }}>
        {message}
      </div>
    </div>
  );
});

Toast.displayName = 'Toast';
