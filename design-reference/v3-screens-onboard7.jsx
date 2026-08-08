// v3 — onboarding, 5 steps. Every OnboardingData field present; long lists searchable.
// Options verbatim from data/onboarding.ts + Onboarding.tsx (see v3-onboard-data.jsx).
// Deliberate deviation: app ships 7 steps; condensed to 5 at user request. No inputs dropped.
const { V3Scaffold, V3ObHead, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3CtaBar, V3IconBtn, V3Row } = window;
const V3_OB_TOTAL = 5;
window.V3ObGen = window.V3OB5; // light "generating" screen from v3-screens-light.jsx
const OB = window.V3OB;

function V3ObShell({ step, title, sub, children, onNext, onNav, cta = 'Continue', slide }) {
  return (
    <V3Scaffold nav={false}>
      <V3ObHead step={step} total={V3_OB_TOTAL} onSkip={() => onNav && onNav('meals')}/>
      <div style={{ padding:'26px 22px 0' }}>
        <V3Kick>Step {step} of {V3_OB_TOTAL}</V3Kick>
        <V3H size={34} style={{ marginTop:10 }}>{title}</V3H>
        {sub && <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, marginTop:11, lineHeight:1.6 }}>{sub}</div>}
      </div>
      <div style={{ padding:'20px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>{children}</div>
      <div style={{ padding:'20px 22px 0' }}>
        {slide ? <V3CtaBar label={cta} onClick={onNext}/> : <V3Btn kind="dark" full onClick={onNext}>{cta}</V3Btn>}
      </div>
    </V3Scaffold>
  );
}

// search input
function V3Search({ value, onChange, placeholder }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, background:v3.paper, borderRadius:999, padding:'11px 15px', marginBottom:12 }}>
      <span style={{ fontSize:13, color:'#5F8C12' }}>⌕</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        flex:1, background:'transparent', border:'none', outline:'none',
        fontFamily:v3.sans, fontSize:13.5, fontWeight:600, color:v3.text, minWidth:0,
      }}/>
      {value && <button onClick={() => onChange('')} style={{ background:'none', border:'none', cursor:'pointer', color:v3.dimmer, fontSize:15, padding:0, lineHeight:1 }}>×</button>}
    </div>
  );
}

// searchable multi-select chip group
function V3PickGroup({ label, sub, options, list, set, tint, icons, searchable, placeholder, single, other }) {
  const [q, setQ] = React.useState('');
  const shown = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = v => single ? set([v]) : set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  return (
    <V3Card r={26} pad={18}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: sub ? 6 : 12 }}>
        <V3Kick>{label}</V3Kick>
        {list.length > 0 && <V3Kick color="#5F8C12">{list.length} selected</V3Kick>}
      </div>
      {sub && <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:v3.dimmer, marginBottom:12 }}>{sub}</div>}
      {searchable && <V3Search value={q} onChange={setQ} placeholder={placeholder || `Search ${label.toLowerCase()}…`}/>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, maxHeight: searchable ? 210 : undefined, overflowY: searchable ? 'auto' : undefined }}>
        {shown.map(o => {
          const on = list.includes(o);
          return (
            <button key={o} onClick={() => toggle(o)} style={{
              border:'none', cursor:'pointer', borderRadius:999, padding:'10px 14px',
              background: on ? (tint || v3.lime) : v3.paper, color:v3.text,
              fontFamily:v3.sans, fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', gap:6,
            }}>{icons && icons[o] ? <span>{icons[o]}</span> : null}{on ? '✓ ' : ''}{o}</button>
          );
        })}
        {shown.length === 0 && <V3Kick style={{ padding:'8px 0' }}>No matches for “{q}”</V3Kick>}
      </div>
      {other && <V3OtherInput label={other}/>}
    </V3Card>
  );
}

// free-text “not listed” input — backs allergyOther / avoidOther
function V3OtherInput({ label, top }) {
  const [val, setVal] = React.useState('');
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, borderTop:`1px solid ${v3.line}`, paddingTop:13, marginTop: top ? 2 : 13 }}>
      <span style={{ fontSize:13, color: val ? '#5F8C12' : v3.dimmer, fontWeight:700 }}>+</span>
      <input value={val} onChange={e => setVal(e.target.value)} placeholder={label} style={{
        flex:1, background:'transparent', border:'none', outline:'none', minWidth:0,
        fontFamily:v3.sans, fontSize:13, fontWeight:600, color:v3.text,
      }}/>
      {val && <button onClick={() => setVal('')} style={{ background:'none', border:'none', cursor:'pointer', color:v3.dimmer, fontSize:15, padding:0, lineHeight:1 }}>×</button>}
    </div>
  );
}

// compact searchable select — shows the chosen value; results list appears while typing
function V3PickOne({ label, options, value, set, placeholder }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const shown = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  return (
    <V3Card r={24} pad={16}>
      <V3Kick style={{ marginBottom:10 }}>{label}</V3Kick>
      {/* current value / search field */}
      <div style={{ display:'flex', alignItems:'center', gap:9, background:v3.paper, borderRadius:16, padding:'13px 15px' }}>
        <span style={{ fontSize:13, color:'#5F8C12' }}>⌕</span>
        <input
          value={open ? q : value}
          onFocus={() => { setOpen(true); setQ(''); }}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ flex:1, background:'transparent', border:'none', outline:'none', minWidth:0,
            fontFamily:v3.sans, fontSize:14, fontWeight:600, color: open ? v3.text : v3.text }}
        />
        {open
          ? <button onClick={() => { setOpen(false); setQ(''); }} style={{ background:'none', border:'none', cursor:'pointer', color:v3.dimmer, fontSize:15, padding:0, lineHeight:1 }}>×</button>
          : <span style={{ color:v3.dimmer, fontSize:11, fontWeight:700 }}>▾</span>}
      </div>
      {/* results */}
      {open && q.length > 0 && (
        <div style={{ marginTop:9, border:`1px solid ${v3.line}`, borderRadius:14, overflow:'hidden' }}>
          {shown.map((o, i) => (
            <button key={o} onClick={() => { set(o); setOpen(false); setQ(''); }} style={{
              display:'block', width:'100%', textAlign:'left', cursor:'pointer', border:'none',
              padding:'12px 15px', background: value === o ? v3.limeSoft : v3.card,
              borderTop: i ? `1px solid ${v3.line}` : 'none',
              fontFamily:v3.sans, fontSize:13.5, fontWeight:600, color:v3.text,
            }}>{value === o ? '✓ ' : ''}{o}</button>
          ))}
          {shown.length === 0 && <div style={{ padding:'14px 15px' }}><V3Kick>No matches for “{q}”</V3Kick></div>}
        </div>
      )}
      {open && q.length === 0 && (
        <div style={{ marginTop:9 }}><V3Kick>Type to search {options.length} options</V3Kick></div>
      )}
    </V3Card>
  );
}

// option cards with description
function V3OptCards({ label, options, value, set, cols = 1 }) {
  return (
    <V3Card r={26} pad={18}>
      <V3Kick style={{ marginBottom:12 }}>{label}</V3Kick>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:8 }}>
        {options.map(o => {
          const on = value === o.val;
          return (
            <button key={o.val} onClick={() => set(o.val)} style={{
              border:'none', cursor:'pointer', borderRadius:18, padding:'13px 15px', textAlign:'left',
              background: on ? v3.lime : v3.paper,
            }}>
              <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:700 }}>{o.label}{o.sub && <span style={{ fontWeight:600, color: on ? v3.panelDim : v3.dimmer, marginLeft:7 }}>{o.sub}</span>}</div>
              {o.desc && <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, color: on ? 'rgba(15,20,15,0.62)' : v3.dimmer, marginTop:4, lineHeight:1.45 }}>{o.desc}</div>}
            </button>
          );
        })}
      </div>
    </V3Card>
  );
}

function V3Seg({ label, options, value, set }) {
  return (
    <V3Card r={24} pad={16}>
      <V3Kick style={{ marginBottom:12 }}>{label}</V3Kick>
      <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
        {options.map(o => (
          <button key={o.val} onClick={() => set(o.val)} style={{
            flex:'1 1 auto', minWidth:64, border:'none', cursor:'pointer', borderRadius:999, padding:'11px 10px',
            background: value === o.val ? v3.ink : v3.paper, color: value === o.val ? v3.lime : v3.dim,
            fontFamily:v3.sans, fontSize:11.5, fontWeight:700,
          }}>
            {o.label}
            {o.sub && <div style={{ fontSize:9, fontWeight:600, marginTop:3, opacity:0.8 }}>{o.sub}</div>}
          </button>
        ))}
      </div>
    </V3Card>
  );
}

function V3Stepper({ label, val, unit, onDec, onInc, sub }) {
  return (
    <V3Card r={24} pad={16}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <V3Kick>{label}</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:27, fontWeight:700, letterSpacing:'-0.04em', marginTop:7 }}>
            {val}<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginLeft:4 }}>{unit}</span>
          </div>
          {sub && <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.dimmer, marginTop:4 }}>{sub}</div>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <V3IconBtn bg={v3.paper} size={38} onClick={onDec}>−</V3IconBtn>
          <V3IconBtn bg={v3.lime} size={38} onClick={onInc}>+</V3IconBtn>
        </div>
      </div>
    </V3Card>
  );
}

function V3TextField({ label, placeholder, value }) {
  return (
    <V3Card r={24} pad={16}>
      <V3Kick style={{ marginBottom:10 }}>{label}</V3Kick>
      <div style={{ background:v3.paper, borderRadius:16, padding:'13px 16px', fontFamily:v3.sans, fontSize:14, fontWeight:600, color: value ? v3.text : v3.dimmer }}>
        {value || placeholder}
      </div>
    </V3Card>
  );
}

// ── 1 · About you (personal + body) ──────────────────────────
window.V3OB1 = function V3OB1({ onNav }) {
  const [v, setV] = React.useState({ age:29, weight:72, height:176, target:68 });
  const [gender, setGender] = React.useState('male');
  const [country, setCountry] = React.useState('India');
  const [city, setCity] = React.useState('Bengaluru');
  const CITIES = ['Bengaluru','Mumbai','Delhi','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Jaipur','Kochi'];
  const set = (k, d) => setV(s => ({ ...s, [k]: s[k] + d }));
  return (
    <V3ObShell step={1} onNav={onNav} onNext={() => onNav && onNav('ob2')}
      title="About you" sub="Your body and location set your calorie targets and the cuisines we plan around.">
      <V3TextField label="Name" value="Harshit" placeholder="Your name"/>
      <V3Stepper label="Age" val={v.age} unit="years" onDec={() => set('age', -1)} onInc={() => set('age', 1)}/>
      <V3Seg label="Gender" options={OB.GENDER} value={gender} set={setGender}/>
      <V3PickOne label="Country" options={OB.COUNTRIES} value={country} set={setCountry} placeholder="Search 56 countries…"/>
      <V3PickOne label="City" options={CITIES} value={city} set={setCity} placeholder="Search your city…"/>
      <V3Stepper label="Current weight" val={v.weight} unit="kg" onDec={() => set('weight', -1)} onInc={() => set('weight', 1)}/>
      <V3Stepper label="Height" val={v.height} unit="cm" onDec={() => set('height', -1)} onInc={() => set('height', 1)}/>
      <V3Stepper label="Target weight" val={v.target} unit="kg" sub="Optional — leave as-is for non-weight goals" onDec={() => set('target', -1)} onInc={() => set('target', 1)}/>
    </V3ObShell>
  );
};

// ── 2 · How you eat (diet + eating window + allergies) ───────
window.V3OB2 = function V3OB2({ onNav }) {
  const [pref, setPref] = React.useState('non_vegetarian');
  const [cuisines, setCuisines] = React.useState(['South Indian','Punjabi']);
  const [meals, setMeals] = React.useState(4);
  const [win, setWin] = React.useState('16:8');
  const [allergies, setAllergies] = React.useState(['Peanuts']);
  const [region, setRegion] = React.useState('All');
  const regions = ['All', ...Array.from(new Set(OB.CUISINE_OPTIONS.map(c => c[1])))];
  const cuisineList = OB.CUISINE_OPTIONS.filter(c => region === 'All' || c[1] === region).map(c => c[0]);
  const WINDOWS = [{ val:'none', label:'None' },{ val:'12:12', label:'12:12' },{ val:'16:8', label:'16:8' },{ val:'20:4', label:'20:4' },{ val:'custom', label:'Custom' }];
  return (
    <V3ObShell step={2} onNav={onNav} onNext={() => onNav && onNav('ob3')}
      title={<>How do<br/>you eat?</>} sub="Allergies are hard-excluded from every meal and the shopping list.">
      <V3Seg label="Meal preference" options={OB.MEAL_PREFERENCE} value={pref} set={setPref}/>

      {/* cuisines — region filter + search, all 57 */}
      <V3Card r={26} pad={18}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <V3Kick>Cuisines you love</V3Kick>
          <V3Kick color="#5F8C12">{cuisines.length} of {OB.CUISINE_OPTIONS.length}</V3Kick>
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:12 }}>
          {regions.map(r => (
            <button key={r} onClick={() => setRegion(r)} style={{
              flexShrink:0, border:'none', cursor:'pointer', borderRadius:999, padding:'7px 12px',
              background: region === r ? v3.ink : v3.paper, color: region === r ? v3.lime : v3.dim,
              fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
            }}>{r}</button>
          ))}
        </div>
        <V3PickGroupInner options={cuisineList} list={cuisines} set={setCuisines} tint={v3.mint} placeholder="Search cuisines…"/>
      </V3Card>

      <V3Stepper label="Meals per day" val={meals} unit={meals === 1 ? 'meal' : 'meals'} sub="Includes snacks"
        onDec={() => setMeals(m => Math.max(2, m - 1))} onInc={() => setMeals(m => Math.min(6, m + 1))}/>

      {/* eating window incl. custom start/end */}
      <V3Card r={24} pad={16}>
        <V3Kick style={{ marginBottom:12 }}>Eating window</V3Kick>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {WINDOWS.map(o => (
            <button key={o.val} onClick={() => setWin(o.val)} style={{
              flex:'1 1 auto', minWidth:62, border:'none', cursor:'pointer', borderRadius:999, padding:'11px 10px',
              background: win === o.val ? v3.ink : v3.paper, color: win === o.val ? v3.lime : v3.dim,
              fontFamily:v3.sans, fontSize:11.5, fontWeight:700,
            }}>{o.label}</button>
          ))}
        </div>
        {win === 'custom' && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${v3.line}` }}>
            <V3Row label="Eating starts" value="10:00" chevron/>
            <V3Row label="Eating ends" value="18:00" chevron/>
            <V3Row label="Eating window" value="8 hours"/>
            <V3Row label="Fasting window" value="16 hours" last/>
          </div>
        )}
        {win !== 'custom' && win !== 'none' && (
          <div style={{ marginTop:12, fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:v3.dimmer }}>
            {win === '12:12' ? '12 h eating · 12 h fasting' : win === '16:8' ? '8 h eating · 16 h fasting' : '4 h eating · 20 h fasting'}
          </div>
        )}
      </V3Card>

      <V3PickGroup label="Allergies" options={OB.ALLERGENS} list={allergies} set={setAllergies}
        tint="rgba(229,72,77,0.28)" icons={OB.ALLERGEN_ICONS} searchable placeholder="Search allergens…" other="Not listed? Add your own allergy"/>
      {allergies.length > 0 && (
        <V3Card bg="rgba(229,72,77,0.10)" r={24} pad={16}>
          <div style={{ display:'flex', gap:11, alignItems:'center' }}>
            <div style={{ width:22, height:22, borderRadius:999, background:v3.warn, color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>!</div>
            <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:600, color:v3.text, lineHeight:1.5 }}>
              {allergies.join(', ')} will never appear in your plan.
            </div>
          </div>
        </V3Card>
      )}
    </V3ObShell>
  );
};

// inner chip grid used by the cuisine card (search + scroll, no outer card)
function V3PickGroupInner({ options, list, set, tint, placeholder }) {
  const [q, setQ] = React.useState('');
  const shown = q ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = v => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  return (
    <>
      <V3Search value={q} onChange={setQ} placeholder={placeholder}/>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, maxHeight:200, overflowY:'auto' }}>
        {shown.map(o => {
          const on = list.includes(o);
          return (
            <button key={o} onClick={() => toggle(o)} style={{
              border:'none', cursor:'pointer', borderRadius:999, padding:'10px 14px',
              background: on ? (tint || v3.lime) : v3.paper, color:v3.text,
              fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
            }}>{on ? '✓ ' : ''}{o}</button>
          );
        })}
        {shown.length === 0 && <V3Kick style={{ padding:'8px 0' }}>No matches for “{q}”</V3Kick>}
      </div>
    </>
  );
}

// ── 3 · Foods you love (all 6 categories) ────────────────────
window.V3OB3 = function V3OB3({ onNav }) {
  const [love, setLove] = React.useState(['Chicken','Paneer','Spinach','Curd/Yogurt','Oats','Banana']);
  const [q, setQ] = React.useState('');
  const cats = OB.INGREDIENT_CATEGORIES.map(c => ({ ...c, items: q ? c.items.filter(i => i.toLowerCase().includes(q.toLowerCase())) : c.items })).filter(c => c.items.length);
  const total = OB.INGREDIENT_CATEGORIES.reduce((a, c) => a + c.items.length, 0);
  const toggle = v => setLove(l => l.includes(v) ? l.filter(x => x !== v) : [...l, v]);
  const tints = [v3.peach, v3.mint, '#FFD9E8', v3.butter, v3.sky, v3.lilac];
  return (
    <V3ObShell step={3} onNav={onNav} onNext={() => onNav && onNav('ob4')}
      title={<>Foods you<br/>love</>} sub={`We lean on these when building your meals. ${total} ingredients across 6 groups.`}>
      <V3Card r={26} pad={18}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <V3Kick>Search all ingredients</V3Kick>
          <V3Kick color="#5F8C12">{love.length} selected</V3Kick>
        </div>
        <V3Search value={q} onChange={setQ} placeholder="Search chicken, paneer, berries…"/>
      </V3Card>
      {cats.map((c, i) => (
        <V3Card key={c.name} r={26} pad={18}>
          <V3Kick style={{ marginBottom:12 }}>{c.name}</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {c.items.map(o => {
              const on = love.includes(o);
              return (
                <button key={o} onClick={() => toggle(o)} style={{
                  border:'none', cursor:'pointer', borderRadius:999, padding:'10px 14px',
                  background: on ? tints[i % tints.length] : v3.paper, color:v3.text,
                  fontFamily:v3.sans, fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', gap:6,
                }}>{OB.INGREDIENT_ICONS[o] && <span>{OB.INGREDIENT_ICONS[o]}</span>}{on ? '✓ ' : ''}{o}</button>
              );
            })}
          </div>
        </V3Card>
      ))}
      {cats.length === 0 && <V3Card r={26} pad={20}><V3Kick>No ingredients match “{q}”</V3Kick></V3Card>}
    </V3ObShell>
  );
};

// ── 4 · Foods to avoid (own step, categorised + search) ──────
window.V3OB4 = function V3OB4({ onNav }) {
  const [avoid, setAvoid] = React.useState(['Mushroom']);
  const [none, setNone] = React.useState(false);
  const [q, setQ] = React.useState('');
  const cats = OB.INGREDIENT_CATEGORIES.map(c => ({ ...c, items: q ? c.items.filter(i => i.toLowerCase().includes(q.toLowerCase())) : c.items })).filter(c => c.items.length);
  const toggle = v => { setNone(false); setAvoid(l => l.includes(v) ? l.filter(x => x !== v) : [...l, v]); };
  return (
    <V3ObShell step={4} onNav={onNav} onNext={() => onNav && onNav('ob5')}
      title={<>Foods you’d<br/>rather skip</>} sub="Not allergies — just foods you don’t enjoy. We’ll plan around them.">
      <V3Card r={26} pad={18}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <V3Kick>Search all ingredients</V3Kick>
          <V3Kick color="#B3492C">{none ? 'None' : `${avoid.length} avoided`}</V3Kick>
        </div>
        <V3Search value={q} onChange={setQ} placeholder="Search brinjal, mushroom, liver…"/>
        <V3OtherInput label="Not listed? Add your own" top/>
      </V3Card>

      <button onClick={() => { setNone(n => !n); if (!none) setAvoid([]); }} style={{
        border:`1.5px ${none ? 'solid' : 'dashed'} ${none ? '#5F8C12' : v3.lineStrong}`, cursor:'pointer',
        borderRadius:20, padding:'14px 16px', background: none ? v3.limeSoft : 'transparent',
        fontFamily:v3.sans, fontSize:12.5, fontWeight:700, color: none ? '#5F8C12' : v3.dim,
      }}>{none ? '✓ Nothing to avoid' : 'Nothing to avoid — skip this step'}</button>

      {!none && cats.map((c, i) => (
        <V3Card key={c.name} r={26} pad={18}>
          <V3Kick style={{ marginBottom:12 }}>{c.name}</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {c.items.map(o => {
              const on = avoid.includes(o);
              return (
                <button key={o} onClick={() => toggle(o)} style={{
                  border:'none', cursor:'pointer', borderRadius:999, padding:'10px 14px',
                  background: on ? v3.peach : v3.paper, color:v3.text,
                  fontFamily:v3.sans, fontSize:12.5, fontWeight:700, display:'flex', alignItems:'center', gap:6,
                }}>{OB.INGREDIENT_ICONS[o] && <span>{OB.INGREDIENT_ICONS[o]}</span>}{on ? '✕ ' : ''}{o}</button>
              );
            })}
          </div>
        </V3Card>
      ))}
    </V3ObShell>
  );
};

// ── 5 · Goals & routine ──────────────────────────────────────
// Length is controlled by structure, not by cutting inputs: collapsible groups with
// live summaries, one card of compact row-scales, and paired steppers.

// collapsible group with a summary line when closed
function V3Fold({ label, summary, open, onToggle, children }) {
  return (
    <V3Card r={26} pad={0} style={{ overflow:'hidden' }}>
      <button onClick={onToggle} style={{
        width:'100%', display:'flex', alignItems:'center', gap:12, padding:'15px 17px',
        background: open ? v3.limeSoft : 'transparent', border:'none', cursor:'pointer', textAlign:'left',
      }}>
        <div style={{ flex:1, minWidth:0 }}>
          <V3Kick color={open ? '#5F8C12' : v3.dimmer}>{label}</V3Kick>
          {!open && <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:600, color:v3.text, marginTop:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{summary}</div>}
        </div>
        <span style={{ color: open ? v3.ink : v3.dimmer, fontSize:12, fontWeight:700, transform: open ? 'rotate(90deg)' : 'none', transition:'transform 200ms', flexShrink:0 }}>›</span>
      </button>
      {open && <div style={{ padding:'4px 17px 17px', display:'flex', flexDirection:'column', gap:14 }}>{children}</div>}
    </V3Card>
  );
}

// label left, 3–4 tiny pills right — one row instead of a whole card
function V3RowScale({ label, options, value, set }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
      <V3Kick style={{ flexShrink:0 }}>{label}</V3Kick>
      <div style={{ display:'flex', gap:5 }}>
        {options.map(o => (
          <button key={o.val} onClick={() => set(o.val)} title={o.sub || ''} style={{
            border:'none', cursor:'pointer', borderRadius:999, padding:'7px 12px',
            background: value === o.val ? v3.ink : v3.paper, color: value === o.val ? v3.lime : v3.dim,
            fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.04em', whiteSpace:'nowrap',
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// two steppers side by side
function V3MiniStep({ label, val, unit, onDec, onInc }) {
  return (
    <div style={{ flex:1, background:v3.paper, borderRadius:18, padding:'12px 13px' }}>
      <V3Kick style={{ fontSize:8 }}>{label}</V3Kick>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, gap:6 }}>
        <V3IconBtn bg={v3.card} size={30} onClick={onDec}>−</V3IconBtn>
        <div style={{ textAlign:'center', minWidth:0 }}>
          <div style={{ fontFamily:v3.disp, fontSize:19, fontWeight:700, letterSpacing:'-0.035em', lineHeight:1 }}>{val}</div>
          <div style={{ fontFamily:v3.sans, fontSize:8, fontWeight:700, color:v3.dimmer, marginTop:3, letterSpacing:'0.06em', textTransform:'uppercase' }}>{unit}</div>
        </div>
        <V3IconBtn bg={v3.lime} size={30} onClick={onInc}>+</V3IconBtn>
      </div>
    </div>
  );
}

// compact option list inside a fold (no nested card)
function V3FoldOpts({ label, options, value, set }) {
  return (
    <div>
      <V3Kick style={{ marginBottom:9 }}>{label}</V3Kick>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {options.map(o => {
          const on = value === o.val;
          return (
            <button key={o.val} onClick={() => set(o.val)} style={{
              border:'none', cursor:'pointer', borderRadius:16, padding:'11px 14px', textAlign:'left',
              background: on ? v3.lime : v3.paper,
            }}>
              <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:700 }}>{o.label}</div>
              {o.desc && <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:500, color: on ? 'rgba(15,20,15,0.62)' : v3.dimmer, marginTop:3 }}>{o.desc}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function V3FoldChips({ label, options, list, set, tint, icons }) {
  const toggle = v => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  return (
    <div>
      <V3Kick style={{ marginBottom:9 }}>{label}</V3Kick>
      <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
        {options.map(o => {
          const on = list.includes(o);
          return (
            <button key={o} onClick={() => toggle(o)} style={{
              border:'none', cursor:'pointer', borderRadius:999, padding:'9px 13px',
              background: on ? (tint || v3.lime) : v3.paper, color:v3.text,
              fontFamily:v3.sans, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5,
            }}>{icons && icons[o] ? <span>{icons[o]}</span> : null}{on ? '✓ ' : ''}{o}</button>
          );
        })}
      </div>
    </div>
  );
}

window.V3OB5 = function V3OB5({ onNav }) {
  const [open, setOpen] = React.useState('goal');
  const fold = k => setOpen(o => o === k ? '' : k);
  const [goal, setGoal] = React.useState('lose_weight');
  const [intensity, setIntensity] = React.useState('high');
  const [activity, setActivity] = React.useState('moderately_active');
  const [training, setTraining] = React.useState('mixed');
  const [occupation, setOccupation] = React.useState('desk_job');
  const [cooking, setCooking] = React.useState('home');
  const [insulin, setInsulin] = React.useState('average');
  const [sleepQ, setSleepQ] = React.useState('average');
  const [stress, setStress] = React.useState('medium');
  const [recovery, setRecovery] = React.useState('average');
  const [hunger, setHunger] = React.useState('medium');
  const [energy, setEnergy] = React.useState('moderate');
  const [conditions, setConditions] = React.useState(['None']);
  const [equipment, setEquipment] = React.useState(['Stovetop','Blender']);
  const [days, setDays] = React.useState(4);
  const [mins, setMins] = React.useState(60);
  const [cardio, setCardio] = React.useState(2);
  const [steps, setSteps] = React.useState(8000);
  const [water, setWater] = React.useState(10);
  const [duration, setDuration] = React.useState(14);

  const lbl = (arr, v) => (arr.find(o => o.val === v) || {}).label || '';
  const generic = OB.GOALS.find(g => g.val === goal)?.generic;

  return (
    <V3ObShell step={5} onNav={onNav} onNext={() => onNav && onNav('obGen')} cta="Build my plan" slide
      title={<>Your goal<br/>and routine</>} sub="Four groups. Open one at a time — everything is remembered.">

      {/* 1 · Goal */}
      <V3Fold label="Goal" open={open === 'goal'} onToggle={() => fold('goal')}
        summary={`${lbl(OB.GOALS, goal)}${generic ? '' : ' · ' + lbl(OB.INTENSITY, intensity)}`}>
        <V3FoldOpts label="Primary goal" options={OB.GOALS} value={goal} set={setGoal}/>
        {!generic && <V3RowScale label="Intensity" options={OB.INTENSITY} value={intensity} set={setIntensity}/>}
      </V3Fold>

      {/* 2 · Activity & training */}
      <V3Fold label="Activity & training" open={open === 'train'} onToggle={() => fold('train')}
        summary={`${lbl(OB.ACTIVITY, activity)} · ${lbl(OB.TRAINING_TYPES, training)} · ${days} days/wk`}>
        <V3FoldOpts label="Activity level" options={OB.ACTIVITY} value={activity} set={setActivity}/>
        <V3FoldOpts label="Training type" options={OB.TRAINING_TYPES} value={training} set={setTraining}/>
        <div style={{ display:'flex', gap:8 }}>
          <V3MiniStep label="Days / week" val={days} unit="days" onDec={() => setDays(d => Math.max(0, d - 1))} onInc={() => setDays(d => Math.min(7, d + 1))}/>
          <V3MiniStep label="Session" val={mins} unit="min" onDec={() => setMins(m => Math.max(15, m - 15))} onInc={() => setMins(m => Math.min(180, m + 15))}/>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <V3MiniStep label="Cardio / week" val={cardio} unit="sessions" onDec={() => setCardio(c => Math.max(0, c - 1))} onInc={() => setCardio(c => Math.min(7, c + 1))}/>
          <V3MiniStep label="Daily steps" val={(steps / 1000) + 'k'} unit="steps" onDec={() => setSteps(x => Math.max(1000, x - 1000))} onInc={() => setSteps(x => Math.min(30000, x + 1000))}/>
        </div>
        <V3FoldOpts label="Occupation" options={OB.OCCUPATION} value={occupation} set={setOccupation}/>
      </V3Fold>

      {/* 3 · Body signals — five scales as rows in one card */}
      <V3Fold label="Body signals" open={open === 'body'} onToggle={() => fold('body')}
        summary={`Sleep ${lbl(OB.SLEEP_QUALITY, sleepQ)} · Stress ${lbl(OB.STRESS, stress)} · Energy ${lbl(OB.ENERGY, energy)}`}>
        <V3RowScale label="Sleep" options={OB.SLEEP_QUALITY} value={sleepQ} set={setSleepQ}/>
        <V3RowScale label="Stress" options={OB.STRESS} value={stress} set={setStress}/>
        <V3RowScale label="Recovery" options={OB.RECOVERY} value={recovery} set={setRecovery}/>
        <V3RowScale label="Hunger" options={OB.HUNGER} value={hunger} set={setHunger}/>
        <V3RowScale label="Energy" options={OB.ENERGY} value={energy} set={setEnergy}/>
        <V3RowScale label="Insulin" options={OB.INSULIN} value={insulin} set={setInsulin}/>
      </V3Fold>

      {/* 4 · Kitchen & rhythm */}
      <V3Fold label="Kitchen & rhythm" open={open === 'kitchen'} onToggle={() => fold('kitchen')}
        summary={`${equipment.length} appliances · ${conditions.join(', ')} · 06:30–23:00`}>
        <V3FoldChips label="Health conditions" options={OB.HEALTH_CONDITIONS} list={conditions} set={setConditions} tint={v3.lilac}/>
        <V3FoldChips label="Kitchen equipment" options={OB.KITCHEN_EQUIPMENT} list={equipment} set={setEquipment} tint={v3.butter} icons={OB.EQUIPMENT_ICONS}/>
        <V3RowScale label="Cooking" options={OB.COOKING_STYLE} value={cooking} set={setCooking}/>
        <div>
          <V3Kick style={{ marginBottom:4 }}>Daily rhythm</V3Kick>
          <V3Row label="Wake up" value="06:30" chevron/>
          <V3Row label="Sleep" value="23:00" chevron last/>
        </div>
      </V3Fold>

      {/* always visible: the two things that shape the plan itself */}
      <div style={{ display:'flex', gap:8 }}>
        <V3MiniStep label="Water goal" val={water} unit={`glasses · ${(water * 0.25).toFixed(1)}L`}
          onDec={() => setWater(x => Math.max(4, x - 1))} onInc={() => setWater(x => Math.min(16, x + 1))}/>
        <div style={{ flex:1, background:v3.paper, borderRadius:18, padding:'12px 13px' }}>
          <V3Kick style={{ fontSize:8 }}>Plan duration</V3Kick>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            {[7, 14].map(d => (
              <button key={d} onClick={() => setDuration(d)} style={{
                flex:1, border:'none', cursor:'pointer', borderRadius:14, padding:'11px 0',
                background: duration === d ? v3.ink : v3.card, color: duration === d ? v3.lime : v3.dim,
                fontFamily:v3.sans, fontSize:12, fontWeight:800,
              }}>{d}-day</button>
            ))}
          </div>
        </div>
      </div>

      <V3Card bg={v3.lime} r={24} pad={16}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <V3Kick color={v3.panelDim}>Estimated TDEE</V3Kick>
            <div style={{ fontFamily:v3.disp, fontSize:26, fontWeight:700, letterSpacing:'-0.04em', marginTop:6 }}>
              2,180 <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600 }}>kcal/day</span>
            </div>
            <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.panelDim, marginTop:5 }}>From your body, activity and training</div>
          </div>
          <V3Chip bg={v3.card} size={10.5}>BMI 23.2</V3Chip>
        </div>
      </V3Card>
    </V3ObShell>
  );
};
