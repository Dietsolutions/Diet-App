// Planyourplate v3 — shell: status bar, scaffold, floating nav, top bar, headers
const { V3Kick, V3H, V3IconBtn } = window;

const V3_ICONS = {
  meals:   'M3 11h18a9 9 0 0 1-18 0z M8 7c0-2 1-3 2-3',
  tracker: 'M4 19V9 M10 19V5 M16 19v-7 M22 19H2',
  shop:    'M5 8h14l-1.2 12H6.2L5 8z M9 8V6a3 3 0 0 1 6 0v2',
  learn:   'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5z M9 8h7',
  recipes: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  profile: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4',
};

window.V3Icon = function V3Icon({ name, size = 20, color = 'currentColor', w = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {V3_ICONS[name].split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d}/>)}
    </svg>
  );
};
const V3Icon = window.V3Icon;

window.V3Status = function V3Status({ dark }) {
  const c = dark ? v3.onDark : v3.text;
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 26px 2px', flexShrink:0 }}>
      <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, color:c, letterSpacing:'-0.01em' }}>9:41</div>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill={c}><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M1 4a9 9 0 0 1 13 0M3.7 6.6a5.4 5.4 0 0 1 7.6 0M6.6 9.2a1.6 1.6 0 0 1 1.8 0"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none"><rect x="0.6" y="0.6" width="20" height="9.8" rx="3" stroke={c} strokeOpacity="0.4"/><rect x="2.4" y="2.4" width="15" height="6.2" rx="1.8" fill={c}/><path d="M22.4 4v3c1-.4 1-2.6 0-3z" fill={c} fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
};
const V3Status = window.V3Status;

window.V3Nav = function V3Nav({ tab, onNav }) {
  const items = [
    { id:'meals', label:'Plan' }, { id:'tracker', label:'Track' }, { id:'recipes', label:'Recipes' },
    { id:'shopping', label:'Shop', icon:'shop' }, { id:'tips', label:'Learn', icon:'learn' }, { id:'profile', label:'You', icon:'profile' },
  ];
  return (
    <div style={{
      position:'absolute', left:10, right:10, bottom:14, background:v3.ink, borderRadius:999,
      padding:6, display:'flex', alignItems:'center', gap:2, boxShadow:'0 18px 40px rgba(15,20,15,0.28)', zIndex:20,
    }}>
      {items.map(it => {
        const on = tab === it.id;
        return (
          <button key={it.id} onClick={() => onNav && onNav(it.id)} style={{
            flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'10px 2px',
            background: on ? v3.lime : 'transparent', color: on ? v3.ink : v3.onDarkDim,
            display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'background 200ms ease-out',
          }}>
            <V3Icon name={it.icon || it.id} size={18} w={on ? 2.1 : 1.8}/>
            <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:700, letterSpacing:'-0.01em' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
};
const V3Nav = window.V3Nav;

// Screen shell. bg = screen background, dark = light content on dark bg, nav = show tab bar
window.V3Scaffold = function V3Scaffold({ children, tab, onNav, bg, dark, nav = true, pad = true, footer }) {
  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background: bg || v3.paper, overflow:'hidden', color: dark ? v3.onDark : v3.text, fontFamily:v3.sans }}>
      <div style={{ position:'absolute', inset:0, overflow:'auto', display:'flex', flexDirection:'column' }}>
        <V3Status dark={dark}/>
        <div style={{ padding: pad ? '0 0 0' : 0, paddingBottom: nav ? 108 : (footer ? 150 : 28) }}>{children}</div>
      </div>
      {footer}
      {nav && <V3Nav tab={tab} onNav={onNav}/>}
    </div>
  );
};

// Greeting header used across tabs
window.V3AppHeader = function V3AppHeader({ hello = 'Good morning', name = 'Harshit', right, dark }) {
  return (
    <div style={{ padding:'16px 22px 0', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:44, height:44, borderRadius:999, background:v3.lime, display:'grid', placeItems:'center', fontFamily:v3.disp, fontSize:18, fontWeight:700, color:v3.ink, flexShrink:0 }}>H</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color: dark ? v3.onDarkDim : v3.dim }}>{hello}</div>
        <div style={{ fontFamily:v3.disp, fontSize:17, fontWeight:700, letterSpacing:'-0.03em', color: dark ? v3.onDark : v3.text }}>{name}</div>
      </div>
      {right}
    </div>
  );
};

// Big screen title block
window.V3Title = function V3Title({ kick, title, right, dark, size = 38, style }) {
  return (
    <div style={{ padding:'18px 22px 0', display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:14, ...style }}>
      <div>
        {kick && <V3Kick color={dark ? v3.onDarkDimmer : v3.dimmer} style={{ marginBottom:8 }}>{kick}</V3Kick>}
        <V3H size={size} color={dark ? v3.onDark : v3.text}>{title}</V3H>
      </div>
      {right}
    </div>
  );
};

// Sheet/flow top bar: back circle + title + right slot
window.V3TopBar = function V3TopBar({ onBack, kick, title, right, dark }) {
  return (
    <div style={{ padding:'12px 22px 0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <V3IconBtn onClick={onBack} bg={dark ? 'rgba(246,247,243,0.10)' : v3.card} color={dark ? v3.onDark : v3.text}>←</V3IconBtn>
        {right}
      </div>
      <div style={{ marginTop:18 }}>
        {kick && <V3Kick color={dark ? v3.onDarkDimmer : v3.dimmer} style={{ marginBottom:8 }}>{kick}</V3Kick>}
        <V3H size={32} color={dark ? v3.onDark : v3.text}>{title}</V3H>
      </div>
    </div>
  );
};

// Section label + optional action
window.V3SectionLabel = function V3SectionLabel({ children, action, dark, style }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', padding:'0 22px', marginBottom:12, ...style }}>
      <V3Kick color={dark ? v3.onDarkDimmer : v3.dimmer}>{children}</V3Kick>
      {action && <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, color:v3.limeDeep, cursor:'pointer' }}>{action}</span>}
    </div>
  );
};

// Onboarding chrome: brand row + segmented progress
window.V3ObHead = function V3ObHead({ step = 1, total = 4, onSkip, dark }) {
  return (
    <div style={{ padding:'12px 22px 0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
          <span style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color: dark ? v3.onDark : v3.text }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, color:v3.limeDeep, letterSpacing:'0.06em' }}>AI</span>
        </div>
        <span onClick={onSkip} style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color: dark ? v3.onDarkDim : v3.dim, cursor:'pointer' }}>Skip</span>
      </div>
      <div style={{ display:'flex', gap:6, marginTop:16 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex:1, height:3, borderRadius:999, background: i < step ? (dark ? v3.lime : v3.ink) : (dark ? v3.lineDark : 'rgba(15,20,15,0.13)') }}/>
        ))}
      </div>
    </div>
  );
};
