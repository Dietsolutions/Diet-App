// Shared chrome: status bar, tab bar, scaffolding
const s2_ = window.s2;
const { IOSStatusBar: S2Status } = window;

window.S2TabBar = function TabBar({ active, onChange }) {
  const s2 = window.s2;
  const tabs = [
    { id:'meals',    label:'MEALS'  },
    { id:'tracker',  label:'TRACK'  },
    { id:'shopping', label:'SHOP'   },
    { id:'tips',     label:'LEARN'  },
    { id:'profile',  label:'BODY'   },
  ];
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0,
      paddingBottom: 28, paddingTop: 10,
      background:'rgba(12,9,7,0.94)', backdropFilter:'blur(20px)',
      borderTop:`1px solid ${s2.line}`,
      display:'flex', justifyContent:'space-around',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange && onChange(t.id)} style={{
          background:'transparent', border:'none', padding:'6px 8px',
          fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.2em',
          color: active === t.id ? s2.accent : s2.textDimmer, cursor:'pointer',
          position:'relative',
        }}>
          {t.label}
          {active === t.id && <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', width: 16, height: 2, background: s2.accent }}/>}
        </button>
      ))}
    </div>
  );
};

window.S2Scaffold = function Scaffold({ children, tab, onNav, noTabs }) {
  const s2 = window.s2;
  return (
    <div style={{ background: s2.bg, minHeight:'100%', color: s2.text, paddingBottom: noTabs ? 0 : 90, position:'relative' }}>
      <S2Status dark={true} time="7:42"/>
      {children}
      {!noTabs && <window.S2TabBar active={tab} onChange={onNav}/>}
    </div>
  );
};

window.S2SectionTitle = function SectionTitle({ kicker, title, right }) {
  const s2 = window.s2;
  return (
    <div style={{ padding:'14px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
      <div>
        {kicker && <window.s2HairLabel>{kicker}</window.s2HairLabel>}
        <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 400, letterSpacing:'-0.025em', marginTop: 4, lineHeight: 1 }}>{title}</div>
      </div>
      {right}
    </div>
  );
};

// Placeholder image block used throughout (subtle stripes + mono caption)
window.S2Placeholder = function Placeholder({ h = 140, label = 'IMG' }) {
  const s2 = window.s2;
  return (
    <div style={{
      height: h, background: s2.surface2, border:`1px solid ${s2.line}`,
      position:'relative', overflow:'hidden',
    }}>
      <svg width="100%" height="100%" style={{ position:'absolute', inset:0 }}>
        <defs>
          <pattern id="stripesS2" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,182,128,0.06)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#stripesS2)"/>
      </svg>
      <div style={{ position:'absolute', bottom: 10, left: 12, fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing:'0.2em' }}>
        {label}
      </div>
    </div>
  );
};

// Horizontal bar (0..1)
window.S2Bar = function Bar({ pct, color, h = 2, bg }) {
  const s2 = window.s2;
  return (
    <div style={{ height: h, background: bg || s2.line, position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, height:'100%', width:`${Math.max(0, Math.min(100, pct*100))}%`, background: color || s2.accent }}/>
    </div>
  );
};

// Vertical bar for macros
window.S2VBar = function VBar({ pct, color, h = 80 }) {
  const s2 = window.s2;
  return (
    <div style={{ width: 10, height: h, background: s2.line, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${Math.min(100, Math.max(0, pct*100))}%`, background: color || s2.accent }}/>
    </div>
  );
};

// Checkbox-square
window.S2Check = function Check({ on, color, size = 14 }) {
  const s2 = window.s2;
  const c = color || s2.accent;
  return (
    <div style={{ width: size, height: size, border:`1px solid ${on ? c : s2.lineStrong}`, background: on ? c : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
      {on && <svg width={size-4} height={size-4} viewBox="0 0 10 10"><path d="M1.5 5 L4 7.5 L8.5 2.5" stroke="#0C0907" strokeWidth="1.8" fill="none" strokeLinecap="square"/></svg>}
    </div>
  );
};

// Row card used heavily
window.S2Card = function Card({ children, padding = 16, onClick, hover, style }) {
  const s2 = window.s2;
  return (
    <div onClick={onClick} style={{
      background: s2.surface, border:`1px solid ${s2.line}`, padding,
      cursor: onClick ? 'pointer' : 'default',
      transition:'border-color 180ms',
      ...style,
    }}>{children}</div>
  );
};
