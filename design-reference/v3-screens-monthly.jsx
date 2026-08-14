// v3 — Monthly macros, dark treatment.
// Redesign of the light MonthlyCalorieChart card (V3Kcal) into the Track tab's dark chart
// language: ink card, shaded macro selectors, bars synced to the selected macro's colour,
// and the deficit message popped out below the card as a raised light element.
//
// Every figure derives from DAILY[macro] + GOAL[macro] — consumed, target, delta, daily
// average, days under/over and cumulative % are all reductions, so they cannot drift apart.
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3IconBtn } = window;

// August 2026 · 31 days, 13 elapsed. null = day not logged.
const V3M = {
  kcal:    { label:'Calories', tab:'Kcal',    unit:'kcal', goal:1320, color:v3.lime,
             days:[1180,1290,1120,1340,null,1220,1380,1260,1180,1410,null,1290,1240] },
  protein: { label:'Protein',  tab:'Protein', unit:'g',    goal:165,  color:v3.protein,
             days:[142,160,155,170,null,148,172,162,155,175,null,168,158] },
  carbs:   { label:'Carbs',    tab:'Carbs',   unit:'g',    goal:60,   color:v3.carbs,
             days:[52,61,48,55,null,50,62,56,49,58,null,51,54] },
  fat:     { label:'Fat',      tab:'Fat',     unit:'g',    goal:45,   color:v3.fat,
             days:[38,46,40,48,null,41,44,43,38,50,null,44,42] },
  fibre:   { label:'Fibre',    tab:'Fibre',   unit:'g',    goal:30,   color:v3.fibre,
             days:[22,26,18,31,null,24,34,20,27,29,null,19,25] },
};
const V3M_NOTE = {
  kcal:    { tone:'good', text:'Healthy deficit, held for 13 days. On track for your goal.' },
  protein: { tone:'warn', text:'Under your protein target. Add a protein source to every meal.' },
  carbs:   { tone:'good', text:'Comfortably inside your carb target.' },
  fat:     { tone:'good', text:'Close to your fat target. No action needed.' },
  fibre:   { tone:'warn', text:'Significantly under your fibre target. Prioritise fibre-rich foods.' },
};
const V3M_DAYS = 31, V3M_ELAPSED = 13;

window.V3KcalDark = function V3KcalDark({ onNav }) {
  const [macro, setMacro] = React.useState('fibre');
  const m = V3M[macro], note = V3M_NOTE[macro];

  // every figure below is derived, never typed twice
  const logged = m.days.filter(v => v != null);
  const consumed = logged.reduce((a, b) => a + b, 0);
  const target = m.goal * V3M_ELAPSED;
  const delta = consumed - target;
  const under = logged.filter(v => v < m.goal).length;
  const over = logged.filter(v => v > m.goal).length;
  const missed = V3M_ELAPSED - logged.length;
  const pct = consumed / target * 100;
  const g = n => m.unit === 'kcal' ? Math.round(n).toLocaleString() : Math.round(n) + 'g';

  // chart — daily balance around the goal line
  const deltas = m.days.map(v => v == null ? null : v - m.goal);
  const maxAbs = Math.max(...deltas.filter(d => d != null).map(Math.abs));
  const yMax = Math.ceil(maxAbs / 5) * 5;
  const H = 148, half = H / 2;
  // Over-goal must never collide with the macro's own colour (it would on the Fat tab).
  const cUnder = m.color, cOver = m.color === v3.fat ? v3.lilac : v3.fat;

  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.paper}>
      <V3TopBar onBack={() => onNav && onNav('tracker')} kick="Tracker" title="Monthly macros"/>

      <div style={{ padding:'18px 18px 0' }}>
        <V3Card bg={v3.ink} r={32} pad={20} style={{ paddingBottom:38 }}>
          {/* month navigator */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <V3Kick color={v3.onDarkDimmer}>Monthly macros</V3Kick>
            <div style={{ display:'flex', alignItems:'center', gap:2 }}>
              <V3IconBtn size={28} bg="rgba(246,247,243,0.09)" color={v3.onDark}>‹</V3IconBtn>
              <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.12em', color:v3.onDark, minWidth:88, textAlign:'center', textTransform:'uppercase' }}>August 2026</span>
              <V3IconBtn size={28} bg="rgba(246,247,243,0.09)" color={v3.onDarkDimmer}>›</V3IconBtn>
            </div>
          </div>

          {/* shaded macro selectors */}
          <div style={{ display:'flex', gap:5, marginTop:16 }}>
            {Object.keys(V3M).map(k => {
              const on = k === macro;
              return (
                <button key={k} onClick={() => setMacro(k)} style={{
                  flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'8px 0',
                  background: on ? V3M[k].color : 'rgba(246,247,243,0.09)',
                  color: on ? v3.ink : v3.onDarkDim,
                  fontFamily:v3.sans, fontSize:10.5, fontWeight:700, letterSpacing:'-0.01em',
                  transition:'background 180ms ease-out',
                }}>{V3M[k].tab}</button>
              );
            })}
          </div>

          {/* hero — consumed against target */}
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginTop:20 }}>
            <div>
              <V3Kick color={v3.onDarkDimmer}>{m.label} consumed</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:42, fontWeight:700, letterSpacing:'-0.045em', color:v3.onDark, lineHeight:1, marginTop:8 }}>
                {m.unit === 'kcal' ? consumed.toLocaleString() : consumed}
                <span style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, color:v3.onDarkDim, marginLeft:5 }}>
                  {m.unit === 'kcal' ? 'kcal' : 'g'} / {g(target)}
                </span>
              </div>
            </div>
            <V3Chip bg={delta > 0 ? 'rgba(255,138,107,0.18)' : 'rgba(198,242,78,0.16)'}
              color={delta > 0 ? '#FFA98F' : v3.lime} size={10.5}>
              {delta > 0 ? '▲' : '▼'} {g(Math.abs(delta))} {delta > 0 ? 'over' : 'under'}
            </V3Chip>
          </div>

          {/* progress through the month */}
          <div style={{ marginTop:16 }}>
            <div style={{ height:3, borderRadius:999, background:'rgba(246,247,243,0.10)', overflow:'hidden' }}>
              <div style={{ width:`${V3M_ELAPSED / V3M_DAYS * 100}%`, height:'100%', background:'rgba(246,247,243,0.42)' }}/>
            </div>
            <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, letterSpacing:'0.1em', color:v3.onDarkDimmer, marginTop:8, textTransform:'uppercase' }}>
              <span style={{ color:v3.onDark }}>{V3M_ELAPSED}</span> of <span style={{ color:v3.onDark }}>{V3M_DAYS}</span> plan days progressed ({Math.round(V3M_ELAPSED / V3M_DAYS * 100)}%){missed > 0 ? ` · ${missed} not logged` : ''}
            </div>
          </div>

          {/* daily balance — bars synced to the macro colour */}
          <div style={{ marginTop:22 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <V3Kick color={v3.onDarkDimmer} style={{ fontSize:7.5 }}>Daily {m.label.toLowerCase()} balance</V3Kick>
              <span style={{ fontFamily:v3.sans, fontSize:9, fontWeight:700, letterSpacing:'0.08em', color:v3.onDarkDimmer, textTransform:'uppercase' }}>vs {m.goal}{m.unit === 'kcal' ? ' kcal' : 'g'} goal</span>
            </div>
            <div style={{ display:'flex', gap:9, marginTop:12 }}>
              {/* y axis */}
              <div style={{ width:24, height:H, position:'relative', flexShrink:0 }}>
                {[[0, `+${yMax}`], [half - 5, '0'], [H - 10, `−${yMax}`]].map(([top, l]) => (
                  <span key={l} style={{ position:'absolute', top, right:0, fontFamily:v3.sans, fontSize:8.5, fontWeight:700, color:v3.onDarkDimmer }}>{l}</span>
                ))}
              </div>
              {/* plot */}
              <div style={{ flex:1, height:H, position:'relative' }}>
                {/* goal line */}
                <div style={{ position:'absolute', left:0, right:0, top:half, borderTop:'1px dashed rgba(246,247,243,0.32)' }}/>
                {/* on-target band */}
                <div style={{ position:'absolute', left:0, right:0, top:half - half * 0.18, height:half * 0.36, background:'rgba(246,247,243,0.04)', borderRadius:3 }}/>
                <div style={{ position:'absolute', inset:0, display:'flex', gap:1.5, alignItems:'stretch' }}>
                  {Array.from({ length: V3M_DAYS }).map((_, i) => {
                    const future = i >= V3M_ELAPSED;
                    const d = future ? null : deltas[i];
                    if (future) return <div key={i} style={{ flex:1, alignSelf:'center', height:2, borderRadius:2, background:'rgba(246,247,243,0.05)' }}/>;
                    if (d == null) return (
                      <div key={i} style={{ flex:1, position:'relative' }}>
                        <div style={{ position:'absolute', left:0, right:0, top:half - 1.5, height:3, borderRadius:2, background:'rgba(246,247,243,0.13)' }}/>
                      </div>
                    );
                    const h = Math.max(Math.abs(d) / yMax * half, 3), up = d > 0;
                    return (
                      <div key={i} style={{ flex:1, position:'relative' }}>
                        <div style={{
                          position:'absolute', left:0, right:0, height:h, top: up ? half - h : half,
                          background: up ? cOver : cUnder, opacity:0.9,
                          borderRadius: up ? '3px 3px 1px 1px' : '1px 1px 3px 3px',
                        }}/>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginLeft:33, marginTop:8, fontFamily:v3.sans, fontSize:8.5, fontWeight:700, color:v3.onDarkDimmer }}>
              <span>1</span><span>8</span><span>15</span><span>22</span><span>31</span>
            </div>
            {/* legend */}
            <div style={{ display:'flex', gap:14, marginTop:12, marginLeft:33 }}>
              {[['Under goal', cUnder], ['Over goal', cOver], ['Not logged', 'rgba(246,247,243,0.13)']].map(([l, c]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:c, opacity: c.startsWith('rgba') ? 1 : 0.9 }}/>
                  <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:700, letterSpacing:'0.08em', color:v3.onDarkDimmer, textTransform:'uppercase' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* cumulative progress */}
          <div style={{ marginTop:22 }}>
            <V3Kick color={v3.onDarkDimmer} style={{ fontSize:7.5, marginBottom:9 }}>Cumulative progress</V3Kick>
            <div style={{ height:6, borderRadius:999, background:'rgba(246,247,243,0.10)', overflow:'hidden' }}>
              <div style={{ width:`${Math.min(pct, 100)}%`, height:'100%', borderRadius:999, background:m.color }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.onDarkDimmer }}>
              <span>0</span>
              <span style={{ color:m.color }}>{pct.toFixed(1)}% of {m.label.toLowerCase()} target</span>
              <span>{g(target)}</span>
            </div>
          </div>
        </V3Card>

        {/* popped out — the deficit message sits on top of the card's bottom edge */}
        <div style={{ margin:'-24px 14px 0', position:'relative' }}>
          <V3Card bg={note.tone === 'warn' ? v3.peach : v3.lime} r={22} pad={15}
            style={{ boxShadow:'0 14px 32px rgba(15,20,15,0.22)' }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:26, height:26, borderRadius:999, flexShrink:0, background:'rgba(15,20,15,0.14)', display:'grid', placeItems:'center', fontFamily:v3.sans, fontSize:13, fontWeight:800, color:v3.ink }}>
                {note.tone === 'warn' ? '!' : '✓'}
              </div>
              <div>
                <V3Kick color="rgba(15,20,15,0.5)">{note.tone === 'warn' ? `${m.label} deficit` : `${m.label} on track`}</V3Kick>
                <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:600, color:v3.ink, lineHeight:1.45, marginTop:6 }}>{note.text}</div>
              </div>
            </div>
          </V3Card>
        </div>

        <div style={{ height:22 }}/>
      </div>
    </V3Scaffold>
  );
};
