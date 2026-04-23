/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Strain v2 base palette ──────────────────────────────────────────
        dark:        '#0C0907',
        bg2:         '#120D0A',
        surface:     '#17110C',
        elevated:    '#1F1812',
        // Warm hairline borders
        border:      'rgba(255,182,128,0.08)',
        'border-strong': 'rgba(255,182,128,0.18)',
        // Text scale
        primary:     '#F5EFE8',
        secondary:   'rgba(245,239,232,0.55)',
        dimmed:      'rgba(245,239,232,0.32)',
        // Accent
        accent:      '#FF6A2A',
        'accent-soft': '#FFB066',
        'accent-fill': 'rgba(255,106,42,0.14)',
        warn:        '#FF3E3E',
        // Macro hues
        protein:     '#FF6A2A',
        carbs:       '#C9A3FF',
        fat:         '#FFD166',
        fibre:       '#7CE0C4',
        // Kept for backward-compat with components not yet redesigned
        success:     '#4CAF82',
        violet:      '#7B6CF6',
        // Fill variants (for className usage)
        'success-fill': 'rgba(76,175,130,0.15)',
        'violet-fill':  'rgba(123,108,246,0.12)',
        'fibre-fill':   'rgba(124,224,196,0.15)',
      },
      fontFamily: {
        // Strain v2 primaries
        sans:    ["'Space Grotesk'", 'system-ui', 'sans-serif'],
        mono:    ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
        // Legacy display font (still used by auth / onboarding)
        display: ['"Fraunces"', '"Playfair Display"', 'serif'],
      },
      maxWidth: {
        app: '480px',
      },
      // Zero border-radius design system — explicit overrides only
      borderRadius: {
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
