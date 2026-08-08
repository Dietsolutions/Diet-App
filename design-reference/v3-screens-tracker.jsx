// v3 — Tracker + Water. Grounded in TrackerTab.tsx, WaterIntakeCard.tsx, WaterDetailSheet.tsx,
// then restyled to the Fresh Light treatment at the user's request.
//
// AHEAD OF THE APP (needs backend work — see github.md "Design changes needing app work"):
//   · metric switcher: needs a per-day series for protein/carbs/fat/fibre/water/adherence.
//     useTracker.ts exposes no per-day macro series today.
//   · day-detail card: needs per-day meal counts addressable by date.
// GROUNDED AND UNCHANGED: 1 glass = 250 ml, 10-glass goal (2.5 L), big-3 summary figures.
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3IconBtn, V3Row, V3Ring } = window;

function V3StatCard({ label, big, unit, sub, dim }) {
  return (
    <V3Card r={20} pad={14}>
      <V3Kick>{label}</V3Kick>
      <div style={{ fontFamily:v3.disp, fontSize:32, fontWeight:700, letterSpacing:'-0.045em', lineHeight:1, marginTop:8, color: dim ? v3.dimmer : '#5F8C12' }}>
        {big}<span style={{ fontSize:15, color:v3.dim }}>{unit}</span>
      </div>
      <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, letterSpacing:'0.1em', color:v3.dimmer, marginTop:6 }}>{sub}</div>
    </V3Card>
  );
}

const V3_TRK = {
  kcal:    { label:'Calories', unit:'kcal', target:1320, avg:1265, color:v3.lime,    series:[1180,1290,1120,1340,1220,1380,1260,1180,1410,1290,1340,1200,1370,1290], delta:'−55 / day', good:true },
  protein: { label:'Protein',  unit:'g',    target:165,  avg:158,  color:v3.protein, series:[142,160,155,170,148,172,162,155,175,168,160,150,168,165], delta:'−7 / day', good:false },
  carbs:   { label:'Carbs',    unit:'g',    target:60,   avg:54,   color:v3.carbs,   series:[52,61,48,55,50,62,56,49,58,55,51,48,57,54], delta:'−6 / day', good:true },
  fat:     { label:'Fat',      unit:'g',    target:45,   avg:42,   color:v3.fat,     series:[38,46,40,48,41,44,43,38,50,44,42,39,47,42], delta:'−3 / day', good:true },
  fibre:   { label:'Fibre',    unit:'g',    target:25,   avg:22,   color:v3.fibre,   series:[18,24,20,26,21,25,23,19,27,24,22,20,25,22], delta:'−3 / day', good:false },
  water:   { label:'Water',    unit:'L',    target:2.5,  avg:2.1,  color:v3.water,   series:[1.8,2.2,1.5,2.4,1.9,2.3,2.0,1.7,2.5,2.1,2.0,1.8,2.2,2.1], delta:'−0.4 / day', good:false },
  adh:     { label:'Adherence',unit:'%',    target:100,  avg:87,   color:v3.lilac,   series:[75,100,50,100,100,75,100,100,100,100,75,100,50,100], delta:'+12% vs prev', good:true },
};

window.V3Tracker = function V3Tracker({ onNav }) {
  const [metric, setMetric] = React.useState('kcal');
  const m = V3_TRK[metric];
  const W = 300, H = 104, PT = 10, PB = 10;
  const max = Math.max(m.target, ...m.series) * 1.06, min = Math.max(0, Math.min(...m.series) * 0.86);
  const xs = m.series.map((_, i) => (i / (m.series.length - 1)) * W);
  const ys = m.series.map(v => H - PB - ((v - min) / (max - min)) * (H - PT - PB));
  const tY = H - PB - ((m.target - min) / (max - min)) * (H - PT - PB);
  const line = xs.map((x, i) => `${i ? 'L' : 'M'} ${x} ${ys[i]}`).join(' ');

  // April 2026: 30 days, 1 Apr is a Wednesday → 2 blank leading cells under the M-T-W header.
  // Adherence % per elapsed day (100 = 4/4 meals eaten, 75 = 3/4, 50 = 2/4).
  // Days 1–21 are complete and sum to 73 of 84 meals, matching “this month 87%” above;
  // days 15–21 sum to 26 of 28, matching “this week 93%”. Day 22 is today, in progress at 3/4.
  const LEAD = 2, DAYS = 30, TODAY = 22;
  const adherence = [100,75,100,50,75,100,75,100,75,100,75,100,75,75,100,100,75,100,100,75,100,75];
  const cells = [
    ...Array.from({ length: LEAD }, () => null),
    ...Array.from({ length: DAYS }, (_, i) => ({ d: i + 1, v: adherence[i] ?? null, today: i + 1 === TODAY })),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <V3Scaffold tab="tracker" onNav={onNav}>
      <div style={{ padding:'16px 22px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <V3Kick>April 2026</V3Kick>
          <V3H size={32} style={{ marginTop:6 }}>Tracker</V3H>
        </div>
        <V3IconBtn bg={v3.card} onClick={() => onNav && onNav('kcal')}>▤</V3IconBtn>
      </div>

      {/* big-3 summary */}
      <div style={{ padding:'20px 22px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          { k:'This week', v:'93', u:'%', sub:'26 / 28 meals', bg:v3.mint },
          { k:'This month', v:'87', u:'%', sub:'73 / 84 meals', bg:v3.butter },
          { k:'Goal ETA', v:'6', u:'w', sub:'68 kg · 3 Jun 26', bg:v3.peach },
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
            {Object.keys(V3_TRK).map(k => {
              const on = k === metric;
              return (
                <button key={k} onClick={() => setMetric(k)} style={{
                  border:'none', cursor:'pointer', borderRadius:999, padding:'7px 13px', flexShrink:0,
                  background: on ? V3_TRK[k].color : 'rgba(246,247,243,0.09)',
                  color: on ? v3.ink : v3.onDarkDim, fontFamily:v3.sans, fontSize:11.5, fontWeight:700,
                }}>{V3_TRK[k].label}</button>
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
              <defs><linearGradient id={`v3tg_${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity="0.4"/><stop offset="100%" stopColor={m.color} stopOpacity="0"/>
              </linearGradient></defs>
              <line x1="0" y1={tY} x2={W} y2={tY} stroke="rgba(246,247,243,0.28)" strokeDasharray="3,4" strokeWidth="0.7"/>
              <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#v3tg_${metric})`}/>
              <path d={line} fill="none" stroke={m.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
              <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3.4" fill={m.color}/>
            </svg>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:v3.sans, fontSize:10, fontWeight:600, color:v3.onDarkDimmer }}>
            <span>09 Apr</span><span>Target {m.target}{m.unit}</span><span>22 Apr</span>
          </div>
        </V3Card>
      </div>

      {/* plan adherence calendar */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={16}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
            <V3Kick>Plan adherence · April</V3Kick>
            <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, color:v3.limeDeep, cursor:'pointer' }} onClick={() => onNav && onNav('kcal')}>Monthly macros →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:6 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} style={{ textAlign:'center', fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.dimmer }}>{d}</div>)}
          </div>
          {weeks.map((w, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, marginBottom:5 }}>
              {w.map((c, j) => {
                if (!c) return <div key={j}/>;
                const has = c.v != null;
                return (
                  <div key={j} style={{
                    aspectRatio:'1', borderRadius:11, display:'grid', placeItems:'center',
                    background: !has ? 'rgba(15,20,15,0.04)' : c.v === 100 ? v3.lime : `rgba(198,242,78,${0.25 + c.v / 100 * 0.5})`,
                    boxShadow: c.today ? `inset 0 0 0 1.5px ${v3.ink}` : 'none',
                  }}>
                    <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight: c.today ? 800 : 700, color: has ? v3.ink : v3.dimmer }}>{c.d}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:10 }}>
            {[['All meals', v3.lime], ['Partial', 'rgba(198,242,78,0.5)'], ['No data', 'rgba(15,20,15,0.04)']].map(([l, c]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:9, height:9, borderRadius:3, background:c }}/>
                <V3Kick style={{ fontSize:7.5 }}>{l}</V3Kick>
              </div>
            ))}
          </div>
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

// ── Tracker · empty state ────────────────────────────────────
window.V3TrackerEmpty = function V3TrackerEmpty({ onNav }) {
  return (
    <V3Scaffold tab="tracker" onNav={onNav}>
      <div style={{ padding:'16px 22px 0' }}>
        <V3Kick>April 2026</V3Kick>
        <V3H size={32} style={{ marginTop:6 }}>Tracker</V3H>
      </div>
      <div style={{ padding:'26px 22px 0' }}>
        <V3Card r={28} pad={28} border={v3.lineStrong} style={{ textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:999, background:v3.paper, margin:'0 auto 14px', display:'grid', placeItems:'center', fontSize:24, color:v3.dimmer }}>▤</div>
          <div style={{ fontFamily:v3.sans, fontSize:16, fontWeight:700 }}>No data yet</div>
          <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dimmer, marginTop:8, lineHeight:1.6, maxWidth:260, margin:'8px auto 0' }}>
            Start logging meals on the Meals tab and your tracking stats will appear here.
          </div>
        </V3Card>
      </div>
      <div style={{ padding:'18px 22px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:9 }}>
        <V3StatCard label="This week" big="—" unit="" sub="0/0" dim/>
        <V3StatCard label="This month" big="—" unit="" sub="0/0" dim/>
        <V3StatCard label="Goal ETA" big="—" unit="" sub="no weight goal set" dim/>
      </div>
    </V3Scaffold>
  );
};

// ── Water detail (WaterDetailSheet.tsx) — 1 glass = 250 ml, Fresh Light treatment ──
window.V3Water = function V3Water({ onNav }) {
  const goal = 10;
  const [glasses, setGlasses] = React.useState(6);
  const history = [8,10,7,11,9,10,6];
  const litres = (glasses * 0.25).toFixed(1);
  const goalLitres = (goal * 0.25).toFixed(1);
  const avg = (history.reduce((a, b) => a + b, 0) / history.length * 0.25).toFixed(1);
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.paper}>
      <V3TopBar onBack={() => onNav && onNav('meals')} kick="Hydration · today" title="Water"
        right={<V3Chip bg={v3.card} size={11}>Goal {goalLitres} L</V3Chip>}/>

      <div style={{ padding:'20px 22px 0' }}>
        <V3Card bg={v3.sky} r={32} pad={20}>
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            <V3Ring pct={glasses / goal} size={144} thick={14} color={v3.ink} track="rgba(15,20,15,0.14)" dashRemainder>
              <div>
                <div style={{ fontFamily:v3.disp, fontSize:34, fontWeight:700, letterSpacing:'-0.045em', lineHeight:1 }}>{litres}</div>
                <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.panelDim, marginTop:4 }}>of {goalLitres} L</div>
              </div>
            </V3Ring>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:30, fontWeight:700, letterSpacing:'-0.04em' }}>{Math.round(glasses / goal * 100)}%</div>
              <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.panelDim, marginTop:5 }}>{glasses} of {goal} glasses</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:'rgba(15,20,15,0.45)', marginTop:10, lineHeight:1.5 }}>
                {glasses >= goal ? 'Goal hit for today.' : `${goal - glasses} glasses left to hit your goal.`}
              </div>
            </div>
          </div>
        </V3Card>
      </div>

      {/* glasses */}
      <div style={{ padding:'16px 22px 0', display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {Array.from({ length: goal }).map((_, i) => {
          const on = i < glasses;
          return (
            <div key={i} onClick={() => setGlasses(glasses === i + 1 ? i : i + 1)} style={{
              aspectRatio:'2/3', borderRadius:'10px 10px 16px 16px', cursor:'pointer',
              background: on ? v3.water : v3.card, border: on ? 'none' : `1.5px solid ${v3.line}`,
              display:'grid', placeItems:'center', position:'relative', overflow:'hidden', transition:'background 200ms ease-out',
            }}>
              {on && <div style={{ position:'absolute', left:0, right:0, top:'26%', height:1, background:'rgba(255,255,255,0.55)' }}/>}
              <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, color: on ? v3.ink : v3.dimmer, zIndex:1 }}>{i + 1}</span>
            </div>
          );
        })}
      </div>

      {/* quick log — 250 ml per glass */}
      <div style={{ padding:'18px 22px 0', display:'flex', gap:8 }}>
        {[{ l:'+1 glass', a:1 }, { l:'+ Bottle', a:2 }, { l:'+ 1 litre', a:4 }].map(b => (
          <V3Btn key={b.l} small kind="light" full onClick={() => setGlasses(g => Math.min(goal * 2, g + b.a))}>{b.l}</V3Btn>
        ))}
      </div>

      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={18}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <V3Kick>Last 7 days</V3Kick>
            <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:'#1F7FB8' }}>Avg {avg} L</span>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:96, marginTop:16 }}>
            {history.map((g, i) => {
              const today = i === 6;
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
                  <div style={{ width:'100%', height:`${Math.min(g / goal, 1) * 100}%`, borderRadius:10, background: today ? v3.water : 'rgba(99,184,232,0.30)' }}/>
                  <span style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color: today ? '#1F7FB8' : v3.dimmer }}>{['M','T','W','T','F','S','S'][i]}</span>
                </div>
              );
            })}
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};
