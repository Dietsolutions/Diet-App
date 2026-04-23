// Core tabs: Meals (Today), Tracker, Profile, Shopping, Tips
const { S2Scaffold, S2SectionTitle, S2Card, S2Bar, S2VBar, S2Check, S2Placeholder, s2HairLabel, s2DataRow, s2Pill, s2Btn } = window;

// ─── Meals tab ────────────────────────────────────────────────
window.S2Meals = function Meals({ onNav }) {
  const s2 = window.s2;
  const days = [
    { d:'M', n:20, eaten:4, isToday:false },
    { d:'T', n:21, eaten:4, isToday:false },
    { d:'W', n:22, eaten:3, isToday:true },
    { d:'T', n:23, eaten:0, isToday:false, future:true },
    { d:'F', n:24, eaten:0, isToday:false, future:true },
    { d:'S', n:25, eaten:0, isToday:false, future:true },
    { d:'S', n:26, eaten:0, isToday:false, future:true },
  ];
  const meals = [
    { icon:'01', type:'BREAKFAST', time:'07:30', name:'Masala Egg White Scramble + Paneer Bhurji', desc:'Spiced egg whites and soft paneer scramble with cumin, turmeric, and green chilli', kcal:280, p:42, c:8, f:9, fi:4, eaten:true },
    { icon:'02', type:'LUNCH', time:'13:00', name:'Tandoori Chicken Breast + Cucumber Raita', desc:'Marinated tandoori chicken with cool raita and lightly stir-fried cabbage', kcal:360, p:55, c:12, f:10, fi:3, eaten:true },
    { icon:'03', type:'SNACK', time:'17:00', name:'Roasted Chana + Buttermilk', desc:'Crunchy roasted chickpeas with a glass of spiced buttermilk', kcal:130, p:10, c:14, f:3, fi:5, eaten:true, replaced:true },
    { icon:'04', type:'DINNER', time:'20:00', name:'Grilled Fish + Sautéed Spinach + Tomato Soup', desc:'Lemon-herb grilled fish with wilted spinach and a light tomato broth', kcal:310, p:46, c:12, f:8, fi:6, eaten:false },
  ];

  return (
    <S2Scaffold tab="meals" onNav={onNav}>
      <S2SectionTitle kicker="WEEK 03 · APR 2026" title="Meals"
        right={<s2Pill color={s2.accent}>STREAK 12d</s2Pill>}/>

      {/* Week strip */}
      <div style={{ padding:'18px 20px 0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6 }}>
          {days.map((d, i) => (
            <button key={i} disabled={d.future} style={{
              cursor: d.future ? 'default' : 'pointer',
              background: d.isToday ? s2.accentFill : 'transparent',
              border: `1px solid ${d.isToday ? s2.accent : s2.line}`,
              padding:'8px 4px',
              opacity: d.future ? 0.35 : 1,
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            }}>
              <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, letterSpacing:'0.1em' }}>{d.d}</div>
              <div style={{ fontFamily: s2.sans, fontSize: 18, fontWeight: 400, color: d.isToday ? s2.accent : s2.text, letterSpacing:'-0.02em' }}>{d.n}</div>
              <div style={{ display:'flex', gap:2 }}>
                {[0,1,2,3].map(k => <div key={k} style={{ width:3, height:3, background: k < d.eaten ? s2.accent : s2.line }}/>)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Date header */}
      <div style={{ padding:'22px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <s2HairLabel>DAY 17 OF 49 · WEDNESDAY</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, marginTop: 4, letterSpacing:'-0.02em' }}>22 April</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 300, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1 }}>3<span style={{ color: s2.textDim, fontSize: 16 }}>/4</span></div>
          <s2HairLabel style={{ marginTop:2 }}>EATEN</s2HairLabel>
        </div>
      </div>

      {/* Water card */}
      <div style={{ padding:'18px 20px 0' }}>
        <S2Card onClick={() => onNav && onNav('water')} padding={14}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <s2HairLabel>HYDRATION · 1.8 / 3.0 L</s2HairLabel>
              <div style={{ fontFamily: s2.sans, fontSize: 20, fontWeight: 400, marginTop: 4, letterSpacing:'-0.01em' }}>60%</div>
            </div>
            <div style={{ display:'flex', gap:3 }}>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{
                  width: 12, height: 26,
                  background: i <= 5 ? s2.accent : 'transparent',
                  border: `1px solid ${i <= 5 ? s2.accent : s2.lineStrong}`,
                }}/>
              ))}
            </div>
          </div>
          <div style={{ height: 10 }}/>
          <S2Bar pct={0.6} color={s2.accent} h={2}/>
        </S2Card>
      </div>

      {/* Macro achievement mini */}
      <div style={{ padding:'12px 20px 0' }}>
        <S2Card padding={14}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 10 }}>
            <s2HairLabel>MACRO LOAD · 970 / 1,320 kcal</s2HairLabel>
            <s2HairLabel color={s2.accent}>73%</s2HairLabel>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {[
              { k:'P', label:'PROTEIN', v:143, t:165, c: s2.protein },
              { k:'C', label:'CARBS',   v:34,  t:60,  c: s2.carbs },
              { k:'F', label:'FAT',     v:27,  t:45,  c: s2.fat },
              { k:'Fi',label:'FIBRE',   v:14,  t:25,  c: s2.fibre },
            ].map(m => (
              <div key={m.k} style={{ flex:1 }}>
                <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.text }}>
                  {m.v}<span style={{ color: s2.textDimmer }}>/{m.t}g</span>
                </div>
                <div style={{ height:6 }}/>
                <S2Bar pct={m.v/m.t} color={m.c} h={3}/>
                <div style={{ height:4 }}/>
                <s2HairLabel color={m.c} style={{ fontSize: 8 }}>{m.label}</s2HairLabel>
              </div>
            ))}
          </div>
        </S2Card>
      </div>

      {/* Meal list */}
      <div style={{ padding:'18px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>TODAY'S PLAN</s2HairLabel>
        {meals.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <S2Card onClick={() => onNav && onNav('meal')} padding={14}
              style={m.replaced ? { borderColor: s2.accentSoft, background:'rgba(255,176,102,0.04)' } : m.eaten ? { background: s2.accentFill } : {}}>
              <div style={{ display:'flex', gap: 12 }}>
                <div style={{ fontFamily: s2.mono, fontSize: 11, color: m.eaten ? s2.accent : s2.textDim, width: 24, paddingTop: 2 }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <s2HairLabel color={m.eaten ? s2.accent : s2.textDim}>{m.type} · {m.time}</s2HairLabel>
                    {m.replaced && <s2HairLabel color={s2.accentSoft}>↻ SWAPPED</s2HairLabel>}
                  </div>
                  <div style={{
                    fontFamily: s2.sans, fontSize: 14, fontWeight: 500, marginTop: 4, lineHeight: 1.3,
                    color: m.eaten ? s2.textDim : s2.text,
                    textDecoration: m.eaten ? 'line-through' : 'none',
                  }}>{m.name}</div>
                  <div style={{ marginTop: 8, display:'flex', gap:12, fontFamily: s2.mono, fontSize: 10, color: s2.textDim }}>
                    <span>{m.kcal} <span style={{ color: s2.textDimmer }}>kcal</span></span>
                    <span style={{ color: s2.protein }}>P{m.p}</span>
                    <span style={{ color: s2.carbs }}>C{m.c}</span>
                    <span style={{ color: s2.fat }}>F{m.f}</span>
                    <span style={{ color: s2.fibre }}>Fi{m.fi}</span>
                  </div>
                </div>
                <div style={{ paddingTop: 4 }}>
                  <S2Check on={m.eaten} size={18}/>
                </div>
              </div>
            </S2Card>
          </div>
        ))}

        {/* Add meal button */}
        <button onClick={() => onNav && onNav('addMeal')} style={{
          width:'100%', background:'transparent', border:`1px dashed ${s2.lineStrong}`, padding:'14px 0',
          color: s2.accent, fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing:'0.2em', cursor:'pointer',
          marginTop: 4,
        }}>+ LOG EXTRA MEAL</button>
      </div>
    </S2Scaffold>
  );
};

// ─── Tracker tab ──────────────────────────────────────────────
// Metric-chart data for tracker. 14 points, oldest → newest.
const S2_METRICS = {
  kcal:    { label:'CALORIES', unit:'kcal', target:1320, avg:1265, series:[1180,1290,1120,1340,1220,1380,1260,1180,1410,1290,1340,1200,1370,1290], deltaLabel:'−55 / day',  deltaGood:true },
  protein: { label:'PROTEIN',  unit:'g',    target:165,  avg:158,  series:[142,160,155,170,148,172,162,155,175,168,160,150,168,165], deltaLabel:'−7 / day',   deltaGood:false },
  carbs:   { label:'CARBS',    unit:'g',    target:60,   avg:54,   series:[52,61,48,55,50,62,56,49,58,55,51,48,57,54],          deltaLabel:'−6 / day',    deltaGood:true },
  fat:     { label:'FAT',      unit:'g',    target:45,   avg:42,   series:[38,46,40,48,41,44,43,38,50,44,42,39,47,42],          deltaLabel:'−3 / day',    deltaGood:true },
  fibre:   { label:'FIBRE',    unit:'g',    target:25,   avg:22,   series:[18,24,20,26,21,25,23,19,27,24,22,20,25,22],          deltaLabel:'−3 / day',    deltaGood:false },
  water:   { label:'WATER',    unit:'L',    target:3.0,  avg:2.4,  series:[2.1,2.6,1.8,2.8,2.2,2.7,2.4,2.0,2.9,2.5,2.3,2.1,2.6,2.4], deltaLabel:'−0.6 / day', deltaGood:false },
  adh:     { label:'ADHERENCE',unit:'%',    target:100,  avg:87,   series:[75,100,50,100,100,75,100,100,100,100,75,100,50,100],    deltaLabel:'+12% vs prev', deltaGood:true },
};

const S2MetricPicker = function MetricPicker({ value, onChange }) {
  const s2 = window.s2;
  const [open, setOpen] = React.useState(false);
  const order = ['kcal','protein','carbs','fat','fibre','water','adh'];
  const colors = { kcal:s2.accent, protein:s2.protein, carbs:s2.carbs, fat:s2.fat, fibre:s2.fibre, water:'#6BC6FF', adh:s2.accentSoft };
  const current = S2_METRICS[value];
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        cursor:'pointer', background:'transparent', border:`1px solid ${s2.lineStrong}`,
        color: colors[value], fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.2em',
        padding:'6px 10px', display:'flex', alignItems:'center', gap: 8, textTransform:'uppercase',
      }}>
        <span style={{ width:6, height:6, background: colors[value], display:'inline-block' }}/>
        {current.label}
        <span style={{ fontSize: 8, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 160ms' }}>▼</span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0, zIndex: 10,
          background: s2.surface2, border:`1px solid ${s2.lineStrong}`,
          minWidth: 160, padding: 4,
        }}>
          {order.map(k => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }} style={{
              cursor:'pointer', background: k === value ? s2.accentFill : 'transparent',
              border:'none', width:'100%', textAlign:'left',
              padding:'9px 10px', fontFamily: s2.mono, fontSize: 10, fontWeight: 500, letterSpacing:'0.18em',
              color: k === value ? colors[k] : s2.text, textTransform:'uppercase',
              display:'flex', alignItems:'center', gap: 8,
            }}>
              <span style={{ width:6, height:6, background: colors[k], display:'inline-block' }}/>
              {S2_METRICS[k].label}
              <span style={{ marginLeft:'auto', color: s2.textDimmer, fontSize: 9 }}>{S2_METRICS[k].avg}{S2_METRICS[k].unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const S2MetricChart = function MetricChart({ metric }) {
  const s2 = window.s2;
  const colors = { kcal:s2.accent, protein:s2.protein, carbs:s2.carbs, fat:s2.fat, fibre:s2.fibre, water:'#6BC6FF', adh:s2.accentSoft };
  const m = S2_METRICS[metric];
  const color = colors[metric];
  const W = 300, H = 90, PAD_T = 8, PAD_B = 6;
  const max = Math.max(m.target, ...m.series) * 1.05;
  const min = Math.max(0, Math.min(...m.series) * 0.85);
  const xs = m.series.map((_, i) => (i / (m.series.length - 1)) * W);
  const ys = m.series.map(v => H - PAD_B - ((v - min) / (max - min)) * (H - PAD_T - PAD_B));
  const tY  = H - PAD_B - ((m.target - min) / (max - min)) * (H - PAD_T - PAD_B);
  const line = xs.map((x, i) => (i === 0 ? `M ${x} ${ys[i]}` : `L ${x} ${ys[i]}`)).join(' ');
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const gradId = `mg_${metric}`;
  return (
    <div style={{ height: H, position:'relative' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <line x1="0" y1={tY} x2={W} y2={tY} stroke={s2.textDimmer} strokeDasharray="2,3" strokeWidth="0.5"/>
        <path d={area} fill={`url(#${gradId})`}/>
        <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 2.6 : 1.2} fill={color}/>)}
      </svg>
      <div style={{ position:'absolute', right: 4, top: tY - 14, fontFamily: s2.mono, fontSize: 8, color: s2.textDimmer, letterSpacing:'0.1em' }}>TGT {m.target}{m.unit}</div>
    </div>
  );
};

window.S2Tracker = function Tracker({ onNav }) {
  const s2 = window.s2;
  const [metric, setMetric] = React.useState('kcal');
  const m = S2_METRICS[metric];
  const colors = { kcal:s2.accent, protein:s2.protein, carbs:s2.carbs, fat:s2.fat, fibre:s2.fibre, water:'#6BC6FF', adh:s2.accentSoft };
  const weeks = [
    [100,75,100,50,100,100,75],
    [100,100,100,100,75,100,50],
    [100,75,100,75,100,75,null],
    [null,null,null,null,null,null,null],
  ];
  const days = ['M','T','W','T','F','S','S'];

  return (
    <S2Scaffold tab="tracker" onNav={onNav}>
      <S2SectionTitle kicker="APRIL 2026" title="Tracker"/>

      {/* Big 3 stats */}
      <div style={{ padding:'18px 20px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {[
          { label:'THIS WEEK', v:'93', u:'%', sub:'26/28' },
          { label:'THIS MONTH', v:'87', u:'%', sub:'73/84' },
          { label:'GOAL ETA',  v:'6', u:'w', sub:'03 Jun 26' },
        ].map((x,i) => (
          <div key={i} style={{ border:`1px solid ${s2.line}`, padding:'12px 10px' }}>
            <s2HairLabel>{x.label}</s2HairLabel>
            <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1, marginTop: 6 }}>
              {x.v}<span style={{ fontSize: 14, color: s2.textDim }}>{x.u}</span>
            </div>
            <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, letterSpacing:'0.15em', marginTop: 4 }}>{x.sub}</div>
          </div>
        ))}
      </div>

      {/* Metric chart */}
      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={16}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 12, gap: 10 }}>
            <div>
              <s2HairLabel>DAILY {m.label} · 14d</s2HairLabel>
              <div style={{ display:'flex', alignItems:'baseline', gap: 6, marginTop: 6 }}>
                <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 300, color: colors[metric], letterSpacing:'-0.03em', lineHeight: 1 }}>
                  {m.avg}<span style={{ fontSize: 13, color: s2.textDim, marginLeft: 2 }}>{m.unit}</span>
                </div>
                <s2HairLabel color={m.deltaGood ? s2.accent : s2.warn} style={{ marginLeft: 6 }}>
                  {m.deltaGood ? '▼' : '▲'} {m.deltaLabel}
                </s2HairLabel>
              </div>
            </div>
            <S2MetricPicker value={metric} onChange={setMetric}/>
          </div>
          <S2MetricChart metric={metric}/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 8, fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing:'0.15em' }}>
            <span>09 APR</span><span>15 APR</span><span>22 APR</span>
          </div>
        </S2Card>
      </div>

      {/* Calendar */}
      <div style={{ padding:'18px 20px 0' }}>
        <S2Card padding={14}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom: 6 }}>
            {days.map((d,i) => <div key={i} style={{ textAlign:'center', fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer }}>{d}</div>)}
          </div>
          {weeks.map((w,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom: 4 }}>
              {w.map((v,j) => {
                const empty = v == null;
                return (
                  <div key={j} style={{
                    aspectRatio:'1', background: empty ? 'transparent' : s2.surface2,
                    border: `1px solid ${s2.line}`, position:'relative', overflow:'hidden',
                  }}>
                    {!empty && (
                      <>
                        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${v}%`, background: v === 100 ? s2.accent : `rgba(255,106,42,${v/100*0.7})` }}/>
                        <div style={{ position:'absolute', top:3, left:4, fontFamily: s2.mono, fontSize: 9, fontWeight: 600, color: v === 100 ? '#0C0907' : s2.textDim, zIndex: 2 }}>{i*7+j+1}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </S2Card>
      </div>

      {/* Selected day */}
      <div style={{ padding:'18px 20px 0' }}>
        <S2Card padding={16}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <div>
              <s2HairLabel>DAY 17 OF 49</s2HairLabel>
              <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, marginTop: 4 }}>Wednesday, 22 Apr</div>
            </div>
            <s2Pill color={s2.accent}>3 / 4 EATEN</s2Pill>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginBottom: 6 }}>
              <span>MEALS</span><span>75%</span>
            </div>
            <S2Bar pct={0.75} color={s2.accent}/>
          </div>
          <div style={{ marginTop: 14, display:'flex', gap: 10 }}>
            <s2Btn small primary onClick={() => onNav && onNav('meals')}>VIEW PLAN</s2Btn>
            <s2Btn small>MARK ALL</s2Btn>
          </div>
        </S2Card>
      </div>
    </S2Scaffold>
  );
};

// ─── Shopping tab ─────────────────────────────────────────────
// Format scaled qty: kg rolls up from g above 1000, everything rounded nicely.
const s2FormatQty = (base, unit, mult) => {
  const v = base * mult;
  if (unit === 'kg' || unit === 'g') {
    const g = unit === 'kg' ? v * 1000 : v;
    if (g >= 1000) {
      const kg = g / 1000;
      return `${(Math.round(kg * 100) / 100).toString().replace(/\.?0+$/, '')} kg`;
    }
    return `${Math.round(g)} g`;
  }
  if (unit === 'L' || unit === 'ml') {
    const ml = unit === 'L' ? v * 1000 : v;
    if (ml >= 1000) {
      const L = ml / 1000;
      return `${(Math.round(L * 100) / 100).toString().replace(/\.?0+$/, '')} L`;
    }
    return `${Math.round(ml)} ml`;
  }
  // Counted (eggs, cucumbers) — round up so you always buy enough.
  const rounded = Math.ceil(v);
  return unit ? `${rounded} ${unit}` : `${rounded}`;
};

window.S2Shopping = function Shopping({ onNav }) {
  const s2 = window.s2;
  const [people, setPeople] = React.useState(1);
  const clamp = (n) => Math.max(1, Math.min(12, n));

  // Items: name + base qty + unit. Unit '' = countable.
  const categories = [
    { name:'PROTEIN', items:[
      { n:'Chicken breast', q:1.2, u:'kg', bought:true },
      { n:'Eggs',           q:30,  u:'',   bought:true },
      { n:'Paneer',         q:400, u:'g',  bought:true },
      { n:'Fish fillet',    q:800, u:'g',  bought:false },
      { n:'Greek yogurt',   q:1,   u:'kg', bought:false },
    ]},
    { name:'PRODUCE', items:[
      { n:'Spinach',   q:500, u:'g',  bought:true },
      { n:'Tomato',    q:1,   u:'kg', bought:true },
      { n:'Onion',     q:1,   u:'kg', bought:false },
      { n:'Cucumber',  q:4,   u:'',   bought:false },
      { n:'Capsicum',  q:3,   u:'',   bought:false },
      { n:'Broccoli',  q:500, u:'g',  bought:false },
    ]},
    { name:'PANTRY', items:[
      { n:'Roasted chana', q:500, u:'g', bought:true },
      { n:'Makhana',       q:200, u:'g', bought:true },
      { n:'Mixed nuts',    q:250, u:'g', bought:true },
      { n:'Chia seeds',    q:100, u:'g', bought:true },
    ]},
  ];

  const total = categories.reduce((a, c) => a + c.items.length, 0);
  const bought = categories.reduce((a, c) => a + c.items.filter(i => i.bought).length, 0);

  const StepBtn = ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 36, height: 36, background:'transparent',
      border:`1px solid ${disabled ? s2.line : s2.lineStrong}`,
      color: disabled ? s2.textDimmer : s2.text,
      fontFamily: s2.sans, fontSize: 18, fontWeight: 300,
      cursor: disabled ? 'default' : 'pointer',
    }}>{children}</button>
  );

  return (
    <S2Scaffold tab="shopping" onNav={onNav}>
      <S2SectionTitle kicker={`WEEK 03 · ${total} ITEMS`} title="Shopping"
        right={<div style={{ textAlign:'right' }}>
          <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 300, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1 }}>{bought}<span style={{ color: s2.textDim, fontSize: 16 }}>/{total}</span></div>
          <s2HairLabel>BOUGHT</s2HairLabel>
        </div>}/>

      <div style={{ padding:'14px 20px 0' }}>
        <S2Bar pct={bought/total} color={s2.accent} h={3}/>
      </div>

      {/* People multiplier */}
      <div style={{ padding:'18px 20px 0' }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12,
          border:`1px solid ${s2.line}`, padding:'14px 16px', background: s2.surface2,
        }}>
          <div>
            <s2HairLabel color={s2.accent}>SHOPPING FOR</s2HairLabel>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 4 }}>
              Quantities scale ×{people}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <StepBtn onClick={() => setPeople(p => clamp(p - 1))} disabled={people <= 1}>−</StepBtn>
            <div style={{ minWidth: 56, textAlign:'center' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 300, color: s2.text, letterSpacing:'-0.03em', lineHeight: 1 }}>{people}</div>
              <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing:'0.2em', marginTop: 3 }}>{people === 1 ? 'PERSON' : 'PEOPLE'}</div>
            </div>
            <StepBtn onClick={() => setPeople(p => clamp(p + 1))} disabled={people >= 12}>+</StepBtn>
          </div>
        </div>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        {categories.map((cat, ci) => {
          const cDone = cat.items.filter(i => i.bought).length;
          return (
          <div key={ci} style={{ marginBottom: 24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 10 }}>
              <s2HairLabel>{cat.name}</s2HairLabel>
              <s2HairLabel color={cDone === cat.items.length ? s2.accent : s2.textDim}>{cDone}/{cat.items.length}</s2HairLabel>
            </div>
            {cat.items.map((it, ii) => (
              <div key={ii} style={{
                display:'flex', alignItems:'center', gap: 12,
                padding:'12px 0', borderBottom: ii === cat.items.length - 1 ? 'none' : `1px solid ${s2.line}`,
              }}>
                <S2Check on={it.bought} size={16}/>
                <div style={{
                  flex:1, fontFamily: s2.sans, fontSize: 14, fontWeight: 400,
                  color: it.bought ? s2.textDim : s2.text,
                  textDecoration: it.bought ? 'line-through' : 'none',
                }}>{it.n}</div>
                <div style={{
                  fontFamily: s2.mono, fontSize: 11, fontWeight: 500, letterSpacing:'0.05em',
                  color: it.bought ? s2.textDimmer : (people > 1 ? s2.accent : s2.textDim),
                  textDecoration: it.bought ? 'line-through' : 'none',
                }}>{s2FormatQty(it.q, it.u, people)}</div>
              </div>
            ))}
          </div>
        )})}
      </div>
    </S2Scaffold>
  );
};

// ─── Tips tab ─────────────────────────────────────────────────
window.S2Tips = function Tips({ onNav }) {
  const s2 = window.s2;
  const tips = [
    { t:'PROTEIN FIRST', b:'Start every meal with your protein source. It triggers satiety earlier and protects lean mass in a deficit.', k:'SATIETY' },
    { t:'HYDRATE BEFORE COFFEE', b:'500 ml of water on wake-up blunts cortisol spikes and reduces false hunger through the morning.', k:'HABIT' },
    { t:'SLEEP BEATS A WORKOUT', b:'7+ hours nightly correlates with 55% more fat loss vs. matched calories with poor sleep. Non-negotiable.', k:'RECOVERY' },
    { t:'WEIGH WEEKLY, TRACK TREND', b:'Daily weight is noise. A 7-day rolling average is the only number worth acting on.', k:'METRICS' },
    { t:'PLATE RATIO 1:1:2', b:'One palm of protein, one palm of carbs, two palms of veg. Works without weighing anything.', k:'PLATE' },
  ];

  return (
    <S2Scaffold tab="tips" onNav={onNav}>
      <S2SectionTitle kicker="KNOWLEDGE BASE · 12 ARTICLES" title="Learn"/>

      <div style={{ padding:'18px 20px 0' }}>
        <S2Card onClick={() => onNav && onNav('mealPrep')} padding={16} style={{ borderColor: s2.accent }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <s2HairLabel color={s2.accent}>FEATURED · MEAL PREP</s2HairLabel>
              <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, marginTop: 6, letterSpacing:'-0.01em' }}>Sunday batch protocol</div>
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 6 }}>90 min · saves 5 hours during the week</div>
            </div>
            <div style={{ fontFamily: s2.mono, fontSize: 18, color: s2.accent }}>→</div>
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 12 }}>PRINCIPLES</s2HairLabel>
        {tips.map((tip, i) => (
          <div key={i} style={{ padding:'18px 0', borderBottom: i === tips.length - 1 ? 'none' : `1px solid ${s2.line}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <s2HairLabel color={s2.accent}>{String(i+1).padStart(2,'0')} · {tip.k}</s2HairLabel>
              <s2HairLabel>3 MIN READ</s2HairLabel>
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 18, fontWeight: 400, marginTop: 8, letterSpacing:'-0.01em', lineHeight: 1.2 }}>
              {tip.t}
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 6, lineHeight: 1.55 }}>
              {tip.b}
            </div>
          </div>
        ))}
      </div>
    </S2Scaffold>
  );
};

// ─── Profile tab ──────────────────────────────────────────────
window.S2Profile = function Profile({ onNav }) {
  const s2 = window.s2;
  const pts = [72.2,72.0,71.9,71.6,71.4,71.5,71.2,70.8,70.6,70.3,70.1,69.8];
  return (
    <S2Scaffold tab="profile" onNav={onNav}>
      <div style={{ padding:'14px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <s2HairLabel>ATHLETE · MEMBER 94d</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 400, marginTop: 4, letterSpacing:'-0.02em' }}>Harshit</div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 2, letterSpacing:'0.1em' }}>@HARSHIT</div>
        </div>
        <div style={{ width:56, height:56, border:`1px solid ${s2.accent}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily: s2.sans, fontSize: 22, fontWeight: 300, color: s2.accent }}>H</div>
      </div>

      {/* Weight hero */}
      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel>WEIGHT · LATEST</s2HairLabel>
        <div style={{ display:'flex', alignItems:'baseline', gap: 10, marginTop: 6 }}>
          <div style={{ fontFamily: s2.sans, fontSize: 72, fontWeight: 300, letterSpacing:'-0.04em', lineHeight: 0.9 }}>69.8</div>
          <div style={{ fontFamily: s2.mono, fontSize: 13, color: s2.textDim }}>kg</div>
          <div style={{ marginLeft:'auto', fontFamily: s2.mono, fontSize: 11, color: s2.accent, paddingBottom: 10 }}>↓ 2.4kg · 28d</div>
        </div>
        <div style={{ height: 80, marginTop: 10, position:'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 320 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s2.accent} stopOpacity="0.4"/>
                <stop offset="100%" stopColor={s2.accent} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {(() => {
              const min=69.5,max=72.5;
              const xy = pts.map((v,i) => [(i/(pts.length-1))*320, 80-((v-min)/(max-min))*70-5]);
              const path = xy.map((p,i) => i===0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`).join(' ');
              return (<g>
                <path d={path + ' L 320 80 L 0 80 Z'} fill="url(#wg2)"/>
                <path d={path} fill="none" stroke={s2.accent} strokeWidth="1.5"/>
                <circle cx={xy[xy.length-1][0]} cy={xy[xy.length-1][1]} r="3" fill={s2.accent}/>
              </g>);
            })()}
            <line x1="0" y1="74" x2="320" y2="74" stroke={s2.textDimmer} strokeDasharray="2,3" strokeWidth="0.5"/>
          </svg>
        </div>
        <div style={{ marginTop: 10 }}>
          <s2Btn small full onClick={() => onNav && onNav('weightLog')}>+ LOG WEIGHT</s2Btn>
        </div>
      </div>

      {/* Goal projection */}
      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={16}>
          <s2HairLabel>GOAL · 68 KG</s2HairLabel>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop: 8 }}>
            <div>
              <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1 }}>42<span style={{ fontFamily: s2.mono, fontSize: 12, color: s2.textDim, marginLeft: 4 }}>DAYS</span></div>
              <s2HairLabel style={{ marginTop: 4 }}>EST. 03 JUN 2026</s2HairLabel>
            </div>
            <div style={{ textAlign:'right', fontFamily: s2.mono, fontSize: 10, color: s2.textDim }}>
              <div>−1.8 KG TO GO</div>
              <div style={{ color: s2.accent, marginTop: 2 }}>▲ ON TRACK</div>
            </div>
          </div>
        </S2Card>
      </div>

      {/* Body */}
      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 4 }}>BODY</s2HairLabel>
        <s2DataRow label="HEIGHT"    value="176" unit="cm"/>
        <s2DataRow label="BMI"       value="22.5" accent={s2.accent}/>
        <s2DataRow label="BODY FAT"  value="18.2" unit="%"/>
        <s2DataRow label="RMR"       value="1,610" unit="kcal/d" last/>
      </div>

      {/* Targets */}
      <div style={{ padding:'18px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 4 }}>DAILY TARGETS</s2HairLabel>
        <s2DataRow label="CALORIES" value="1,320" unit="kcal"/>
        <s2DataRow label="PROTEIN"  value="165" unit="g" accent={s2.protein}/>
        <s2DataRow label="CARBS"    value="60" unit="g"  accent={s2.carbs}/>
        <s2DataRow label="FAT"      value="45" unit="g"  accent={s2.fat}/>
        <s2DataRow label="FIBRE"    value="25" unit="g"  accent={s2.fibre} last/>
      </div>

      {/* Prefs */}
      <div style={{ padding:'18px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 4 }}>PREFERENCES</s2HairLabel>
        <s2DataRow label="DIET"      value="HIGH PROTEIN · INDIAN"/>
        <s2DataRow label="CUISINES"  value="INDIAN, MEDITERRANEAN"/>
        <s2DataRow label="MEALS/DAY" value="4"/>
        <s2DataRow label="INTENSITY" value="AGGRESSIVE" accent={s2.warn}/>
        <s2DataRow label="ACTIVITY"  value="MODERATE"/>
        <s2DataRow label="PLAN LEN"  value="14 DAYS" last/>
      </div>

      {/* Plan duration toggle */}
      <div style={{ padding:'18px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>PLAN DURATION</s2HairLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
          {[
            { d:7,  label:'7-DAY',  sub:'one week' },
            { d:14, label:'14-DAY', sub:'max variety', rec:true },
          ].map(o => (
            <div key={o.d} style={{
              position:'relative',
              border:`1px solid ${o.rec ? s2.accent : s2.line}`,
              background: o.rec ? s2.accentFill : 'transparent',
              padding: '14px', cursor:'pointer',
            }}>
              {o.rec && <div style={{ position:'absolute', top:-8, right: 8, fontFamily: s2.mono, fontSize: 8, background: s2.accent, color:'#0C0907', padding:'2px 6px', letterSpacing:'0.15em', fontWeight: 700 }}>RECOMMENDED</div>}
              <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500, color: o.rec ? s2.accent : s2.text }}>{o.label}</div>
              <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 4 }}>{o.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div style={{ padding:'22px 20px 0', display:'flex', flexDirection:'column', gap: 10 }}>
        <s2Btn full onClick={() => onNav && onNav('customise')}>CUSTOMISE PLAN</s2Btn>
        <s2Btn full primary onClick={() => onNav && onNav('regenConfirm')}>REGENERATE PLAN</s2Btn>
        <button style={{
          background:'transparent', border:`1px solid rgba(255,62,62,0.3)`,
          color: s2.warn, padding:'14px 0', width:'100%',
          fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.2em', cursor:'pointer',
        }}>LOGOUT</button>
      </div>
    </S2Scaffold>
  );
};
