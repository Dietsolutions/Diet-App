// Fresh Light design tokens — single source of truth
export const s2 = {
  // ── Surfaces (NOTE: elevation direction is inverted vs the old dark theme) ──
  bg:         '#F2F1EC',   // page background (was the darkest colour; now the *tinted* one)
  bg2:        '#FFFFFF',   // raised from page
  surface:    '#FFFFFF',   // cards
  surface2:   '#F2F1EC',   // nested raise inside a white card
  cream:      '#ECE4D6',   // warm panel — the shopping "people" card (ref: v3.cream)
  ink:        '#0F140F',   // NEW — near-black, for dark cards and dark buttons
  ink2:       '#19201A',
  // ── Borders ──
  line:       'rgba(15,20,15,0.08)',
  lineStrong: 'rgba(15,20,15,0.18)',
  lineDark:   'rgba(246,247,243,0.12)',   // NEW — borders on ink surfaces
  // ── Text ──
  text:       '#0F140F',
  textDim:    'rgba(15,20,15,0.56)',
  textDimmer: 'rgba(15,20,15,0.34)',
  onDark:     '#F6F7F3',                  // NEW — text on ink
  onDarkDim:  'rgba(246,247,243,0.56)',   // NEW
  onDarkDimmer:'rgba(246,247,243,0.32)',  // NEW
  // ── Accent ──
  // Split deliberately. Lime is a FILL colour; it fails contrast as text on white.
  accent:     '#5F8C12',   // accent TEXT and strokes on light surfaces
  accentSoft: '#9FD62B',   // mid lime — chart strokes, secondary accent text
  accentFill: '#C6F24E',   // block fill; always pair with `color: s2.ink`
  accentWash: '#E9FBB8',   // NEW — tinted panel background
  warn:       '#E5484D',
  // ── Pastels (NEW — used for summary cards and category tints) ──
  peach:      '#FFC3A2',
  lilac:      '#CBB8F9',
  mint:       '#A9E8BE',
  butter:     '#FFDF8A',
  sky:        '#A9D9F2',
  // ── Macro colours (retuned for light backgrounds) ──
  protein:    '#6FB93B',
  carbs:      '#F2B93B',
  fat:        '#FF8A6B',
  fibre:      '#59C7B4',
  water:      '#63B8E8',
  // Darker variants for macro TEXT on white — the fills above are too light to read.
  proteinText:'#4A7D22',
  carbsText:  '#B0871C',
  fatText:    '#C4573A',
  fibreText:  '#2F8C7C',
  waterText:  '#1F7FB8',
  // ── Typography ──
  disp:       "'Archivo', system-ui, sans-serif",        // NEW — numerals and headlines
  sans:       "'Plus Jakarta Sans', system-ui, sans-serif",
  mono:       "'Plus Jakarta Sans', system-ui, sans-serif", // repointed; see note
  // ── Radius (NEW — Strain was square, Fresh Light is heavily rounded) ──
  rSm: 12, rMd: 18, rLg: 24, rXl: 32, rPill: 999,
} as const;
