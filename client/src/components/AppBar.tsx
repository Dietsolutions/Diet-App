// AppBar — Strain v2: minimal status-bar safe-area spacer.
// The Strain v2 design has each screen build its own section header inline.
// This component just ensures content isn't hidden under the iOS status bar.

import { s2 } from '../theme/tokens';

interface AppBarProps {
  title: string;
}

export function AppBar({ title: _title }: AppBarProps) {
  return (
    <div style={{
      background: s2.bg,
      height: 'env(safe-area-inset-top, 0px)',
      flexShrink: 0,
    }} />
  );
}
