// Planyourplate v3 "Fresh" — tokens + atoms
window.v3 = {
  paper:'#F2F1EC', card:'#FFFFFF', cream:'#ECE4D6', ink:'#0F140F', ink2:'#19201A', ink3:'#232C23',
  line:'rgba(15,20,15,0.08)', lineStrong:'rgba(15,20,15,0.18)', lineDark:'rgba(246,247,243,0.12)',
  text:'#0F140F', dim:'rgba(15,20,15,0.56)', dimmer:'rgba(15,20,15,0.34)',
  onDark:'#F6F7F3', onDarkDim:'rgba(246,247,243,0.56)', onDarkDimmer:'rgba(246,247,243,0.32)',
  lime:'#C6F24E', limeDeep:'#9FD62B', limeSoft:'#E9FBB8',
  peach:'#FFC3A2', lilac:'#CBB8F9', mint:'#A9E8BE', butter:'#FFDF8A', sky:'#A9D9F2',
  protein:'#6FB93B', carbs:'#F2B93B', fat:'#FF8A6B', fibre:'#59C7B4', water:'#63B8E8', warn:'#E5484D',
  track:'rgba(15,20,15,0.10)', panelDim:'rgba(15,20,15,0.5)', rMul:1,
  disp:"'Archivo', system-ui, sans-serif",
  sans:"'Plus Jakarta Sans', system-ui, sans-serif",
};
const v3 = window.v3;

// tiny uppercase label
window.V3Kick = function V3Kick({ children, color, style }) {
  return <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color: color || v3.dimmer, ...style }}>{children}</div>;
};

// display headline
window.V3H = function V3H({ children, size = 34, color, weight = 700, style }) {
  return <div style={{ fontFamily:v3.disp, fontSize:size, fontWeight:weight, letterSpacing:'-0.042em', lineHeight:1.02, color: color || v3.text, ...style }}>{children}</div>;
};

// chunky rounded card
window.V3Card = function V3Card({ children, bg, pad = 18, r = 24, onClick, border, style }) {
  return (
    <div onClick={onClick} style={{
      background: bg || v3.card, borderRadius: r * (v3.rMul || 1), padding:pad,
      border: border ? `1px solid ${border}` : '1px solid transparent',
      cursor: onClick ? 'pointer' : 'default', transition:'transform 200ms ease-out',
      ...style,
    }}>{children}</div>
  );
};

// pill chip
window.V3Chip = function V3Chip({ children, bg, color, size = 11, pad = '6px 11px', style }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, background: bg || v3.paper, color: color || v3.text, borderRadius:999, padding:pad, fontFamily:v3.sans, fontSize:size, fontWeight:600, letterSpacing:'-0.01em', whiteSpace:'nowrap', ...style }}>{children}</span>;
};

// pill button
window.V3Btn = function V3Btn({ children, onClick, kind = 'lime', full, small, style }) {
  const map = {
    lime:  { background:v3.lime, color:v3.ink, border:'none' },
    dark:  { background:v3.ink, color:v3.onDark, border:'none' },
    light: { background:v3.card, color:v3.text, border:`1px solid ${v3.lineStrong}` },
    ghost: { background:'transparent', color:v3.dim, border:`1px solid ${v3.lineStrong}` },
    onDark:{ background:'rgba(246,247,243,0.10)', color:v3.onDark, border:`1px solid ${v3.lineDark}` },
    warn:  { background:'transparent', color:v3.warn, border:`1px solid rgba(229,72,77,0.35)` },
  }[kind];
  return (
    <button onClick={onClick} style={{
      ...map, borderRadius:999, padding: small ? '11px 18px' : '16px 24px',
      width: full ? '100%' : 'auto', fontFamily:v3.sans, fontSize: small ? 13 : 15, fontWeight:700,
      letterSpacing:'-0.01em', cursor:'pointer', transition:'opacity 200ms ease-out', ...style,
    }}>{children}</button>
  );
};

// signature onboarding CTA: dark pill, lime circle left, check circle right
window.V3CtaBar = function V3CtaBar({ label = 'Get Started', onClick, onSkip }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, background:v3.ink, borderRadius:999, padding:6, cursor:'pointer' }}>
      <div style={{ width:46, height:46, borderRadius:999, background:v3.lime, display:'grid', placeItems:'center', color:v3.ink, fontFamily:v3.sans, fontSize:15, fontWeight:800 }}>»</div>
      <div style={{ flex:1, textAlign:'center', fontFamily:v3.sans, fontSize:15, fontWeight:700, color:v3.onDark }}>{label}</div>
      <div onClick={onSkip} style={{ width:46, height:46, borderRadius:999, background:v3.card, display:'grid', placeItems:'center', color:v3.ink, fontSize:15, fontWeight:700 }}>✓</div>
    </div>
  );
};

// progress bar (optionally striped, from the dark-deck inspiration)
window.V3Bar = function V3Bar({ pct = 0, color, h = 8, track, striped, r = 999 }) {
  const c = color || v3.limeDeep;
  return (
    <div style={{ height:h, borderRadius:r, background: track || v3.track, overflow:'hidden' }}>
      <div style={{
        width:`${Math.min(1, Math.max(0, pct)) * 100}%`, height:'100%', borderRadius:r,
        background: striped ? `repeating-linear-gradient(115deg, ${c} 0 7px, rgba(255,255,255,0.45) 7px 12px)` : c,
        transition:'width 400ms ease-out',
      }}/>
    </div>
  );
};

// donut gauge
window.V3Ring = function V3Ring({ pct = 0, size = 148, thick = 14, color, track, children, dashRemainder }) {
  const c = color || v3.lime;
  const r = (size - thick) / 2, C = 2 * Math.PI * r;
  return (
    <div style={{ width:size, height:size, position:'relative', flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track || v3.track} strokeWidth={thick}
          strokeDasharray={dashRemainder ? '2 6' : undefined} strokeLinecap={dashRemainder ? 'round' : 'butt'}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={thick} strokeLinecap="round"
          strokeDasharray={`${C * Math.min(1, pct)} ${C}`}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', textAlign:'center' }}>{children}</div>
    </div>
  );
};

// round checkbox
window.V3Check = function V3Check({ on, size = 26, onColor, onClick }) {
  return (
    <div onClick={onClick} style={{
      width:size, height:size, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center',
      background: on ? (onColor || v3.lime) : 'transparent',
      border: on ? 'none' : `1.5px solid ${v3.lineStrong}`,
      color:v3.ink, fontSize: size * 0.5, fontWeight:800, cursor:'pointer',
    }}>{on ? '✓' : ''}</div>
  );
};

// circular icon button
window.V3IconBtn = function V3IconBtn({ children, onClick, bg, color, size = 42, border }) {
  return (
    <button onClick={onClick} style={{
      width:size, height:size, borderRadius:999, background: bg || v3.card, color: color || v3.text,
      border: border || 'none', display:'grid', placeItems:'center', cursor:'pointer',
      fontFamily:v3.sans, fontSize:16, fontWeight:700, flexShrink:0,
    }}>{children}</button>
  );
};

// pastel food placeholder disc
window.V3Food = function V3Food({ size = 52, tint, glyph }) {
  const t = tint || v3.mint;
  return (
    <div style={{ width:size, height:size, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center',
      background:`radial-gradient(circle at 35% 30%, #fff 0%, ${t} 55%, ${t} 100%)`, boxShadow:'inset 0 -4px 10px rgba(15,20,15,0.08)' }}>
      <svg width={size*0.46} height={size*0.46} viewBox="0 0 24 24" fill="none" stroke="rgba(15,20,15,0.55)" strokeWidth="1.7" strokeLinecap="round">
        {glyph === 'leaf' ? <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16zM4 20L14 10"/>
         : glyph === 'drop' ? <path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/>
         : <><path d="M3 11h18a9 9 0 01-18 0z"/><path d="M8 7c0-2 1-3 2-3M13 7c0-3 2-4 3-4"/></>}
      </svg>
    </div>
  );
};

// macro row with colored tick (inspiration: nutrition onboarding card)
window.V3MacroTick = function V3MacroTick({ color, value, label, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:5, height:26, borderRadius:999, background:color }}/>
      <div>
        <div style={{ fontFamily:v3.disp, fontSize:19, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1 }}>
          {value}<span style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.dim, marginLeft:5 }}>{label}</span>
        </div>
        {sub && <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:600, color:v3.dimmer, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
};

// list row: label left, value right
window.V3Row = function V3Row({ label, value, color, last, onClick, chevron }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      padding:'13px 0', borderBottom: last ? 'none' : `1px solid ${v3.line}`, cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim }}>{label}</span>
      <span style={{ display:'flex', alignItems:'center', gap:8, fontFamily:v3.sans, fontSize:13.5, fontWeight:700, color: color || v3.text }}>
        {value}{chevron && <span style={{ color:v3.dimmer, fontWeight:600 }}>→</span>}
      </span>
    </div>
  );
};

Object.assign(window, { v3 });
