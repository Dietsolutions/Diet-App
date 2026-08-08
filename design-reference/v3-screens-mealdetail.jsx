// v3 — Meal detail + Change meal rebuilt from MealDetailSheet.tsx and ChangeMealSheet.tsx
const { V3Scaffold, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3IconBtn } = window;

const V3_INSTRUCTION_LANGUAGES = [
  { code:'en', native:'English' }, { code:'hi', native:'हिंदी' }, { code:'kn', native:'ಕನ್ನಡ' },
  { code:'ta', native:'தமிழ்' }, { code:'te', native:'తెలుగు' },
];

// vertical bar (VBar in ui) — fills from the bottom
function V3VBar({ pct, color, h = 64 }) {
  return (
    <div style={{ width:9, height:h, borderRadius:5, background:v3.track, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${Math.min(1, Math.max(0, pct)) * 100}%`, background:color, borderRadius:5 }}/>
    </div>
  );
}

function V3MacroCol({ label, value, pct, color, unit = 'g' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
      <V3VBar pct={pct} color={color}/>
      <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:800, color }}>
        {value}<span style={{ fontSize:9, color:v3.dimmer, marginLeft:1 }}>{unit}</span>
      </div>
      <V3Kick style={{ fontSize:7.5 }}>{label}</V3Kick>
    </div>
  );
}

// numbered ingredient row (DataRow in ui)
function V3DataRow({ label, value, last }) {
  return (
    <div style={{ display:'flex', gap:12, alignItems:'baseline', padding:'11px 0', borderBottom: last ? 'none' : `1px solid ${v3.line}` }}>
      <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight:800, color:v3.dimmer, flexShrink:0 }}>{label}</span>
      <span style={{ flex:1, fontFamily:v3.sans, fontSize:13, fontWeight:600, lineHeight:1.4 }}>{value}</span>
    </div>
  );
}

// ── Meal detail (MealDetailSheet.tsx) ────────────────────────
// Earlier visual treatment (photo hero, macro tiles, Ingredients/Instructions tabs)
// carrying the full grounded content set — nothing from the source screen is dropped.
const V3_MEAL = {
  name:'Tandoori Chicken Breast + Cucumber Raita',
  description:'Marinated tandoori chicken with cool raita and lightly stir-fried cabbage. Macro-checked against the database — portion corrected for a home kitchen.',
  kcal:360, p:55, c:12, f:10, fi:3,
  tip:'Rest the chicken 3 minutes after grilling so the juices redistribute — it stays far more tender.',
  ingredients:[
    { n:'Chicken breast', q:'180 g' }, { n:'Hung curd', q:'60 g' }, { n:'Tandoori masala', q:'2 tsp' },
    { n:'Ginger garlic paste', q:'1 tbsp' }, { n:'Cucumber', q:'1 medium' }, { n:'Curd (for raita)', q:'100 g' },
    { n:'Roasted cumin', q:'½ tsp' }, { n:'Lemon', q:'½' },
  ],
};
const V3_TARGETS = { p:165, c:60, f:45, fi:25, kcal:1320 };

function V3MacroTile({ v, l, bg, wide }) {
  return (
    <V3Card bg={bg} r={20} pad={15} style={wide ? { gridColumn:'1 / -1' } : undefined}>
      <div style={{ fontFamily:v3.disp, fontSize:26, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1 }}>{v}</div>
      <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, color:'rgba(15,20,15,0.55)', marginTop:6 }}>{l}</div>
    </V3Card>
  );
}

function V3ImpactCard({ kcal }) {
  const soFar = 610, withMeal = soFar + kcal;
  const t = V3_TARGETS.kcal;
  const soFarPct = soFar / t, withPct = withMeal / t, over = withMeal > t;
  return (
    <V3Card r={24} pad={15}>
      <V3Kick style={{ marginBottom:12 }}>Impact on today</V3Kick>
      <div style={{ position:'relative', height:7, borderRadius:999, background:v3.track, overflow:'hidden', marginBottom:9 }}>
        <div style={{ position:'absolute', inset:0, right:`${100 - soFarPct * 100}%`, background:v3.lineStrong }}/>
        <div style={{ position:'absolute', top:0, bottom:0, left:`${soFarPct * 100}%`, width:`${(withPct - soFarPct) * 100}%`, background: over ? v3.warn : v3.lime }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div>
          <V3Kick style={{ fontSize:8.5 }}>Without</V3Kick>
          <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, color:v3.dim, marginTop:3 }}>{soFar} <span style={{ fontSize:9, color:v3.dimmer }}>kcal</span></div>
        </div>
        <span style={{ fontSize:10, color:v3.dimmer, alignSelf:'center' }}>→</span>
        <div style={{ textAlign:'right' }}>
          <V3Kick style={{ fontSize:8.5 }}>With meal</V3Kick>
          <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:800, color: over ? v3.warn : '#5F8C12', marginTop:3 }}>{withMeal} <span style={{ fontSize:9, color:v3.dimmer }}>kcal</span></div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:9 }}>
        <V3Kick style={{ fontSize:7.5 }}>{over ? `${withMeal - t} kcal over target` : `${t - withMeal} kcal remaining of ${t}`}</V3Kick>
      </div>
    </V3Card>
  );
}

const V3_ORIGINAL = { name:'Tandoori Chicken Breast + Cucumber Raita', kcal:360, p:55, c:12, f:10 };
const V3_SWAP_IN = { name:'Chicken tikka, tandoori', kcal:321, p:41, c:6, f:15, fi:2 };

window.V3MealDetail = function V3MealDetail({ onNav, swapped }) {
  const [tab, setTab] = React.useState('ing');
  const [servings, setServings] = React.useState(1);
  const [lang, setLang] = React.useState('en');
  const m = swapped ? { ...V3_MEAL, ...V3_SWAP_IN } : V3_MEAL;
  return (
    <V3Scaffold nav={false} onNav={onNav} footer={
      <div style={{ position:'absolute', left:0, right:0, bottom:0, background:v3.paper, borderTop:`1px solid ${v3.lineStrong}`, padding:'12px 20px 20px', display:'flex', gap:10, zIndex:20 }}>
        <button onClick={() => onNav && onNav('meals')} style={{
          flex:2, padding:'15px 0', borderRadius:999, cursor:'pointer',
          background: swapped ? v3.paper : v3.lime, border: swapped ? `1.5px solid ${v3.lineStrong}` : 'none',
          color: swapped ? v3.dim : v3.ink,
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase',
        }}>{swapped ? '✓ Eaten — undo' : 'Mark as eaten'}</button>
        <button onClick={() => onNav && onNav(swapped ? 'meals' : 'replaceSheet')} style={{
          flex:1, padding:'15px 0', borderRadius:999, cursor:'pointer', background:'transparent',
          border:`1.5px solid ${v3.lineStrong}`, color: swapped ? v3.dimmer : v3.dim,
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.11em', textTransform:'uppercase',
        }}>{swapped ? 'Undo swap' : '↻ Swap'}</button>
      </div>
    }>
      {/* photo hero */}
      <div style={{ position:'relative', margin:'6px 14px 0' }}>
        <div style={{ borderRadius:30, overflow:'hidden', height:270, background:v3.peach }}>
          <image-slot id={swapped ? 'v3-meal-hero-swapped' : 'v3-meal-hero'} placeholder="Drop the meal photo here" style={{ width:'100%', height:'100%' }}></image-slot>
        </div>
        <div style={{ position:'absolute', top:14, left:14, right:14, display:'flex', justifyContent:'space-between' }}>
          <V3IconBtn onClick={() => onNav && onNav('meals')} bg="rgba(255,255,255,0.92)">←</V3IconBtn>
          <div style={{ display:'flex', gap:9, alignItems:'center' }}>
            {swapped && (
              <div style={{ background:'rgba(255,255,255,0.92)', borderRadius:999, padding:'8px 13px', textAlign:'center',
                fontFamily:v3.sans, fontSize:9, fontWeight:800, letterSpacing:'0.12em', color:'#B3492C', textTransform:'uppercase' }}>↻ Swapped</div>
            )}
            <V3IconBtn bg="rgba(255,255,255,0.92)">♥</V3IconBtn>
          </div>
        </div>
      </div>

      <div style={{ padding:'20px 22px 0' }}>
        {/* kicker + time */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <V3Kick>Lunch · 13:00 · Day 17 · Meal 02 of 04</V3Kick>
          <V3Chip bg={v3.limeSoft} size={11} style={{ flexShrink:0 }}>⏱ 35 min</V3Chip>
        </div>
        <V3H size={28} style={{ marginTop:10, lineHeight:1.15 }}>{m.name}</V3H>
        <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, marginTop:10, lineHeight:1.6 }}>{m.description}</div>

        {/* macro tiles — kcal wide, then P/C/F/Fibre */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginTop:18 }}>
          <V3MacroTile v={m.kcal} l="kcal" bg={v3.lime} wide/>
          <V3MacroTile v={`${m.p} g`} l="Protein" bg={v3.mint}/>
          <V3MacroTile v={`${m.c} g`} l="Carbs" bg={v3.butter}/>
          <V3MacroTile v={`${m.f} g`} l="Fat" bg={v3.peach}/>
          <V3MacroTile v={`${m.fi} g`} l="Fibre" bg={v3.sky}/>
        </div>

        {/* impact on today */}
        <div style={{ marginTop:12 }}><V3ImpactCard kcal={m.kcal}/></div>

        {/* original plan meal — swap state only */}
        {swapped && (
          <V3Card bg="rgba(255,195,162,0.20)" r={22} pad={14} border={v3.peach} style={{ marginTop:12 }}>
            <V3Kick color="#B3492C" style={{ marginBottom:9 }}>Original plan meal</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color:v3.dim, lineHeight:1.4 }}>{V3_ORIGINAL.name}</div>
            <div style={{ marginTop:7, fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.dimmer }}>
              {V3_ORIGINAL.kcal} kcal · P{V3_ORIGINAL.p} C{V3_ORIGINAL.c} F{V3_ORIGINAL.f}
            </div>
            <button onClick={() => onNav && onNav('meal')} style={{
              marginTop:11, background:'transparent', border:'none', padding:0, cursor:'pointer',
              fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.14em', color:v3.dimmer, textTransform:'uppercase',
            }}>Restore original</button>
          </V3Card>
        )}

        {/* tabs */}
        <div style={{ display:'flex', gap:6, background:v3.track, borderRadius:999, padding:5, marginTop:20 }}>
          {[{ id:'ing', l:`Ingredients · ${m.ingredients.length}` }, { id:'ins', l:'Instructions' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'12px 0',
              background: tab === t.id ? v3.ink : 'transparent', color: tab === t.id ? v3.onDark : v3.dim,
              fontFamily:v3.sans, fontSize:12.5, fontWeight:700, transition:'background 200ms ease-out',
            }}>{t.l}</button>
          ))}
        </div>

        {tab === 'ing' ? (
          <>
            <V3Card r={26} pad="0 16px" style={{ marginTop:14 }}>
              {m.ingredients.map((it, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom: i === m.ingredients.length - 1 ? 'none' : `1px solid ${v3.line}` }}>
                  <V3Food size={32} tint={i % 2 ? v3.mint : v3.butter}/>
                  <span style={{ flex:1, fontFamily:v3.sans, fontSize:13.5, fontWeight:600 }}>{it.n}</span>
                  <span style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:700, color:v3.dim }}>{it.q}</span>
                </div>
              ))}
            </V3Card>
            <V3Card r={22} pad={15} style={{ marginTop:12 }}>
              <V3Kick style={{ marginBottom:8 }}>Cooking tip</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>{m.tip}</div>
            </V3Card>
          </>
        ) : (
          <V3Card r={26} pad={17} style={{ marginTop:14 }}>
            {/* servings */}
            <div style={{ background:v3.paper, borderRadius:16, padding:'13px 14px', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <V3Kick style={{ marginBottom:4 }}>Cooking for</V3Kick>
                  <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim }}>{servings === 1 ? 'Just me' : `${servings} people`}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <V3IconBtn size={32} bg={v3.card} onClick={() => setServings(x => Math.max(1, x - 1))}>−</V3IconBtn>
                  <span style={{ fontFamily:v3.disp, fontSize:20, fontWeight:700, minWidth:20, textAlign:'center' }}>{servings}</span>
                  <V3IconBtn size={32} bg={v3.lime} onClick={() => setServings(x => Math.min(10, x + 1))}>+</V3IconBtn>
                </div>
              </div>
            </div>
            {/* language */}
            <V3Kick style={{ marginBottom:9 }}>Language</V3Kick>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
              {V3_INSTRUCTION_LANGUAGES.map(l => {
                const on = lang === l.code;
                return (
                  <button key={l.code} onClick={() => setLang(l.code)} style={{
                    padding:'7px 12px', borderRadius:999, cursor:'pointer',
                    border:`1.5px solid ${on ? '#5F8C12' : v3.lineStrong}`,
                    background: on ? v3.limeSoft : 'transparent', color: on ? '#5F8C12' : v3.dim,
                    fontFamily:v3.sans, fontSize:12, fontWeight:700,
                  }}>{l.native}</button>
                );
              })}
            </div>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.5, marginBottom:13, textAlign:'center' }}>
              Get step-by-step instructions with exact ingredients and quantities.
            </div>
            <button onClick={() => onNav && onNav('mealInstructions')} style={{
              width:'100%', padding:'14px 0', borderRadius:999, cursor:'pointer',
              background:'transparent', border:`1.5px solid ${v3.limeDeep}`, color:'#5F8C12',
              fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase',
            }}>Generate instructions</button>
          </V3Card>
        )}
      </div>
    </V3Scaffold>
  );
};

// ── Meal detail · instructions generated ─────────────────────
window.V3MealInstructions = function V3MealInstructions({ onNav }) {
  const groups = [
    { g:'For the marinade', items:[
      { q:'180 g', n:'Chicken breast', note:'cut into 4 pieces' }, { q:'60 g', n:'Hung curd' },
      { q:'2 tsp', n:'Tandoori masala' }, { q:'1 tbsp', n:'Ginger garlic paste' },
    ]},
    { g:'For the raita', items:[
      { q:'1 medium', n:'Cucumber', note:'grated, water squeezed out' }, { q:'100 g', n:'Curd' }, { q:'½ tsp', n:'Roasted cumin' },
    ]},
  ];
  const steps = [
    { n:1, t:'Marinate', d:'30 min', i:'Whisk hung curd with tandoori masala, ginger garlic paste, lemon and salt. Coat the chicken and rest.', tip:'Longer is better — overnight gives the deepest flavour.' },
    { n:2, t:'Grill', d:'12–14 min', i:'Heat a heavy pan until smoking. Grill 6–7 minutes per side until charred at the edges and cooked through.' },
    { n:3, t:'Make the raita', d:'5 min', i:'Fold grated cucumber into curd with roasted cumin and salt. Chill until serving.' },
    { n:4, t:'Rest and serve', d:'3 min', i:'Rest the chicken, slice thick, and serve with the raita alongside.' },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      {/* photo hero — same treatment as the detail screen */}
      <div style={{ position:'relative', margin:'6px 14px 0' }}>
        <div style={{ borderRadius:30, overflow:'hidden', height:190, background:v3.peach }}>
          <image-slot id="v3-meal-hero-instr" placeholder="Drop the meal photo here" style={{ width:'100%', height:'100%' }}></image-slot>
        </div>
        <div style={{ position:'absolute', top:14, left:14, right:14, display:'flex', justifyContent:'space-between' }}>
          <V3IconBtn onClick={() => onNav && onNav('meal')} bg="rgba(255,255,255,0.92)">←</V3IconBtn>
          <V3IconBtn bg="rgba(255,255,255,0.92)" onClick={() => onNav && onNav('share')}>↗</V3IconBtn>
        </div>
      </div>

      <div style={{ padding:'20px 22px 0' }}>
        <V3Kick>Cooking instructions · Lunch</V3Kick>
        <V3H size={26} style={{ marginTop:9, lineHeight:1.15 }}>{V3_MEAL.name}</V3H>

        {/* tabs — Instructions active */}
        <div style={{ display:'flex', gap:6, background:v3.track, borderRadius:999, padding:5, marginTop:16 }}>
          <button onClick={() => onNav && onNav('meal')} style={{
            flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'12px 0', background:'transparent', color:v3.dim,
            fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
          }}>Ingredients · 8</button>
          <button style={{
            flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'12px 0', background:v3.ink, color:v3.onDark,
            fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
          }}>Instructions</button>
        </div>

        {/* time strip + share */}
        <V3Card r={24} pad={0} style={{ marginTop:14, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', borderBottom:`1px solid ${v3.line}` }}>
            {[['Prep','15 min'],['Cook','14 min'],['Total','29 min'],['Serves','2']].map(([l, val]) => (
              <div key={l} style={{ padding:'13px 0', textAlign:'center', borderRight:`1px solid ${v3.line}` }}>
                <V3Kick style={{ marginBottom:5, fontSize:7.5 }}>{l}</V3Kick>
                <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700 }}>{val}</div>
              </div>
            ))}
            <div style={{ display:'grid', placeItems:'center', padding:'0 12px' }}>
              <button onClick={() => onNav && onNav('share')} style={{
                background:'transparent', border:`1.5px solid ${v3.lineStrong}`, borderRadius:999, padding:'6px 11px', cursor:'pointer',
                fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.12em', color:v3.dim, textTransform:'uppercase', whiteSpace:'nowrap',
              }}>↗ Share</button>
            </div>
          </div>

          <div style={{ textAlign:'center', padding:'8px 14px 4px' }}>
            <button style={{ background:'none', border:'none', cursor:'pointer', fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.11em', color:v3.dimmer, textTransform:'uppercase' }}>
              ↺ Re-generate for different servings
            </button>
          </div>

          {/* audio guide */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', borderTop:`1px solid ${v3.line}`, borderBottom:`1px solid ${v3.line}` }}>
            <V3IconBtn bg={v3.lime} size={38}>▶</V3IconBtn>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:700 }}>Audio guide</div>
              <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:500, color:v3.dimmer, marginTop:2 }}>English only for now</div>
            </div>
            <V3Bar pct={0.34} h={3} color={v3.limeDeep}/>
          </div>

          {/* grouped ingredients */}
          <div style={{ padding:'13px 15px', borderBottom:`1px solid ${v3.line}` }}>
            <V3Kick style={{ marginBottom:11 }}>Ingredients</V3Kick>
            {groups.map(gr => (
              <div key={gr.g} style={{ marginBottom:12 }}>
                <div style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.16em', color:'#5F8C12', textTransform:'uppercase', marginBottom:7 }}>{gr.g}</div>
                {gr.items.map((it, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:`1px solid ${v3.line}` }}>
                    <span style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, minWidth:66, flexShrink:0 }}>{it.q}</span>
                    <div>
                      <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600 }}>{it.n}</div>
                      {it.note && <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.dimmer, marginTop:2 }}>{it.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* method */}
          <div style={{ padding:'13px 15px', borderBottom:`1px solid ${v3.line}` }}>
            <V3Kick style={{ marginBottom:13 }}>Method</V3Kick>
            {steps.map(st => (
              <div key={st.n} style={{ display:'flex', gap:12, marginBottom:18 }}>
                <div style={{
                  width:25, height:25, flexShrink:0, borderRadius:999, border:`1.5px solid ${v3.limeDeep}`,
                  display:'grid', placeItems:'center', fontFamily:v3.sans, fontSize:10.5, fontWeight:800, color:'#5F8C12', marginTop:1,
                }}>{st.n}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:700, marginBottom:4 }}>
                    {st.t}<span style={{ fontSize:9.5, fontWeight:600, color:v3.dimmer, marginLeft:8 }}>{st.d}</span>
                  </div>
                  <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.6 }}>{st.i}</div>
                  {st.tip && (
                    <div style={{ marginTop:8, padding:'8px 11px', borderLeft:`2px solid ${v3.limeDeep}`, background:v3.limeSoft, fontFamily:v3.sans, fontSize:11, fontWeight:500, color:'#4C7010', lineHeight:1.5 }}>{st.tip}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* chef's tips */}
          <div style={{ padding:'13px 15px', borderBottom:`1px solid ${v3.line}` }}>
            <V3Kick style={{ marginBottom:11 }}>Chef’s tips</V3Kick>
            {['Pat the chicken dry before marinating — wet meat steams instead of charring.','A cast-iron pan gets closer to a tandoor than a non-stick one.'].map((tip, i) => (
              <div key={i} style={{ display:'flex', gap:10, marginBottom:8, padding:'10px 12px', borderRadius:14, background:v3.paper }}>
                <span style={{ fontSize:10, color:'#5F8C12', flexShrink:0 }}>✦</span>
                <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>{tip}</span>
              </div>
            ))}
          </div>

          {/* substitution */}
          <div style={{ padding:'12px 15px' }}>
            <V3Kick style={{ marginBottom:7 }}>Substitution</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>
              Swap chicken for 200 g paneer or firm tofu — keep the same marinade and reduce grilling to 8 minutes total.
            </div>
          </div>

          <div style={{ padding:'4px 15px 14px', textAlign:'center' }}>
            <button style={{ background:'transparent', border:'none', cursor:'pointer', fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.13em', color:v3.dimmer, textTransform:'uppercase' }}>↻ Regenerate</button>
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Meal detail · replaced (isReplaced) ─────────────────────
// Same component in swap state — one source of truth, so the two cannot drift apart.
window.V3MealDetailSwapped = function V3MealDetailSwapped({ onNav }) {
  return <window.V3MealDetail onNav={onNav} swapped/>;
};

// ── Change meal · screen 1 rules (ChangeMealSheet.tsx) ───────
const V3_QUICK_HINTS = ['Something light','Quick · under 15 min','No dairy','High protein','Spicy','South Indian','No cooking required','Budget friendly','High fibre','Low carb','Vegetarian','One pot meal'];
const V3_PLAN_RULES = [
  ['vegetarian','Vegetarian Only'],['no_seafood','No Seafood'],['lactose_free','Lactose-Free'],
  ['high_protein','High-Protein Priority'],['minimize_prep','Minimize Prep Time'],['spicy','Spicy Meals'],
  ['low_carb','Low Carb'],['gluten_free','Gluten Free'],['no_nuts','No Nuts'],
  ['budget_friendly','Budget Friendly'],['no_onion_garlic','No Onion / Garlic'],['quick_cook','Under 20 Minutes'],
];

function V3MacroRow({ k, p, c, f, fi }) {
  return (
    <div style={{ display:'flex', gap:9, alignItems:'center', flexWrap:'wrap', fontFamily:v3.sans, fontWeight:800 }}>
      <span style={{ fontSize:11, fontWeight:600, color:v3.dimmer }}>{k} kcal</span>
      <span style={{ fontSize:12, color:v3.protein }}>P{p}</span>
      <span style={{ fontSize:12, color:'#B0871C' }}>C{c}</span>
      <span style={{ fontSize:12, color:'#C4573A' }}>F{f}</span>
      <span style={{ fontSize:12, color:'#2F8C7C' }}>Fi{fi}</span>
    </div>
  );
}

window.V3ChangeMeal = function V3ChangeMeal({ onNav }) {
  const [hints, setHints] = React.useState(['High protein']);
  const [rules, setRules] = React.useState(['no_nuts']);
  const toggle = (list, set, id) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  return (
    <V3Scaffold nav={false} onNav={onNav} footer={
      <div style={{ position:'absolute', left:0, right:0, bottom:0, background:v3.paper, borderTop:`1px solid ${v3.lineStrong}`, zIndex:20 }}>
        <button onClick={() => onNav && onNav('changeMealOptions')} style={{
          width:'100%', padding:'21px 0', background:'none', border:'none', cursor:'pointer', color:v3.text,
          fontFamily:v3.sans, fontSize:11, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase',
        }}>Apply &amp; regenerate</button>
      </div>
    }>
      <div style={{ padding:'10px 20px 0', display:'flex', alignItems:'center', gap:12 }}>
        <V3IconBtn bg={v3.card} onClick={() => onNav && onNav('meals')}>←</V3IconBtn>
        <V3Kick style={{ flex:1 }}>Change meal · Lunch · 13:00</V3Kick>
      </div>

      {/* current meal context */}
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${v3.line}`, marginTop:12 }}>
        <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, color:v3.dim, lineHeight:1.3 }}>
          Replacing: <span style={{ color:v3.text, fontWeight:700 }}>Tandoori Chicken Breast + Cucumber Raita</span>
        </div>
        <div style={{ marginTop:7 }}><V3MacroRow k={360} p={55} c={12} f={10} fi={3}/></div>
      </div>

      {/* free-form instructions */}
      <div style={{ padding:'20px 20px 0' }}>
        <V3Kick style={{ marginBottom:10 }}>Free-form instructions</V3Kick>
        <div style={{
          background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:18, padding:'13px 15px',
          minHeight:92, fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dimmer, lineHeight:1.55,
        }}>e.g. “Make it eggs-heavy”, “avoid rice”, “keep it under 15 min”…</div>
      </div>

      {/* quick hints */}
      <div style={{ padding:'20px 20px 0' }}>
        <V3Kick style={{ marginBottom:10 }}>Or pick a hint</V3Kick>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {V3_QUICK_HINTS.map(h => {
            const on = hints.includes(h);
            return (
              <button key={h} onClick={() => toggle(hints, setHints, h)} style={{
                background: on ? v3.limeSoft : 'transparent', borderRadius:999, cursor:'pointer',
                border:`1.5px solid ${on ? '#5F8C12' : v3.lineStrong}`, padding:'10px 15px',
                fontFamily:v3.sans, fontSize:13, fontWeight:600, color: on ? '#5F8C12' : v3.dim,
              }}>{h}</button>
            );
          })}
        </div>
      </div>

      {/* rule toggles */}
      <div style={{ padding:'20px 20px 0' }}>
        <V3Kick style={{ marginBottom:5 }}>Rules</V3Kick>
        {V3_PLAN_RULES.map(([id, label], i) => {
          const on = rules.includes(id);
          return (
            <div key={id} onClick={() => toggle(rules, setRules, id)} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 0', borderBottom: i < V3_PLAN_RULES.length - 1 ? `1px solid ${v3.line}` : 'none', cursor:'pointer',
            }}>
              <span style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.13em', textTransform:'uppercase', color: on ? v3.text : v3.dimmer }}>{label}</span>
              <div style={{
                width:44, height:24, borderRadius:999, flexShrink:0, padding:2,
                background: on ? v3.lime : 'rgba(15,20,15,0.13)', display:'flex', justifyContent: on ? 'flex-end' : 'flex-start',
              }}><div style={{ width:20, height:20, borderRadius:999, background:'#fff', boxShadow:'0 2px 5px rgba(15,20,15,0.2)' }}/></div>
            </div>
          );
        })}
      </div>
    </V3Scaffold>
  );
};

// ── Change meal · screen 2 options ───────────────────────────
window.V3ChangeMealOptions = function V3ChangeMealOptions({ onNav }) {
  const options = [
    { n:'Grilled Fish Tikka + Sautéed Spinach', d:'Firm white fish in a light tikka marinade, seared and served with garlic spinach.', prep:'25 min', k:330, p:48, c:8, f:9, fi:4 },
    { n:'Paneer Tikka + Kachumber Salad', d:'Char-grilled paneer with a sharp onion-cucumber-tomato salad.', prep:'20 min', k:352, p:29, c:14, f:18, fi:5 },
    { n:'Egg Bhurji + 2 Phulka', d:'Spiced scrambled eggs with soft whole-wheat phulka.', prep:'15 min', k:368, p:31, c:26, f:16, fi:4 },
    { n:'Chicken Salad Bowl', d:'Shredded poached chicken over greens with a yoghurt-herb dressing.', prep:'18 min', k:345, p:44, c:11, f:12, fi:6 },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <div style={{ padding:'10px 20px 0', display:'flex', alignItems:'center', gap:12 }}>
        <V3IconBtn bg={v3.card} onClick={() => onNav && onNav('changeMeal')}>←</V3IconBtn>
        <V3Kick style={{ flex:1 }}>Select replacement meal</V3Kick>
      </div>

      <div style={{ padding:'16px 20px 0' }}>
        {options.map((o, i) => (
          <V3Card key={i} r={22} pad={16} style={{ marginBottom:10 }}>
            <V3Kick color="#5F8C12" style={{ marginBottom:8 }}>Option {String(i + 1).padStart(2, '0')} · {o.prep}</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:700, lineHeight:1.3, marginBottom:6 }}>{o.n}</div>
            <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:500, color:v3.dim, lineHeight:1.5, marginBottom:11 }}>{o.d}</div>
            <div style={{ marginBottom:14 }}><V3MacroRow k={o.k} p={o.p} c={o.c} f={o.f} fi={o.fi}/></div>
            <button onClick={() => onNav && onNav('meals')} style={{
              width:'100%', padding:'13px 0', borderRadius:999, cursor:'pointer', background:'transparent',
              border:`1.5px solid ${v3.limeDeep}`, color:'#5F8C12',
              fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase',
            }}>Select this meal</button>
          </V3Card>
        ))}
        <div style={{ textAlign:'center', marginTop:6 }}>
          <button onClick={() => onNav && onNav('changeMeal')} style={{
            background:'none', border:'none', cursor:'pointer',
            fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.13em', color:v3.dimmer, textTransform:'uppercase',
          }}>↺ Change options</button>
        </div>
      </div>
    </V3Scaffold>
  );
};
