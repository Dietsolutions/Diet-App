// Strain v2 design tokens
window.s2 = {
  bg:       '#0C0907',
  bg2:      '#120D0A',
  surface:  '#17110C',
  surface2: '#1F1812',
  line:     'rgba(255,182,128,0.08)',
  lineStrong:'rgba(255,182,128,0.18)',
  text:     '#F5EFE8',
  textDim:  'rgba(245,239,232,0.55)',
  textDimmer:'rgba(245,239,232,0.32)',
  // accents
  accent:   '#FF6A2A',   // molten orange
  accentSoft:'#FFB066',
  accentFill:'rgba(255,106,42,0.14)',
  warn:     '#FF3E3E',
  // macro hues (warm-tuned)
  protein:  '#FF6A2A',   // orange
  carbs:    '#C9A3FF',   // lilac
  fat:      '#FFD166',   // amber
  fibre:    '#7CE0C4',   // teal
  sans:     "'Space Grotesk', system-ui, sans-serif",
  mono:     "'IBM Plex Mono', ui-monospace, monospace",
};

// Shared atoms
window.s2HairLabel = function HairLabel({ children, style, color }) {
  const s2 = window.s2;
  return <div style={{
    fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em',
    color: color || s2.textDimmer, fontWeight: 500, textTransform: 'uppercase',
    ...style,
  }}>{children}</div>;
};

window.s2DataRow = function DataRow({ label, value, accent, unit, last }) {
  const s2 = window.s2;
  return (
    <div style={{
      display:'flex', alignItems:'baseline', justifyContent:'space-between',
      padding:'11px 0', borderBottom: last ? 'none' : `1px solid ${s2.line}`,
    }}>
      <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.textDimmer, fontWeight: 500, textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontFamily: s2.mono, fontSize: 13, fontWeight: 500, color: accent || s2.text, letterSpacing:'-0.01em' }}>
        {value}{unit && <span style={{ color: s2.textDim, marginLeft: 3, fontSize: 10 }}>{unit}</span>}
      </div>
    </div>
  );
};

window.s2Pill = function Pill({ children, color, filled }) {
  const s2 = window.s2;
  return <span style={{
    display:'inline-block',
    fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', fontWeight: 600,
    color: filled ? '#0C0907' : (color || s2.text),
    background: filled ? (color || s2.accent) : 'transparent',
    border: filled ? 'none' : `1px solid ${color || s2.lineStrong}`,
    padding:'3px 7px', textTransform:'uppercase',
  }}>{children}</span>;
};

window.s2Btn = function Btn({ children, primary, onClick, full, small, style }) {
  const s2 = window.s2;
  return (
    <button onClick={onClick} style={{
      cursor:'pointer', border: primary ? 'none' : `1px solid ${s2.lineStrong}`,
      background: primary ? s2.accent : 'transparent',
      color: primary ? '#0C0907' : s2.text,
      padding: small ? '10px 14px' : '15px 20px',
      width: full ? '100%' : 'auto',
      fontFamily: s2.mono, fontSize: small ? 10 : 11, fontWeight: 600, letterSpacing:'0.2em',
      textTransform:'uppercase',
      ...style,
    }}>{children}</button>
  );
};
