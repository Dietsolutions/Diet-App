// v3 — Recipes rebuilt from BrowseRecipesTab.tsx (browse grid, detail, save-to-plan)
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3IconBtn, V3Row } = window;

const V3_DIET_COLOR = { veg:'#2F8C7C', egg:'#C4573A', non_veg:'#5F8C12' };
const V3_MEAL_TYPES = ['All','Breakfast','Lunch','Snack','Dinner'];
const V3_DIET_TYPES = [['all','All'],['veg','Veg'],['egg','Egg'],['non_veg','Non-veg']];
const V3_SORTS = ['Most liked','Most popular','Highest protein','Highest fibre','Lowest calories','Newest'];
const V3_MACRO_RANGES = [
  { key:'Calories', max:1200, lo:0, hi:1200, color:'#5F8C12' },
  { key:'Protein', max:80, lo:25, hi:80, color:v3.protein },
  { key:'Carbs', max:150, lo:0, hi:150, color:'#B0871C' },
  { key:'Fat', max:60, lo:0, hi:60, color:'#C4573A' },
  { key:'Fibre', max:25, lo:0, hi:25, color:'#2F8C7C' },
];

const V3_RECIPES = [
  { id:'r1', n:'Paneer Tikka Masala', mt:'dinner', dt:'veg', cu:'North Indian', k:412, p:28, c:22, f:19, fb:6, plans:4, likes:214, liked:true },
  { id:'r2', n:'Moong Dal Chilla', mt:'breakfast', dt:'veg', cu:'North Indian', k:238, p:16, c:28, f:6, fb:8, plans:7, likes:186, liked:false },
  { id:'r3', n:'Chicken Chettinad', mt:'lunch', dt:'non_veg', cu:'South Indian', k:386, p:44, c:14, f:16, fb:4, plans:3, likes:301, liked:true },
  { id:'r4', n:'Greek Yogurt Bowl', mt:'snack', dt:'veg', cu:'Mediterranean', k:184, p:19, c:16, f:5, fb:3, plans:1, likes:97, liked:false },
  { id:'r5', n:'Egg Bhurji', mt:'breakfast', dt:'egg', cu:'North Indian', k:262, p:21, c:9, f:17, fb:2, plans:9, likes:143, liked:false },
  { id:'r6', n:'Grilled Fish Tikka', mt:'dinner', dt:'non_veg', cu:'Punjabi', k:298, p:46, c:6, f:10, fb:1, plans:2, likes:158, liked:false },
];

function V3DietDot({ dt }) {
  const c = V3_DIET_COLOR[dt] || v3.dim;
  return (
    <span style={{ width:12, height:12, borderRadius:3, border:`1.5px solid ${c}`, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ width:4, height:4, borderRadius:999, background:c }}/>
    </span>
  );
}

function V3Like({ liked, count, large }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, color: liked ? '#5F8C12' : v3.dim, fontFamily:v3.sans, fontSize: large ? 13 : 11, fontWeight:700, cursor:'pointer' }}>
      <svg width={large ? 17 : 13} height={large ? 17 : 13} viewBox="0 0 24 24" fill={liked ? '#5F8C12' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"/>
      </svg>
      {count}
    </span>
  );
}

function V3MacroPill({ label, v, color, bg }) {
  return <V3Chip bg={bg} color={color} size={9.5} pad="4px 8px">{label} {v}g</V3Chip>;
}

// ── Browse ───────────────────────────────────────────────────
window.V3Recipes = function V3Recipes({ onNav }) {
  const [mealType, setMealType] = React.useState('All');
  const [diet, setDiet] = React.useState('all');
  const [showMacros, setShowMacros] = React.useState(false);
  const [sort, setSort] = React.useState('Most liked');
  const macrosActive = true;
  return (
    <V3Scaffold tab="recipes" onNav={onNav}>
      <div style={{ padding:'18px 22px 0' }}>
        <V3Kick color="#5F8C12">Community library</V3Kick>
        <V3H size={30} style={{ marginTop:8 }}>Browse Recipes</V3H>
        <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, letterSpacing:'0.08em', color:v3.dimmer, marginTop:6, textTransform:'uppercase' }}>
          248 validated recipes from real plans
        </div>
      </div>

      {/* search */}
      <div style={{ padding:'16px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, background:v3.card, borderRadius:999, padding:'13px 18px' }}>
          <span style={{ color:v3.dimmer, fontSize:15 }}>⌕</span>
          <span style={{ flex:1, fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dimmer }}>Search recipes or ingredients…</span>
        </div>
      </div>

      {/* meal type row */}
      <div style={{ padding:'14px 22px 0', display:'flex', gap:7, overflowX:'auto' }}>
        {V3_MEAL_TYPES.map(t => (
          <button key={t} onClick={() => setMealType(t)} style={{
            border:'none', cursor:'pointer', borderRadius:999, padding:'9px 14px', flexShrink:0,
            background: mealType === t ? v3.lime : v3.card, color: mealType === t ? v3.ink : v3.dim,
            fontFamily:v3.sans, fontSize:11, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
          }}>{t}</button>
        ))}
      </div>

      {/* diet row + macros toggle */}
      <div style={{ padding:'9px 22px 0', display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
        {V3_DIET_TYPES.map(([id, label]) => {
          const on = diet === id;
          const c = V3_DIET_COLOR[id] || '#5F8C12';
          return (
            <button key={id} onClick={() => setDiet(id)} style={{
              cursor:'pointer', borderRadius:999, padding:'8px 12px', background:'transparent',
              border:`1.5px solid ${on ? c : v3.line}`, color: on ? c : v3.dimmer,
              fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
            }}>{label}</button>
          );
        })}
        <button onClick={() => setShowMacros(v => !v)} style={{
          marginLeft:'auto', cursor:'pointer', borderRadius:999, padding:'8px 12px', background:'transparent',
          border:`1.5px solid ${showMacros || macrosActive ? '#5F8C12' : v3.line}`, color: showMacros || macrosActive ? '#5F8C12' : v3.dimmer,
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.06em', textTransform:'uppercase',
        }}>Macros {macrosActive ? '●' : showMacros ? '▴' : '▾'}</button>
      </div>

      {/* macro range panel */}
      {showMacros && (
        <div style={{ padding:'12px 22px 0' }}>
          <V3Card r={24} pad={16}>
            <div style={{ display:'grid', gridTemplateColumns:'58px 1fr 62px', gap:10, marginBottom:12 }}>
              <span/><V3Kick>Min — Max</V3Kick><span/>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {V3_MACRO_RANGES.map(r => (
                <div key={r.key} style={{ display:'grid', gridTemplateColumns:'58px 1fr 62px', gap:10, alignItems:'center' }}>
                  <V3Kick color={r.color}>{r.key}</V3Kick>
                  <div style={{ position:'relative', height:20, display:'flex', alignItems:'center' }}>
                    <div style={{ height:4, borderRadius:999, background:'rgba(15,20,15,0.10)', width:'100%' }}/>
                    <div style={{ position:'absolute', left:`${(r.lo/r.max)*100}%`, right:`${100-(r.hi/r.max)*100}%`, height:4, borderRadius:999, background:r.color }}/>
                    <div style={{ position:'absolute', left:`calc(${(r.lo/r.max)*100}% - 7px)`, width:14, height:14, borderRadius:999, background:v3.card, border:`2px solid ${r.color}` }}/>
                    <div style={{ position:'absolute', left:`calc(${(r.hi/r.max)*100}% - 7px)`, width:14, height:14, borderRadius:999, background:v3.card, border:`2px solid ${r.color}` }}/>
                  </div>
                  <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, color:v3.dim, textAlign:'right' }}>
                    {r.lo}–{r.hi === r.max ? 'MAX' : r.hi}
                  </span>
                </div>
              ))}
            </div>
            <V3Btn small kind="light" full style={{ marginTop:14 }}>Clear macro filters</V3Btn>
          </V3Card>
        </div>
      )}

      {/* sort */}
      <div style={{ padding:'12px 22px 0', display:'flex', justifyContent:'flex-end' }}>
        <div style={{
          display:'flex', alignItems:'center', gap:7, background:v3.card, borderRadius:999, padding:'8px 14px',
          fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.06em', color:v3.dim, textTransform:'uppercase', cursor:'pointer',
        }}>{sort} <span style={{ color:v3.dimmer }}>▾</span></div>
      </div>

      {/* 2-column card grid */}
      <div style={{ padding:'14px 22px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
        {V3_RECIPES.map(r => (
          <V3Card key={r.id} r={22} pad={14} onClick={() => onNav && onNav('recipeDetail')} style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <V3Chip bg={v3.paper} size={9} pad="3px 8px" style={{ textTransform:'uppercase', letterSpacing:'0.06em' }}>{r.mt}</V3Chip>
              <V3DietDot dt={r.dt}/>
            </div>
            <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700, lineHeight:1.3, minHeight:36 }}>{r.n}</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:5 }}>
              <span style={{ fontFamily:v3.disp, fontSize:23, fontWeight:700, letterSpacing:'-0.04em', color:'#5F8C12' }}>{r.k}</span>
              <V3Kick>kcal</V3Kick>
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              <V3MacroPill label="P" v={r.p} color="#4C8526" bg="rgba(111,185,59,0.14)"/>
              <V3MacroPill label="C" v={r.c} color="#8A6410" bg="rgba(242,185,59,0.16)"/>
              <V3MacroPill label="F" v={r.f} color="#B3492C" bg="rgba(255,138,107,0.16)"/>
              {r.fb > 0 && <V3MacroPill label="FB" v={r.fb} color="#2F8C7C" bg="rgba(89,199,180,0.16)"/>}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:`1px solid ${v3.line}`, paddingTop:9, marginTop:'auto' }}>
              <V3Kick>{r.plans > 1 ? `In ${r.plans} plans` : 'New'}</V3Kick>
              <V3Like liked={r.liked} count={r.likes}/>
            </div>
          </V3Card>
        ))}
      </div>

      <div style={{ padding:'16px 22px 0' }}>
        <V3Btn kind="light" full small>Load more (6/248)</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Recipe detail ────────────────────────────────────────────
window.V3RecipeDetail = function V3RecipeDetail({ onNav }) {
  const r = { n:'Chicken Chettinad', mt:'lunch', dt:'non_veg', cu:'South Indian', prep:'45 min', plans:3, k:386, p:44, c:14, f:16, fb:4, likes:301, liked:true,
    desc:'A peppery Chettinad-style chicken built on roasted whole spices and coconut. Portion-corrected for a home kitchen and validated against three real plans.',
    ings:['Chicken thigh, boneless — 200 g','Shallots — 6, sliced','Tomato — 1, chopped','Fresh coconut — 2 tbsp','Black pepper — 1 tsp','Fennel seeds — 1 tsp','Curry leaves — 1 sprig','Coconut oil — 2 tsp'] };
  const max = Math.max(r.p, r.c, r.f, r.fb, 1);
  const macros = [['Protein', r.p, v3.protein], ['Carbs', r.c, '#B0871C'], ['Fat', r.f, '#C4573A'], ['Fibre', r.fb, '#2F8C7C']];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('recipes')} kick="Recipe" title={r.n}/>
      <div style={{ padding:'20px 22px 0', display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <V3Chip bg={v3.lime} size={10.5} style={{ textTransform:'uppercase', letterSpacing:'0.06em' }}>{r.mt}</V3Chip>
          <V3Chip bg="transparent" color={V3_DIET_COLOR[r.dt]} size={10.5} style={{ border:`1.5px solid ${V3_DIET_COLOR[r.dt]}`, textTransform:'uppercase', letterSpacing:'0.06em' }}>non-veg</V3Chip>
          <V3Chip bg={v3.card} size={10.5}>{r.cu}</V3Chip>
          <V3Chip bg={v3.card} size={10.5}>{r.prep}</V3Chip>
          <V3Chip bg={v3.card} size={10.5}>In {r.plans} plans</V3Chip>
        </div>

        <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, lineHeight:1.65 }}>{r.desc}</div>

        <V3Card r={26} pad={18}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:16 }}>
            <span style={{ fontFamily:v3.disp, fontSize:34, fontWeight:700, letterSpacing:'-0.045em', color:'#5F8C12' }}>{r.k}</span>
            <V3Kick>kcal per serving</V3Kick>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {macros.map(([label, v, c]) => (
              <div key={label} style={{ display:'grid', gridTemplateColumns:'56px 1fr 40px', gap:10, alignItems:'center' }}>
                <V3Kick color={c}>{label}</V3Kick>
                <V3Bar pct={v / max} h={6} color={c}/>
                <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, textAlign:'right' }}>{v}g</span>
              </div>
            ))}
          </div>
        </V3Card>

        <div>
          <V3Kick style={{ marginBottom:11 }}>Ingredients</V3Kick>
          <V3Card r={24} pad={0}>
            {r.ings.map((ing, i) => (
              <div key={i} style={{ padding:'12px 16px', borderBottom: i < r.ings.length - 1 ? `1px solid ${v3.line}` : 'none', fontFamily:v3.sans, fontSize:13, fontWeight:600 }}>{ing}</div>
            ))}
          </V3Card>
        </div>

        <div style={{ display:'flex', gap:9 }}>
          <V3Btn full onClick={() => onNav && onNav('saveToPlan')}>Save to my plan</V3Btn>
          <V3Btn kind="light">Share</V3Btn>
        </div>
        <div style={{ display:'flex', justifyContent:'center', paddingBottom:6 }}>
          <V3Like liked={r.liked} count={r.likes} large/>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Save to plan — 3-step modal ──────────────────────────────
window.V3SaveToPlan = function V3SaveToPlan({ onNav }) {
  const [step, setStep] = React.useState(3);
  const days = [{ l:'Day 1', k:1318 }, { l:'Day 2', k:1324 }, { l:'Day 3', k:1315 }];
  const meals = [
    { t:'Breakfast', n:'Oats with berries', k:268 }, { t:'Lunch', n:'Rajma + brown rice', k:388 },
    { t:'Snack', n:'Greek yogurt bowl', k:184 }, { t:'Dinner', n:'Grilled fish tikka', k:298 },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('recipeDetail')} kick="Save to my plan" title="Chicken Chettinad · 386 kcal"/>
      <div style={{ padding:'20px 22px 0' }}>
        <div style={{ display:'flex', gap:7, marginBottom:18 }}>
          {['1 · Day','2 · Meal','3 · Confirm'].map((s, i) => (
            <button key={s} onClick={() => setStep(i + 1)} style={{
              flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'10px 4px',
              background: step === i + 1 ? v3.ink : v3.card, color: step === i + 1 ? v3.lime : v3.dimmer,
              fontFamily:v3.sans, fontSize:11, fontWeight:700,
            }}>{s}</button>
          ))}
        </div>

        {step === 1 && (<>
          <V3Kick style={{ marginBottom:11 }}>1 · Pick a day</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {days.map((d, i) => (
              <V3Card key={i} r={20} pad={15} onClick={() => setStep(2)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{d.l}</span>
                  <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dim }}>{d.k} KCAL</span>
                </div>
              </V3Card>
            ))}
          </div>
        </>)}

        {step === 2 && (<>
          <V3Kick style={{ marginBottom:11 }}>2 · Pick the meal to replace</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {meals.map((m, i) => (
              <V3Card key={i} r={20} pad={15} onClick={() => setStep(3)}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:5 }}>
                  <V3Chip bg={v3.paper} size={9} pad="3px 8px" style={{ textTransform:'uppercase' }}>{m.t}</V3Chip>
                  <span style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, color:v3.dim }}>{m.k} KCAL</span>
                </div>
                <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{m.n}</div>
              </V3Card>
            ))}
          </div>
        </>)}

        {step === 3 && (<>
          <V3Kick style={{ marginBottom:11 }}>3 · Confirm the swap</V3Kick>
          <V3Card r={24} pad={18}>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.7 }}>
              Replacing <b style={{ color:v3.text }}>Grilled fish tikka</b> (298 kcal)<br/>
              with <b style={{ color:'#5F8C12' }}>Chicken Chettinad</b> (386 kcal)
            </div>
            <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${v3.line}`, fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dim }}>
              DAY 3 TOTAL: 1,315 → <span style={{ color:'#2F8C7C' }}>1,403 KCAL</span>
            </div>
          </V3Card>
          <V3Card bg="rgba(255,223,138,0.35)" r={20} pad={14} style={{ marginTop:11 }}>
            <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.text, lineHeight:1.5 }}>
              This is usually a lunch — save it to this Dinner slot anyway?
            </div>
          </V3Card>
          <V3Btn full style={{ marginTop:18 }} onClick={() => onNav && onNav('meals')}>Confirm swap</V3Btn>
        </>)}
      </div>
    </V3Scaffold>
  );
};
