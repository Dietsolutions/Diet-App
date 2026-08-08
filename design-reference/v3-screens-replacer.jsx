// v3 — Meal replacer bottom sheet + share sheet, rebuilt from
// MealReplacerSheet.tsx, MealReplacerSearch.tsx, MealReplacerQuantity.tsx, MealReplacerAI.tsx, MealShareSheet.tsx
const { V3Scaffold, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3IconBtn } = window;

// bottom-sheet shell: dim overlay, sheet pinned to bottom, drag handle, inner scroll
function V3Sheet({ children, onClose }) {
  return (
    <V3Scaffold nav={false} bg="rgba(15,20,15,0.65)" dark>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div style={{
          position:'relative', width:'100%', maxHeight:'90%', background:v3.paper,
          borderTopLeftRadius:28, borderTopRightRadius:28, borderTop:`1px solid ${v3.lineStrong}`,
          display:'flex', flexDirection:'column', color:v3.text,
        }}>
          <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 8px', cursor:'grab', flexShrink:0 }}>
            <div style={{ width:34, height:3, borderRadius:999, background:v3.lineStrong }}/>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 28px' }}>{children}</div>
        </div>
      </div>
    </V3Scaffold>
  );
}

function V3SheetBack({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8, background:'transparent', border:'none', padding:0, cursor:'pointer',
      fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.14em', color:'#5F8C12', textTransform:'uppercase',
    }}>‹ Back</button>
  );
}

// ── Screen: category picker (ADD MEAL) ───────────────────────
const V3_MEAL_CATEGORIES = [
  ['breakfast','Breakfast'],['brunch','Brunch'],['lunch','Lunch'],
  ['evening_snack','Evening Snack'],['dinner','Dinner'],['other','Other'],
];

window.V3ReplaceCategory = function V3ReplaceCategory({ onNav }) {
  const [sel, setSel] = React.useState('lunch');
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ paddingTop:4 }}>
          <V3Kick style={{ marginBottom:7 }}>Add meal</V3Kick>
          <V3H size={22}>What kind of meal?</V3H>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {V3_MEAL_CATEGORIES.map(([id, label]) => {
            const on = sel === id;
            return (
              <button key={id} onClick={() => setSel(id)} style={{
                padding:'17px 15px', borderRadius:18, cursor:'pointer', textAlign:'left',
                border:`1.5px solid ${on ? '#5F8C12' : v3.line}`, background: on ? v3.limeSoft : v3.card,
                fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.13em',
                color: on ? '#5F8C12' : v3.dim, textTransform:'uppercase',
              }}>{label}</button>
            );
          })}
        </div>
        <button onClick={() => onNav && onNav('replaceSheet')} style={{
          width:'100%', padding:'15px 0', borderRadius:999, border:'none', cursor:'pointer',
          background:v3.lime, color:v3.ink, marginTop:4,
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase',
        }}>Next →</button>
      </div>
    </V3Sheet>
  );
};

// ── Screen: search (SWAP MEAL) ───────────────────────────────
const V3_QUICK_PICKS = ['Boiled eggs','Rice + Dal','Banana','Coffee','Protein shake','Bread butter'];

window.V3ReplaceSheet = function V3ReplaceSheet({ onNav }) {
  const recents = [
    { n:'Tandoori chicken breast', k:360, src:'INDB' },
    { n:'Moong dal chilla', k:238, src:'INDB' },
    { n:'Whey protein shake', k:126, src:'USDA' },
    { n:'2 rotis with butter chicken', k:495, src:'AI' },
  ];
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <div>
          <V3Kick style={{ marginBottom:7 }}>Swap meal</V3Kick>
          <V3H size={22}>What did you eat?</V3H>
          <V3Kick color={v3.dim} style={{ marginTop:5 }}>Replacing: Tandoori Chicken Breast · 22 Apr</V3Kick>
        </div>

        <button onClick={() => onNav && onNav('replaceSearch')} style={{
          display:'flex', alignItems:'center', gap:10, padding:'14px 15px', width:'100%',
          background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:999,
          cursor:'text', textAlign:'left', color:v3.dimmer,
        }}>
          <span style={{ fontSize:14, color:'#5F8C12' }}>⌕</span>
          <span style={{ fontFamily:v3.sans, fontSize:14, fontWeight:500 }}>Search foods, dishes, ingredients...</span>
        </button>

        <div>
          <V3Kick style={{ marginBottom:10 }}>Quick picks</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {V3_QUICK_PICKS.map(p => (
              <button key={p} onClick={() => onNav && onNav('replaceSearch')} style={{
                padding:'8px 13px', borderRadius:999, border:`1.5px solid ${v3.lineStrong}`, background:'transparent', cursor:'pointer',
                fontFamily:v3.sans, fontSize:9, fontWeight:800, letterSpacing:'0.11em', color:v3.dim, textTransform:'uppercase',
              }}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <V3Kick style={{ marginBottom:10 }}>Recent</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {recents.map((r, i) => (
              <button key={i} onClick={() => onNav && onNav('replaceQty')} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', width:'100%',
                background:v3.card, border:`1px solid ${v3.line}`, borderRadius:16, cursor:'pointer', textAlign:'left',
              }}>
                <span style={{ fontSize:11, color:v3.dimmer }}>↺</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.n}</div>
                  <V3Kick style={{ marginTop:3 }}>{r.k} kcal · {r.src}</V3Kick>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1, height:1, background:v3.line }}/><V3Kick>or</V3Kick><div style={{ flex:1, height:1, background:v3.line }}/>
        </div>

        <button onClick={() => onNav && onNav('replaceAI')} style={{
          padding:'17px 15px', width:'100%', background:v3.limeSoft, border:`1.5px solid ${v3.limeDeep}`, borderRadius:20,
          textAlign:'left', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:14,
        }}>
          <span style={{ fontFamily:v3.sans, fontSize:11, fontWeight:800, color:'#5F8C12' }}>02</span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:700, marginBottom:5 }}>Ask AI to estimate</div>
            <V3Kick color={v3.dim}>Describe what you ate — AI matches macros</V3Kick>
          </div>
          <span style={{ color:'#5F8C12', alignSelf:'center', fontWeight:700 }}>→</span>
        </button>
      </div>
    </V3Sheet>
  );
};

// ── Screen: results (MealReplacerResults.tsx + FoodResultCard.tsx) ──
// FoodResultCard: name (✨ prefix when AI), "PER {serving}", + button, 5 macro cells, source tag.
function V3FoodResultCard({ food, onClick }) {
  const ai = food.ai;
  const cells = [
    { v:food.k, u:'kcal', c:v3.text }, { v:food.p, u:'P', c:v3.protein },
    { v:food.c, u:'C', c:'#B0871C' }, { v:food.f, u:'F', c:'#C4573A' }, { v:food.fi, u:'Fi', c:'#2F8C7C' },
  ];
  return (
    <button onClick={onClick} style={{
      display:'block', width:'100%', textAlign:'left', padding:'13px 14px', borderRadius:16, cursor:'pointer',
      background: ai ? v3.limeSoft : v3.card, border:`1.5px solid ${ai ? v3.limeDeep : v3.line}`, color:v3.text,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {ai && <span style={{ color:'#5F8C12', marginRight:6 }}>✨</span>}{food.n}
          </div>
          <V3Kick style={{ marginTop:4 }}>Per {food.serv}{food.grams !== 100 ? ` · ${food.grams}g` : ''}</V3Kick>
        </div>
        <div style={{
          width:28, height:28, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center',
          border:`1.5px solid ${v3.limeDeep}`, color:'#5F8C12', fontFamily:v3.sans, fontSize:17, fontWeight:700,
        }}>+</div>
      </div>
      <div style={{ display:'flex', gap:6, marginTop:10 }}>
        {cells.map(m => (
          <div key={m.u} style={{ flex:1, textAlign:'center', padding:'6px 2px', borderRadius:9, background:`${m.c}14`, border:`1px solid ${m.c}22` }}>
            <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:800, color:m.c }}>{m.v}</div>
            <div style={{ fontFamily:v3.sans, fontSize:7, fontWeight:700, color:v3.dimmer, letterSpacing:'0.1em', textTransform:'uppercase' }}>{m.u}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:9 }}>
        <V3Kick color={ai ? '#5F8C12' : v3.dimmer} style={{ fontSize:7 }}>
          {food.src}{ai ? ' · Estimate — accuracy may vary' : ''}
        </V3Kick>
      </div>
    </button>
  );
}

function V3ResultsSearchBar({ query, onBack }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button onClick={onBack} style={{
        width:38, height:38, borderRadius:999, flexShrink:0, cursor:'pointer',
        background:'transparent', border:`1.5px solid ${v3.lineStrong}`, display:'grid', placeItems:'center',
        fontFamily:v3.sans, fontSize:14, fontWeight:700, color:v3.text,
      }}>‹</button>
      <div style={{
        flex:1, display:'flex', alignItems:'center', gap:8, padding:'11px 14px',
        background:v3.card, border:`1.5px solid ${v3.limeDeep}`, borderRadius:999,
      }}>
        <span style={{ fontSize:13, color:'#5F8C12' }}>⌕</span>
        <span style={{ flex:1, fontFamily:v3.sans, fontSize:14, fontWeight:600 }}>{query}</span>
        <span style={{ color:v3.dimmer, fontSize:16, cursor:'pointer', lineHeight:1 }}>×</span>
      </div>
    </div>
  );
}

window.V3ReplaceSearch = function V3ReplaceSearch({ onNav }) {
  const results = [
    { n:'Chicken tikka, tandoori', serv:'1 serving', grams:150, k:214, p:27, c:4, f:10, fi:1, src:'INDB' },
    { n:'Chicken breast, grilled', serv:'100g', grams:100, k:165, p:31, c:0, f:3.6, fi:0, src:'USDA' },
    { n:'Chicken curry, home-style', serv:'1 katori', grams:180, k:243, p:21, c:7, f:14, fi:2, src:'ICMR-NIN' },
    { n:'Butter chicken', serv:'1 katori', grams:200, k:290, p:24, c:9, f:18, fi:1, src:'CN' },
    { n:'Chicken salad bowl', serv:'1 bowl', grams:250, k:230, p:29, c:8, f:7, fi:3, src:'AI', ai:true },
  ];
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <V3ResultsSearchBar query="chicken" onBack={() => onNav && onNav('replaceSheet')}/>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {results.map((f, i) => <V3FoodResultCard key={i} food={f} onClick={() => onNav && onNav('replaceQty')}/>)}
          <V3Kick style={{ textAlign:'center', padding:'9px 0' }}>Sources: INDB · ICMR-NIN · OFF · USDA · AI</V3Kick>
        </div>
      </div>
    </V3Sheet>
  );
};

// ── Screen: results · no matches ──
window.V3ReplaceNoResults = function V3ReplaceNoResults({ onNav }) {
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <V3ResultsSearchBar query="ragi mudde with soppu" onBack={() => onNav && onNav('replaceSheet')}/>
        <div style={{ textAlign:'center', padding:'32px 0' }}>
          <V3Kick style={{ marginBottom:14 }}>No results for “RAGI MUDDE WITH SOPPU”</V3Kick>
          <button onClick={() => onNav && onNav('replaceAI')} style={{
            padding:'13px 22px', borderRadius:999, cursor:'pointer',
            background:v3.limeSoft, border:`1.5px solid ${v3.limeDeep}`, color:'#5F8C12',
            fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase',
          }}>✨ Describe it — let AI estimate</button>
        </div>
      </div>
    </V3Sheet>
  );
};

// ── Screen: quantity ─────────────────────────────────────────
window.V3ReplaceQty = function V3ReplaceQty({ onNav }) {
  const [qty, setQty] = React.useState(1);
  const per = { k:214, p:27, c:4, f:10, fi:1 };
  const m = k => Math.round(k * qty * 10) / 10;
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <V3SheetBack onClick={() => onNav && onNav('replaceSearch')}/>
        <div>
          <V3Kick style={{ marginBottom:7 }}>Adjust portion</V3Kick>
          <V3H size={20}>Chicken tikka, tandoori</V3H>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Serving size</V3Kick>
          <div style={{
            background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:16, padding:'13px 15px',
            fontFamily:v3.sans, fontSize:14, fontWeight:600, display:'flex', justifyContent:'space-between',
          }}>1 serving (150g)<span style={{ color:v3.dimmer }}>▾</span></div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            {[0.5, 1, 1.5, 2].map(sh => {
              const on = qty === sh;
              return (
                <button key={sh} onClick={() => setQty(sh)} style={{
                  flex:1, padding:'10px 0', borderRadius:999, cursor:'pointer',
                  border:`1.5px solid ${on ? '#5F8C12' : v3.lineStrong}`, background: on ? v3.limeSoft : 'transparent',
                  fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.08em', color: on ? '#5F8C12' : v3.dim,
                }}>{sh === 0.5 ? '½' : sh}</button>
              );
            })}
          </div>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Quantity</V3Kick>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <V3IconBtn size={42} bg="transparent" border={`1.5px solid ${v3.lineStrong}`} onClick={() => setQty(q => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))}>−</V3IconBtn>
            <div style={{
              flex:1, textAlign:'center', background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:16,
              padding:'11px 0', fontFamily:v3.disp, fontSize:21, fontWeight:700, letterSpacing:'-0.03em',
            }}>{qty}</div>
            <V3IconBtn size={42} bg="transparent" border={`1.5px solid ${v3.lineStrong}`} onClick={() => setQty(q => Math.round((q + 0.5) * 10) / 10)}>+</V3IconBtn>
          </div>
        </div>

        <V3Card r={22} pad={15}>
          <V3Kick style={{ marginBottom:11 }}>At {qty} × 1 serving</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:27, fontWeight:700, letterSpacing:'-0.04em', color:'#5F8C12', lineHeight:1, marginBottom:14 }}>
            {m(per.k)}<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginLeft:6 }}>kcal</span>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {[[m(per.p),'Protein',v3.protein],[m(per.c),'Carbs','#B0871C'],[m(per.f),'Fat','#C4573A'],[m(per.fi),'Fibre','#2F8C7C']].map(([v, l, c]) => (
              <div key={l} style={{ flex:1 }}>
                <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:800, color:c }}>{v}<span style={{ fontSize:9, color:v3.dimmer }}>g</span></div>
                <V3Kick color={c} style={{ fontSize:7, marginTop:4 }}>{l}</V3Kick>
              </div>
            ))}
          </div>
        </V3Card>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Note (optional)</V3Kick>
          <div style={{ background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:16, padding:'13px 15px', fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dimmer }}>
            e.g. “Office lunch”
          </div>
        </div>

        <V3Kick style={{ textAlign:'center', fontSize:7.5 }}>Macros are estimates. Actual values may vary.</V3Kick>

        <button onClick={() => onNav && onNav('meals')} style={{
          width:'100%', padding:'15px 0', borderRadius:999, border:'none', cursor:'pointer', background:v3.lime, color:v3.ink,
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase',
        }}>Log this meal</button>
      </div>
    </V3Sheet>
  );
};

// ── Screen: AI estimate (input) ──────────────────────────────
window.V3ReplaceAI = function V3ReplaceAI({ onNav }) {
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <V3SheetBack onClick={() => onNav && onNav('replaceSheet')}/>
        <div>
          <V3Kick style={{ marginBottom:7 }}>AI estimate</V3Kick>
          <V3H size={22}>Describe your meal</V3H>
        </div>
        <div style={{
          background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:18, padding:'13px 15px',
          minHeight:78, fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dimmer, lineHeight:1.5,
        }}>e.g. “2 rotis with butter chicken and a small bowl of raita”</div>
        <button onClick={() => onNav && onNav('replaceResult')} style={{
          width:'100%', padding:'15px 0', borderRadius:999, border:'none', cursor:'pointer', background:v3.lime, color:v3.ink,
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase',
        }}>Estimate with AI</button>
      </div>
    </V3Sheet>
  );
};

// ── Screen: AI result (breakdown + totals) ───────────────────
window.V3ReplaceResult = function V3ReplaceResult({ onNav }) {
  const breakdown = [
    { n:'Roti', portion:'2 medium, whole wheat', k:220, p:8, c:44, f:2, fi:6 },
    { n:'Butter chicken', portion:'1 katori with gravy', k:290, p:24, c:9, f:18, fi:1 },
    { n:'Raita', portion:'small bowl, cucumber', k:78, p:4, c:6, f:4, fi:1 },
  ];
  const totals = { k:588, p:36, c:59, f:24, fi:8 };
  return (
    <V3Sheet>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <V3SheetBack onClick={() => onNav && onNav('replaceAI')}/>
        <div>
          <V3Kick style={{ marginBottom:7 }}>AI estimate</V3Kick>
          <V3H size={22}>Describe your meal</V3H>
        </div>
        <div style={{
          background:v3.card, border:`1.5px solid ${v3.lineStrong}`, borderRadius:18, padding:'13px 15px',
          fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.text, lineHeight:1.5,
        }}>2 rotis with butter chicken and a small bowl of raita</div>

        <V3Card r={20} pad={13}>
          <V3Kick style={{ marginBottom:11 }}>Breakdown</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {breakdown.map((b, i) => (
              <div key={i} style={{ display:'flex', gap:10, paddingBottom:9, borderBottom: i < breakdown.length - 1 ? `1px solid ${v3.line}` : 'none' }}>
                <span style={{ fontSize:10, color:'#5F8C12', width:14, flexShrink:0, paddingTop:2 }}>·</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600 }}>
                    {b.n}<span style={{ fontWeight:500, color:v3.dim }}> — {b.portion}</span>
                  </div>
                  <V3Kick style={{ marginTop:4 }}>{b.k} kcal · P:{b.p}g · C:{b.c}g · F:{b.f}g · Fi:{b.fi}g</V3Kick>
                </div>
              </div>
            ))}
          </div>
        </V3Card>

        <V3Card r={22} pad={15}>
          <V3Kick style={{ marginBottom:9 }}>Total</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:29, fontWeight:700, letterSpacing:'-0.04em', color:'#5F8C12', lineHeight:1, marginBottom:12 }}>
            {totals.k}<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginLeft:6 }}>kcal</span>
          </div>
          <div style={{ display:'flex', gap:14, fontFamily:v3.sans, fontSize:12, fontWeight:800 }}>
            <span style={{ color:v3.protein }}>P:{totals.p}g</span>
            <span style={{ color:'#B0871C' }}>C:{totals.c}g</span>
            <span style={{ color:'#C4573A' }}>F:{totals.f}g</span>
            <span style={{ color:'#2F8C7C' }}>Fi:{totals.fi}g</span>
          </div>
        </V3Card>

        <V3Kick style={{ textAlign:'center', fontSize:7.5 }}>AI estimates — accuracy may vary ±20–25%</V3Kick>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onNav && onNav('meals')} style={{
            flex:1, padding:'14px 0', borderRadius:999, border:'none', cursor:'pointer', background:v3.lime, color:v3.ink,
            fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase',
          }}>Log this meal</button>
          <button onClick={() => onNav && onNav('replaceSearch')} style={{
            flex:1, padding:'14px 0', borderRadius:999, cursor:'pointer', background:'transparent',
            border:`1.5px solid ${v3.lineStrong}`, color:v3.dim,
            fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase',
          }}>Search manually</button>
        </div>
      </div>
    </V3Sheet>
  );
};

// ── Share recipe sheet (MealShareSheet.tsx) ──────────────────
window.V3ShareSheet = function V3ShareSheet({ onNav }) {
  const rows = [
    { icon:'↗', c:v3.dim, t:'Share via…', s:'WhatsApp, Messages, Email & more' },
    { icon:'🔊', c:'#5F8C12', t:'Share Audio Guide', s:'Send the mp3 file to WhatsApp, iMessage or any app' },
    { icon:'✉', c:'#25D366', t:'WhatsApp', s:'Send recipe + audio link' },
    { icon:'✈', c:'#2AABEE', t:'Telegram', s:'Send recipe + audio link' },
    { icon:'⎘', c:v3.dim, t:'Copy Instructions', s:'Copies text + audio link', last:true },
  ];
  return (
    <V3Scaffold nav={false} bg="rgba(15,20,15,0.55)" dark>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end' }}>
        <div style={{
          width:'100%', background:v3.paper, borderTopLeftRadius:28, borderTopRightRadius:28,
          borderTop:`1px solid ${v3.lineStrong}`, paddingBottom:12, color:v3.text,
        }}>
          <div style={{ padding:'18px 18px 13px', borderBottom:`1px solid ${v3.line}` }}>
            <V3Kick>Share recipe</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color:v3.dim, marginTop:5, lineHeight:1.3 }}>
              Tandoori Chicken Breast + Cucumber Raita
            </div>
          </div>
          <div style={{ padding:'0 18px' }}>
            {rows.map((r, i) => (
              <button key={i} onClick={() => onNav && onNav('mealInstructions')} style={{
                display:'flex', alignItems:'center', gap:14, padding:'13px 0', width:'100%',
                borderBottom: r.last ? 'none' : `1px solid ${v3.line}`,
                background:'none', border:'none', textAlign:'left', cursor:'pointer',
              }}>
                <div style={{
                  width:42, height:42, flexShrink:0, borderRadius:14, border:`1.5px solid ${v3.lineStrong}`,
                  background:v3.card, display:'grid', placeItems:'center', fontSize:17, color:r.c,
                }}>{r.icon}</div>
                <div>
                  <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, marginBottom:3 }}>{r.t}</div>
                  <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.dimmer }}>{r.s}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => onNav && onNav('mealInstructions')} style={{
            width:'100%', padding:'15px 0', background:'none', border:'none', borderTop:`1px solid ${v3.line}`, cursor:'pointer',
            fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.16em', color:v3.dimmer, textTransform:'uppercase',
          }}>Cancel</button>
        </div>
      </div>
    </V3Scaffold>
  );
};
