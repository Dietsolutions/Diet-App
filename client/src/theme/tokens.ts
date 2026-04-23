// Strain v2 design tokens — single source of truth for the warm-dark palette
export const s2 = {
  // Backgrounds
  bg:         '#0C0907',
  bg2:        '#120D0A',
  surface:    '#17110C',
  surface2:   '#1F1812',
  // Borders
  line:       'rgba(255,182,128,0.08)',
  lineStrong: 'rgba(255,182,128,0.18)',
  // Text
  text:       '#F5EFE8',
  textDim:    'rgba(245,239,232,0.55)',
  textDimmer: 'rgba(245,239,232,0.32)',
  // Accent
  accent:     '#FF6A2A',   // molten orange
  accentSoft: '#FFB066',
  accentFill: 'rgba(255,106,42,0.14)',
  warn:       '#FF3E3E',
  // Macro colours (warm-tuned)
  protein:    '#FF6A2A',   // orange  — same as accent
  carbs:      '#C9A3FF',   // lilac
  fat:        '#FFD166',   // amber
  fibre:      '#7CE0C4',   // teal
  // Typography
  sans:       "'Space Grotesk', system-ui, sans-serif",
  mono:       "'IBM Plex Mono', ui-monospace, monospace",
} as const;
