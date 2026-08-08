// v3 core tabs — Meals, Tracker, Shopping, Learn, Profile
const { V3Scaffold, V3AppHeader, V3Title, V3SectionLabel, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3Ring, V3Check, V3IconBtn, V3Food, V3MacroTick, V3Row, V3Icon } = window;

// ── Meals / Today ────────────────────────────────────────────
window.V3Meals = function V3Meals({ onNav }) {
  const days = [
    { d:'M', n:20, eaten:4 }, { d:'T', n:21, eaten:4 }, { d:'W', n:22, eaten:3, today:true },
    { d:'T', n:23, eaten:0, future:true }, { d:'F', n:24, eaten:0, future:true },
    { d:'S', n:25, eaten:0, future:true }, { d:'S', n:26, eaten:0, future:true },
  ];
  const meals = [
    { type:'Breakfast', time:'07:30', name:'Masala Egg White Scramble + Paneer Bhurji', kcal:280, p:42, c:8, f:9, fi:4, eaten:true, tint:v3.butter },
    { type:'Lunch', time:'13:00', name:'Tandoori Chicken Breast + Cucumber Raita', kcal:360, p:55, c:12, f:10, fi:3, eaten:true, tint:v3.peach },
    { type:'Snack', time:'17:00', name:'Roasted Chana + Buttermilk', kcal:130, p:10, c:14, f:3, fi:5, eaten:true, swapped:true, tint:v3.lilac },
    { type:'Dinner', time:'20:00', name:'Grilled Fish + Sautéed Spinach + Tomato Soup', kcal:310, p:46, c:12, f:8, fi:6, eaten:false, tint:v3.mint },
  ];
  return (
    <V3Scaffold tab="meals" onNav={onNav}>
      <V3AppHeader hello="Good morning · Wed 22 Apr" name="Harshit" right={
        <div style={{ display:'flex', gap:8 }}>
          <V3Chip bg={v3.limeSoft} color={v3.ink}>🔥 12d</V3Chip>
          <V3IconBtn>♦</V3IconBtn>
        </div>}/>

      {/* week strip */}
      <div style={{ padding:'20px 22px 0', display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
        {days.map((d, i) => (
          <div key={i} style={{
            borderRadius:18, padding:'10px 0 8px', textAlign:'center', cursor:'pointer',
            background: d.today ? v3.ink : v3.card, opacity: d.future ? 0.45 : 1,
          }}>
            <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, color: d.today ? v3.onDarkDim : v3.dimmer }}>{d.d}</div>
            <div style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', marginTop:2, color: d.today ? v3.lime : v3.text }}>{d.n}</div>
            <div style={{ display:'flex', gap:2, justifyContent:'center', marginTop:5 }}>
              {[0,1,2,3].map(k => <div key={k} style={{ width:4, height:4, borderRadius:999, background: k < d.eaten ? (d.today ? v3.lime : v3.limeDeep) : (d.today ? 'rgba(246,247,243,0.2)' : 'rgba(15,20,15,0.12)') }}/>)}
            </div>
          </div>
        ))}
      </div>

      {/* kcal hero — lime card */}
      <div style={{ padding:'14px 22px 0' }}>
        <V3Card bg={v3.lime} r={32} pad={20}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <V3Kick color="rgba(15,20,15,0.5)">Today · 3 of 4 eaten</V3Kick>
            <V3Chip bg="rgba(15,20,15,0.10)" color={v3.ink} size={10.5}>On pace</V3Chip>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:18, marginTop:12 }}>
            <V3Ring pct={970/1320} size={132} thick={13} color={v3.ink} track="rgba(15,20,15,0.14)">
              <div>
                <div style={{ fontFamily:v3.disp, fontSize:32, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1 }}>970</div>
                <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, color:'rgba(15,20,15,0.55)', marginTop:3 }}>350 left</div>
              </div>
            </V3Ring>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:11 }}>
              <V3MacroTick color={v3.ink} value="143" label="g protein" sub="of 165 g"/>
              <V3MacroTick color="rgba(15,20,15,0.55)" value="34" label="g carbs" sub="of 60 g"/>
              <V3MacroTick color="rgba(15,20,15,0.35)" value="27" label="g fat" sub="of 45 g"/>
              <V3MacroTick color="rgba(15,20,15,0.2)" value="14" label="g fibre" sub="of 25 g"/>
            </div>
          </div>
        </V3Card>
      </div>

      {/* water */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card bg={v3.sky} r={24} pad={16} onClick={() => onNav && onNav('water')}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <V3Kick color="rgba(15,20,15,0.5)">Hydration</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.035em', marginTop:5 }}>
                1.8<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:'rgba(15,20,15,0.55)' }}> / 3.0 L · 60%</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:4, alignItems:'flex-end' }}>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{ width:11, height: 30, borderRadius:'4px 4px 7px 7px', background: i <= 5 ? v3.ink : 'rgba(15,20,15,0.14)' }}/>
              ))}
            </div>
          </div>
        </V3Card>
      </div>

      {/* meal list */}
      <div style={{ padding:'24px 0 0' }}>
        <V3SectionLabel action="Shopping list →">Today’s plan</V3SectionLabel>
        <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', gap:10 }}>
          {meals.map((m, i) => (
            <V3Card key={i} r={24} pad={15} onClick={() => onNav && onNav('meal')} bg={m.eaten ? v3.card : v3.card} border={m.eaten ? 'transparent' : v3.lineStrong}>
              <div style={{ display:'flex', gap:13, alignItems:'flex-start' }}>
                <V3Food size={50} tint={m.tint} glyph={i === 3 ? 'leaf' : 'bowl'}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <V3Kick color={v3.dimmer}>{m.type} · {m.time}</V3Kick>
                    {m.swapped && <V3Chip bg={v3.limeSoft} color={v3.ink} size={9} pad="3px 7px">↻ Swapped</V3Chip>}
                  </div>
                  <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, letterSpacing:'-0.015em', lineHeight:1.3, marginTop:5, color: m.eaten ? v3.dim : v3.text }}>{m.name}</div>
                  <div style={{ display:'flex', gap:6, marginTop:9, flexWrap:'wrap' }}>
                    <V3Chip bg={v3.paper} size={10} pad="4px 9px">{m.kcal} kcal</V3Chip>
                    <V3Chip bg="rgba(111,185,59,0.14)" color="#4C8526" size={10} pad="4px 9px">P {m.p}</V3Chip>
                    <V3Chip bg="rgba(242,185,59,0.16)" color="#8A6410" size={10} pad="4px 9px">C {m.c}</V3Chip>
                    <V3Chip bg="rgba(255,138,107,0.16)" color="#B3492C" size={10} pad="4px 9px">F {m.f}</V3Chip>
                  </div>
                </div>
                <V3Check on={m.eaten} size={26}/>
              </div>
            </V3Card>
          ))}
          <V3Btn kind="ghost" full onClick={() => onNav && onNav('addMeal')} style={{ borderStyle:'dashed', color:v3.text, marginTop:2 }}>+ Log an extra meal</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Tracker ──────────────────────────────────────────────────
const V3_METRICS = {
  kcal:    { label:'Calories', unit:'kcal', target:1320, avg:1265, color:v3.lime,    series:[1180,1290,1120,1340,1220,1380,1260,1180,1410,1290,1340,1200,1370,1290], delta:'−55 / day', good:true },
  protein: { label:'Protein',  unit:'g',    target:165,  avg:158,  color:v3.protein, series:[142,160,155,170,148,172,162,155,175,168,160,150,168,165], delta:'−7 / day', good:false },
  carbs:   { label:'Carbs',    unit:'g',    target:60,   avg:54,   color:v3.carbs,   series:[52,61,48,55,50,62,56,49,58,55,51,48,57,54], delta:'−6 / day', good:true },
  fat:     { label:'Fat',      unit:'g',    target:45,   avg:42,   color:v3.fat,     series:[38,46,40,48,41,44,43,38,50,44,42,39,47,42], delta:'−3 / day', good:true },
  fibre:   { label:'Fibre',    unit:'g',    target:25,   avg:22,   color:v3.fibre,   series:[18,24,20,26,21,25,23,19,27,24,22,20,25,22], delta:'−3 / day', good:false },
  water:   { label:'Water',    unit:'L',    target:3.0,  avg:2.4,  color:v3.water,   series:[2.1,2.6,1.8,2.8,2.2,2.7,2.4,2.0,2.9,2.5,2.3,2.1,2.6,2.4], delta:'−0.6 / day', good:false },
  adh:     { label:'Adherence',unit:'%',    target:100,  avg:87,   color:v3.lilac,   series:[75,100,50,100,100,75,100,100,100,100,75,100,50,100], delta:'+12% vs prev', good:true },
};
window.V3_METRICS = V3_METRICS;

window.V3Tracker = function V3Tracker({ onNav }) {
  const [metric, setMetric] = React.useState('kcal');
  const m = V3_METRICS[metric];
  const W = 300, H = 104, PT = 10, PB = 10;
  const max = Math.max(m.target, ...m.series) * 1.06, min = Math.max(0, Math.min(...m.series) * 0.86);
  const xs = m.series.map((_, i) => (i / (m.series.length - 1)) * W);
  const ys = m.series.map(v => H - PB - ((v - min) / (max - min)) * (H - PT - PB));
  const tY = H - PB - ((m.target - min) / (max - min)) * (H - PT - PB);
  const line = xs.map((x, i) => `${i ? 'L' : 'M'} ${x} ${ys[i]}`).join(' ');
  const weeks = [[100,75,100,50,100,100,75],[100,100,100,100,75,100,50],[100,75,100,75,100,75,null],[null,null,null,null,null,null,null]];

  return (
    <V3Scaffold tab="tracker" onNav={onNav}>
      <V3Title kick="April 2026" title="Tracker" right={<V3IconBtn bg={v3.card}>▤</V3IconBtn>}/>

      <div style={{ padding:'20px 22px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          { k:'This week', v:'93', u:'%', sub:'26 / 28 meals', bg:v3.mint },
          { k:'This month', v:'87', u:'%', sub:'73 / 84 meals', bg:v3.butter },
          { k:'Goal ETA', v:'6', u:'w', sub:'03 Jun 26', bg:v3.peach },
        ].map((x, i) => (
          <V3Card key={i} bg={x.bg} r={20} pad={14}>
            <V3Kick color="rgba(15,20,15,0.5)">{x.k}</V3Kick>
            <div style={{ fontFamily:v3.disp, fontSize:30, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1, marginTop:8 }}>
              {x.v}<span style={{ fontSize:14 }}>{x.u}</span>
            </div>
            <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:600, color:'rgba(15,20,15,0.5)', marginTop:5 }}>{x.sub}</div>
          </V3Card>
        ))}
      </div>

      {/* metric chart on dark */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card bg={v3.ink} r={30} pad={18}>
          <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2, marginBottom:16 }}>
            {Object.keys(V3_METRICS).map(k => {
              const on = k === metric;
              return (
                <button key={k} onClick={() => setMetric(k)} style={{
                  border:'none', cursor:'pointer', borderRadius:999, padding:'7px 13px', flexShrink:0,
                  background: on ? V3_METRICS[k].color : 'rgba(246,247,243,0.09)',
                  color: on ? v3.ink : v3.onDarkDim, fontFamily:v3.sans, fontSize:11.5, fontWeight:700,
                }}>{V3_METRICS[k].label}</button>
              );
            })}
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
            <div>
              <V3Kick color={v3.onDarkDimmer}>Daily average · 14 days</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:40, fontWeight:700, letterSpacing:'-0.045em', color:v3.onDark, lineHeight:1, marginTop:7 }}>
                {m.avg}<span style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, color:v3.onDarkDim, marginLeft:5 }}>{m.unit}</span>
              </div>
            </div>
            <V3Chip bg={m.good ? 'rgba(198,242,78,0.16)' : 'rgba(229,72,77,0.18)'} color={m.good ? v3.lime : '#FF8A8D'} size={10.5}>
              {m.good ? '▼' : '▲'} {m.delta}
            </V3Chip>
          </div>
          <div style={{ height:H, marginTop:14 }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs><linearGradient id={`v3g_${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity="0.4"/><stop offset="100%" stopColor={m.color} stopOpacity="0"/>
              </linearGradient></defs>
              <line x1="0" y1={tY} x2={W} y2={tY} stroke="rgba(246,247,243,0.28)" strokeDasharray="3,4" strokeWidth="0.7"/>
              <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#v3g_${metric})`}/>
              <path d={line} fill="none" stroke={m.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
              <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3.4" fill={m.color}/>
            </svg>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:v3.sans, fontSize:10, fontWeight:600, color:v3.onDarkDimmer }}>
            <span>09 Apr</span><span>Target {m.target}{m.unit}</span><span>22 Apr</span>
          </div>
        </V3Card>
      </div>

      {/* adherence calendar */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={16}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
            <V3Kick>Plan adherence · April</V3Kick>
            <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, color:v3.limeDeep, cursor:'pointer' }} onClick={() => onNav && onNav('kcal')}>Monthly kcal →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:6 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} style={{ textAlign:'center', fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.dimmer }}>{d}</div>)}
          </div>
          {weeks.map((w, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:5 }}>
              {w.map((val, j) => (
                <div key={j} style={{
                  aspectRatio:'1', borderRadius:11, position:'relative', overflow:'hidden',
                  background: val == null ? 'rgba(15,20,15,0.04)' : val === 100 ? v3.lime : `rgba(198,242,78,${0.25 + val/100*0.5})`,
                  display:'grid', placeItems:'center',
                }}>
                  <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, color: val == null ? v3.dimmer : v3.ink }}>{i*7+j+1}</span>
                </div>
              ))}
            </div>
          ))}
        </V3Card>
      </div>

      {/* selected day */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={18}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <V3Kick>Day 17 of 49</V3Kick>
              <V3H size={22} style={{ marginTop:6 }}>Wednesday, 22 Apr</V3H>
            </div>
            <V3Chip bg={v3.limeSoft}>3 / 4 eaten</V3Chip>
          </div>
          <div style={{ marginTop:16, display:'flex', justifyContent:'space-between', fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dim, marginBottom:7 }}>
            <span>Meals logged</span><span>75%</span>
          </div>
          <V3Bar pct={0.75} h={9}/>
          <div style={{ display:'flex', gap:9, marginTop:16 }}>
            <V3Btn small onClick={() => onNav && onNav('meals')}>View plan</V3Btn>
            <V3Btn small kind="light">Mark all eaten</V3Btn>
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Shopping ─────────────────────────────────────────────────
const v3Qty = (base, unit, mult) => {
  const v = base * mult;
  if (unit === 'kg' || unit === 'g') {
    const g = unit === 'kg' ? v * 1000 : v;
    return g >= 1000 ? `${(Math.round(g / 10) / 100).toString().replace(/\.?0+$/, '')} kg` : `${Math.round(g)} g`;
  }
  if (unit === 'L' || unit === 'ml') {
    const ml = unit === 'L' ? v * 1000 : v;
    return ml >= 1000 ? `${(Math.round(ml / 10) / 100).toString().replace(/\.?0+$/, '')} L` : `${Math.round(ml)} ml`;
  }
  return unit ? `${Math.ceil(v)} ${unit}` : `${Math.ceil(v)}`;
};

window.V3Shopping = function V3Shopping({ onNav }) {
  const [people, setPeople] = React.useState(1);
  const clamp = n => Math.max(1, Math.min(12, n));
  const cats = [
    { name:'Protein', tint:v3.peach, items:[
      { n:'Chicken breast', q:1.2, u:'kg', b:true }, { n:'Eggs', q:30, u:'', b:true }, { n:'Paneer', q:400, u:'g', b:true },
      { n:'Fish fillet', q:800, u:'g', b:false }, { n:'Greek yogurt', q:1, u:'kg', b:false },
    ]},
    { name:'Produce', tint:v3.mint, items:[
      { n:'Spinach', q:500, u:'g', b:true }, { n:'Tomato', q:1, u:'kg', b:true }, { n:'Onion', q:1, u:'kg', b:false },
      { n:'Cucumber', q:4, u:'', b:false }, { n:'Capsicum', q:3, u:'', b:false }, { n:'Broccoli', q:500, u:'g', b:false },
    ]},
    { name:'Pantry', tint:v3.butter, items:[
      { n:'Roasted chana', q:500, u:'g', b:true }, { n:'Makhana', q:200, u:'g', b:true },
      { n:'Mixed nuts', q:250, u:'g', b:true }, { n:'Chia seeds', q:100, u:'g', b:true },
    ]},
  ];
  const total = cats.reduce((a, c) => a + c.items.length, 0);
  const bought = cats.reduce((a, c) => a + c.items.filter(i => i.b).length, 0);
  const Step = ({ children, onClick, off }) => (
    <button onClick={onClick} disabled={off} style={{
      width:38, height:38, borderRadius:999, background: off ? 'rgba(15,20,15,0.05)' : v3.card,
      border:`1px solid ${off ? 'transparent' : v3.lineStrong}`, color: off ? v3.dimmer : v3.text,
      fontFamily:v3.sans, fontSize:18, fontWeight:700, cursor: off ? 'default' : 'pointer',
    }}>{children}</button>
  );

  return (
    <V3Scaffold tab="shopping" onNav={onNav}>
      <V3Title kick={`Week 03 · ${total} items`} title="Shopping" right={
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:v3.disp, fontSize:32, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1 }}>
            {bought}<span style={{ color:v3.dimmer }}>/{total}</span>
          </div>
          <V3Kick style={{ marginTop:4 }}>Bought</V3Kick>
        </div>}/>

      <div style={{ padding:'18px 22px 0' }}><V3Bar pct={bought/total} h={10} striped/></div>

      {/* people multiplier */}
      <div style={{ padding:'16px 22px 0' }}>
        <V3Card bg={v3.cream} r={26} pad={16}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div>
              <V3Kick color={v3.panelDim}>Shopping for</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:700, color:v3.text, marginTop:6 }}>Quantities scale ×{people}</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:v3.dim, marginTop:2 }}>Cooking for a family or a cook</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Step onClick={() => setPeople(p => clamp(p - 1))} off={people <= 1}>−</Step>
              <div style={{ minWidth:52, textAlign:'center' }}>
                <div style={{ fontFamily:v3.disp, fontSize:30, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1 }}>{people}</div>
                <div style={{ fontFamily:v3.sans, fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:v3.dimmer, marginTop:3 }}>{people === 1 ? 'Person' : 'People'}</div>
              </div>
              <Step onClick={() => setPeople(p => clamp(p + 1))} off={people >= 12}>+</Step>
            </div>
          </div>
        </V3Card>
      </div>

      <div style={{ padding:'20px 22px 0', display:'flex', flexDirection:'column', gap:12 }}>
        {cats.map((c, ci) => {
          const done = c.items.filter(i => i.b).length;
          return (
            <V3Card key={ci} r={26} pad={16}>
              <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
                <div style={{ width:9, height:9, borderRadius:999, background:c.tint }}/>
                <V3Kick color={v3.text}>{c.name}</V3Kick>
                <span style={{ marginLeft:'auto', fontFamily:v3.sans, fontSize:11, fontWeight:700, color: done === c.items.length ? v3.limeDeep : v3.dimmer }}>{done}/{c.items.length}</span>
              </div>
              {c.items.map((it, ii) => (
                <div key={ii} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom: ii === c.items.length - 1 ? 'none' : `1px solid ${v3.line}` }}>
                  <V3Check on={it.b} size={22}/>
                  <span style={{ flex:1, fontFamily:v3.sans, fontSize:13.5, fontWeight:600, color: it.b ? v3.dimmer : v3.text, textDecoration: it.b ? 'line-through' : 'none' }}>{it.n}</span>
                  <span style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:700, color: it.b ? v3.dimmer : (people > 1 ? v3.limeDeep : v3.dim) }}>{v3Qty(it.q, it.u, people)}</span>
                </div>
              ))}
            </V3Card>
          );
        })}
        <V3Btn kind="dark" full>Share list</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Learn / Tips ─────────────────────────────────────────────
window.V3Tips = function V3Tips({ onNav }) {
  const tips = [
    { t:'Protein first', k:'Satiety', bg:v3.mint, b:'Start every meal with your protein source. It triggers satiety earlier and protects lean mass in a deficit.' },
    { t:'Hydrate before coffee', k:'Habit', bg:v3.sky, b:'500 ml of water on wake-up blunts cortisol spikes and reduces false hunger through the morning.' },
    { t:'Sleep beats a workout', k:'Recovery', bg:v3.lilac, b:'7+ hours nightly correlates with 55% more fat loss vs. matched calories with poor sleep. Non-negotiable.' },
    { t:'Weigh weekly, track trend', k:'Metrics', bg:v3.butter, b:'Daily weight is noise. A 7-day rolling average is the only number worth acting on.' },
    { t:'Plate ratio 1:1:2', k:'Plate', bg:v3.peach, b:'One palm of protein, one palm of carbs, two palms of veg. Works without weighing anything.' },
  ];
  return (
    <V3Scaffold tab="tips" onNav={onNav}>
      <V3Title kick="Knowledge base · 12 articles" title="Learn"/>

      <div style={{ padding:'20px 22px 0' }}>
        <V3Card bg={v3.ink} r={30} pad={18} onClick={() => onNav && onNav('mealPrep')}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <V3Chip bg={v3.lime} color={v3.ink} size={10.5}>Featured</V3Chip>
            <V3IconBtn bg={v3.lime} color={v3.ink} size={38}>↗</V3IconBtn>
          </div>
          <V3H size={26} color={v3.onDark} style={{ marginTop:16 }}>Sunday batch protocol</V3H>
          <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.onDarkDim, marginTop:8, lineHeight:1.55 }}>
            Cook the week in 90 minutes. Saves about 5 hours across the week and removes every “what’s for dinner” decision.
          </div>
          <div style={{ display:'flex', gap:7, marginTop:14 }}>
            <V3Chip bg="rgba(246,247,243,0.10)" color={v3.onDark} size={10}>90 min</V3Chip>
            <V3Chip bg="rgba(246,247,243,0.10)" color={v3.onDark} size={10}>8 steps</V3Chip>
            <V3Chip bg="rgba(246,247,243,0.10)" color={v3.onDark} size={10}>Saves 5 h</V3Chip>
          </div>
        </V3Card>
      </div>

      <div style={{ padding:'24px 0 0' }}>
        <V3SectionLabel>Principles</V3SectionLabel>
        <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', gap:10 }}>
          {tips.map((tip, i) => (
            <V3Card key={i} bg={tip.bg} r={26} pad={18}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <V3Chip bg="rgba(255,255,255,0.55)" size={10}>{String(i+1).padStart(2,'0')} · {tip.k}</V3Chip>
                <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, color:'rgba(15,20,15,0.45)' }}>3 min read</span>
              </div>
              <V3H size={22} style={{ marginTop:14 }}>{tip.t}</V3H>
              <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:'rgba(15,20,15,0.65)', marginTop:8, lineHeight:1.55 }}>{tip.b}</div>
            </V3Card>
          ))}
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Profile ──────────────────────────────────────────────────
window.V3Profile = function V3Profile({ onNav }) {
  const pts = [72.2,72.0,71.9,71.6,71.4,71.5,71.2,70.8,70.6,70.3,70.1,69.8];
  const min = 69.5, max = 72.5;
  const xy = pts.map((v, i) => [(i/(pts.length-1))*300, 74 - ((v-min)/(max-min))*62]);
  const path = xy.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
  return (
    <V3Scaffold tab="profile" onNav={onNav} bg={v3.cream}>
      <div style={{ padding:'16px 22px 0', display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ width:62, height:62, borderRadius:999, background:v3.lime, display:'grid', placeItems:'center', fontFamily:v3.disp, fontSize:26, fontWeight:700, color:v3.ink }}>H</div>
        <div style={{ flex:1 }}>
          <V3H size={26}>Harshit</V3H>
          <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginTop:3 }}>Member 94 days · high protein</div>
        </div>
        <V3IconBtn bg={v3.card}>⚙</V3IconBtn>
      </div>

      {/* weight hero */}
      <div style={{ padding:'18px 22px 0' }}>
        <V3Card r={30} pad={18}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <V3Kick>Weight · latest</V3Kick>
              <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:8 }}>
                <div style={{ fontFamily:v3.disp, fontSize:56, fontWeight:700, letterSpacing:'-0.05em', lineHeight:0.9 }}>69.8</div>
                <span style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, color:v3.dim }}>kg</span>
              </div>
            </div>
            <V3Chip bg={v3.limeSoft} size={11}>↓ 2.4 kg · 28d</V3Chip>
          </div>
          <div style={{ height:78, marginTop:10 }}>
            <svg width="100%" height="100%" viewBox="0 0 300 78" preserveAspectRatio="none">
              <defs><linearGradient id="v3wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={v3.limeDeep} stopOpacity="0.35"/><stop offset="100%" stopColor={v3.limeDeep} stopOpacity="0"/></linearGradient></defs>
              <path d={`${path} L 300 78 L 0 78 Z`} fill="url(#v3wg)"/>
              <path d={path} fill="none" stroke={v3.limeDeep} strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
              <circle cx={xy[xy.length-1][0]} cy={xy[xy.length-1][1]} r="3.4" fill={v3.limeDeep}/>
            </svg>
          </div>
          <V3Btn kind="light" full small onClick={() => onNav && onNav('weightLog')} style={{ marginTop:6 }}>+ Log today’s weight</V3Btn>
        </V3Card>
      </div>

      {/* goal */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card bg={v3.lime} r={26} pad={18}>
          <V3Kick color="rgba(15,20,15,0.5)">Goal · 68 kg</V3Kick>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginTop:10 }}>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:40, fontWeight:700, letterSpacing:'-0.045em', lineHeight:1 }}>
                42<span style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, marginLeft:6 }}>days to go</span>
              </div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:'rgba(15,20,15,0.6)', marginTop:6 }}>Est. 03 Jun 2026 · 1.8 kg left</div>
            </div>
            <V3Chip bg={v3.ink} color={v3.lime} size={10.5}>▲ On track</V3Chip>
          </div>
        </V3Card>
      </div>

      {/* body + targets */}
      <div style={{ padding:'12px 22px 0', display:'flex', flexDirection:'column', gap:12 }}>
        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:4 }}>Body</V3Kick>
          <V3Row label="Height" value="176 cm"/>
          <V3Row label="BMI" value="22.5" color={v3.limeDeep}/>
          <V3Row label="Body fat" value="18.2 %"/>
          <V3Row label="RMR" value="1,610 kcal/d" last/>
        </V3Card>
        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:4 }}>Daily targets</V3Kick>
          <V3Row label="Calories" value="1,320 kcal"/>
          <V3Row label="Protein" value="165 g" color={v3.protein}/>
          <V3Row label="Carbs" value="60 g" color="#B0871C"/>
          <V3Row label="Fat" value="45 g" color="#C4573A"/>
          <V3Row label="Fibre" value="25 g" color="#2F8C7C" last/>
        </V3Card>
        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:4 }}>Preferences</V3Kick>
          <V3Row label="Diet" value="High protein · Indian"/>
          <V3Row label="Cuisines" value="Indian, Mediterranean"/>
          <V3Row label="Meals per day" value="4"/>
          <V3Row label="Intensity" value="Aggressive" color={v3.warn}/>
          <V3Row label="Activity" value="Moderate"/>
          <V3Row label="Recipe language" value="English" chevron last/>
        </V3Card>
      </div>

      {/* plan duration */}
      <div style={{ padding:'22px 0 0' }}>
        <V3SectionLabel>Plan duration</V3SectionLabel>
        <div style={{ padding:'0 22px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
          {[{ d:'7-day', s:'One week' }, { d:'14-day', s:'Max variety', on:true }].map((o, i) => (
            <V3Card key={i} r={22} pad={16} bg={o.on ? v3.ink : v3.card} style={{ position:'relative' }}>
              {o.on && <V3Chip bg={v3.lime} size={9} pad="3px 8px" style={{ position:'absolute', top:-9, right:12 }}>Recommended</V3Chip>}
              <div style={{ fontFamily:v3.disp, fontSize:19, fontWeight:700, letterSpacing:'-0.03em', color: o.on ? v3.lime : v3.text }}>{o.d}</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color: o.on ? v3.onDarkDim : v3.dim, marginTop:4 }}>{o.s}</div>
            </V3Card>
          ))}
        </div>
      </div>

      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <V3Btn kind="dark" full onClick={() => onNav && onNav('customise')}>Customise plan</V3Btn>
        <V3Btn full onClick={() => onNav && onNav('regenConfirm')}>Regenerate plan</V3Btn>
        <V3Btn kind="warn" full>Log out</V3Btn>
      </div>
    </V3Scaffold>
  );
};
