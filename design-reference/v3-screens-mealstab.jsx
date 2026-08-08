// v3 — Meals tab rebuilt from MealsTab.tsx (+ MacroBand.tsx, MealRow.tsx, useTracker.ts)
const { V3Scaffold, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3Check, V3IconBtn, V3Food, V3Ring, V3MacroTick } = window;

const V3_MEAL_LABELS = ['Breakfast','Lunch','Snack','Dinner','Snack 2'];

function V3NavArrow({ dir, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:30, height:30, borderRadius:999, flexShrink:0, cursor: disabled ? 'default' : 'pointer',
      background:'transparent', border:`1.5px solid ${disabled ? v3.line : v3.lineStrong}`,
      color: disabled ? v3.dimmer : v3.text, display:'grid', placeItems:'center',
      fontFamily:v3.sans, fontSize:13, fontWeight:700,
    }}>{dir === 'left' ? '‹' : '›'}</button>
  );
}

// MacroBand — "MACRO LOAD · X / Y kcal" + 4 columns of value/target + bar + label
function V3MacroBand({ cal, tCal, macros }) {
  const pct = Math.round((cal / tCal) * 100);
  return (
    <V3Card r={24} pad={16}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <V3Kick>Macro load · {cal.toLocaleString()} / {tCal.toLocaleString()} kcal</V3Kick>
        <V3Kick color={cal > tCal ? v3.warn : '#5F8C12'}>{Math.min(pct, 999)}%</V3Kick>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {macros.map(m => (
          <div key={m.label} style={{ flex:1 }}>
            <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, lineHeight:1 }}>
              {m.v}<span style={{ color:v3.dimmer, fontWeight:600 }}>/{m.t}g</span>
            </div>
            <div style={{ height:7 }}/>
            <V3Bar pct={Math.min(m.v / m.t, 1)} color={m.color} h={4}/>
            <div style={{ height:6 }}/>
            <V3Kick color={m.color} style={{ fontSize:8.5 }}>{m.label}</V3Kick>
          </div>
        ))}
      </div>
    </V3Card>
  );
}

window.V3Meals = function V3Meals({ onNav }) {
  const [selected, setSelected] = React.useState(2);
  const mealsPerDay = 4;
  const week = [
    { l:'M', n:20, eaten:4 }, { l:'T', n:21, eaten:4 }, { l:'W', n:22, eaten:3 },
    { l:'T', n:23, eaten:0, future:true }, { l:'F', n:24, eaten:0, future:true },
    { l:'S', n:25, eaten:0, future:true }, { l:'S', n:26, eaten:0, future:true },
  ];
  const meals = [
    { type:'Breakfast', time:'07:30', name:'Masala Egg White Scramble + Paneer Bhurji', k:280, p:42, c:8, f:9, eaten:true, tint:v3.butter },
    { type:'Lunch', time:'13:00', name:'Tandoori Chicken Breast + Cucumber Raita', k:360, p:55, c:12, f:10, eaten:true, tint:v3.peach },
    { type:'Snack', time:'17:00', name:'Roasted Chana + Buttermilk', k:130, p:10, c:14, f:3, eaten:true, swapped:true, tint:v3.lilac },
    { type:'Dinner', time:'20:00', name:'Grilled Fish + Sautéed Spinach + Tomato Soup', k:310, p:46, c:12, f:8, eaten:false, tint:v3.mint },
  ];
  const extras = [{ n:'Filter coffee with sugar', k:90, p:2, c:14, f:3, fi:0 }];
  const eaten = meals.filter(m => m.eaten).length;

  return (
    <V3Scaffold tab="meals" onNav={onNav}>
      {/* header */}
      <div style={{ padding:'16px 22px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <V3Kick>Apr 2026</V3Kick>
          <V3H size={32} style={{ marginTop:6 }}>Meals</V3H>
        </div>
        <V3Chip bg={v3.lime} size={10.5} style={{ textTransform:'uppercase', letterSpacing:'0.06em' }}>Day 3 of 14</V3Chip>
      </div>

      {/* week strip with nav */}
      <div style={{ padding:'18px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
          <V3NavArrow dir="left"/>
          <V3Kick>Week of 20 Apr</V3Kick>
          <V3NavArrow dir="right"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
          {week.map((d, i) => {
            const on = selected === i;
            return (
              <button key={i} onClick={() => setSelected(i)} style={{
                cursor:'pointer', borderRadius:18, padding:'10px 2px', opacity: d.future ? 0.65 : 1,
                background: on ? v3.lime : v3.card, border:'none',
                display:'flex', flexDirection:'column', alignItems:'center', gap:5,
              }}>
                <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color: on ? 'rgba(15,20,15,0.6)' : v3.dimmer, letterSpacing:'0.08em' }}>{d.l}</div>
                <div style={{ fontFamily:v3.disp, fontSize:17, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1 }}>{d.n}</div>
                <div style={{ display:'flex', gap:2.5 }}>
                  {[0,1,2,3].map(k => (
                    <div key={k} style={{ width:4, height:4, borderRadius:999, background: k < d.eaten ? (on ? v3.ink : '#5F8C12') : (on ? 'rgba(15,20,15,0.2)' : 'rgba(15,20,15,0.13)') }}/>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* lime hero — ring + macro ticks */}
      <div style={{ padding:'16px 22px 0' }}>
        <V3Card bg={v3.lime} r={32} pad={20}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <V3Kick color="rgba(15,20,15,0.5)">Today · {eaten} of {mealsPerDay} eaten</V3Kick>
            <V3Chip bg="rgba(15,20,15,0.10)" color={v3.ink} size={10.5}>On pace</V3Chip>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:18, marginTop:14 }}>
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

      {/* hydration */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card bg={v3.sky} r={24} pad={16} onClick={() => onNav && onNav('water')}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div>
              <V3Kick color="rgba(15,20,15,0.5)">Hydration</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.035em', marginTop:5 }}>
                1.5<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:'rgba(15,20,15,0.55)' }}> / 2.5L · 60%</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {Array.from({ length:10 }, (_, i) => (
                <div key={i} style={{ width:9, height:30, borderRadius:3, background: i < 6 ? v3.ink : 'rgba(15,20,15,0.18)' }}/>
              ))}
            </div>
          </div>
        </V3Card>
      </div>

      {/* today's plan */}
      <div style={{ padding:'24px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <V3Kick>Today’s plan</V3Kick>
          <button onClick={() => onNav && onNav('shopping')} style={{
            background:'none', border:'none', cursor:'pointer', padding:0,
            fontFamily:v3.sans, fontSize:12, fontWeight:700, color:'#5F8C12',
          }}>Shopping list →</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {meals.map((m, i) => (
            <V3Card key={i} r={24} pad={15} onClick={() => onNav && onNav(m.swapped ? 'mealSwapped' : 'meal')}>
              <div style={{ display:'flex', gap:13, alignItems:'flex-start' }}>
                <V3Food size={50} tint={m.tint} glyph={i === 3 ? 'leaf' : 'bowl'}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                    <V3Kick>{m.type} · {m.time}</V3Kick>
                    {m.swapped && <V3Chip bg={v3.limeSoft} color="#4C7010" size={9} pad="3px 7px">↻ Swapped</V3Chip>}
                  </div>
                  <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, letterSpacing:'-0.015em', lineHeight:1.3, marginTop:5, color: m.eaten ? v3.dim : v3.text }}>{m.name}</div>
                  <div style={{ display:'flex', gap:6, marginTop:9, flexWrap:'wrap' }}>
                    <V3Chip bg={v3.paper} size={10} pad="4px 9px">{m.k} kcal</V3Chip>
                    <V3Chip bg="rgba(111,185,59,0.14)" color="#4C8526" size={10} pad="4px 9px">P {m.p}</V3Chip>
                    <V3Chip bg="rgba(242,185,59,0.16)" color="#8A6410" size={10} pad="4px 9px">C {m.c}</V3Chip>
                    <V3Chip bg="rgba(255,138,107,0.16)" color="#B3492C" size={10} pad="4px 9px">F {m.f}</V3Chip>
                  </div>
                  {/* swap + change */}
                  <div style={{ display:'flex', gap:14, alignItems:'center', marginTop:11 }}>
                    <button onClick={e => { e.stopPropagation(); onNav && onNav(m.swapped ? 'meals' : 'replaceSheet'); }} style={{
                      background:'transparent', border:'none', padding:0, cursor:'pointer',
                      fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.08em', color:v3.dimmer, textTransform:'uppercase',
                    }}>{m.swapped ? 'Undo swap' : '↻ Swap meal'}</button>
                    <button onClick={e => { e.stopPropagation(); onNav && onNav('changeMeal'); }} style={{
                      background:'transparent', border:'none', padding:0, cursor:'pointer',
                      fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.08em', color:v3.dimmer, textTransform:'uppercase',
                    }}>✎ Change</button>
                  </div>
                </div>
                <V3Check on={m.eaten} size={26}/>
              </div>
            </V3Card>
          ))}
        </div>

        {/* extra meals logged */}
        {extras.length > 0 && (
          <div style={{ marginTop:20 }}>
            <V3Kick style={{ marginBottom:11 }}>Extra meals logged</V3Kick>
            {extras.map((e, i) => (
              <V3Card key={i} r={22} pad={14} border={v3.lineStrong} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, lineHeight:1.3 }}>{e.n}</div>
                    <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                      <V3Chip bg={v3.paper} size={10} pad="4px 9px">{e.k} kcal</V3Chip>
                      <V3Chip bg="rgba(111,185,59,0.14)" color="#4C8526" size={10} pad="4px 9px">P {e.p}</V3Chip>
                      <V3Chip bg="rgba(242,185,59,0.16)" color="#8A6410" size={10} pad="4px 9px">C {e.c}</V3Chip>
                      <V3Chip bg="rgba(255,138,107,0.16)" color="#B3492C" size={10} pad="4px 9px">F {e.f}</V3Chip>
                    </div>
                  </div>
                  <V3Kick style={{ flexShrink:0 }}>Off-plan</V3Kick>
                </div>
              </V3Card>
            ))}
          </div>
        )}

        <V3Btn kind="ghost" full onClick={() => onNav && onNav('addMeal')} style={{ borderStyle:'dashed', color:v3.text, marginTop:10 }}>
          + Log extra meal
        </V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Meals · no plan for this date ────────────────────────────
window.V3MealsNoPlan = function V3MealsNoPlan({ onNav }) {
  return (
    <V3Scaffold tab="meals" onNav={onNav}>
      <div style={{ padding:'16px 22px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div><V3Kick>Apr 2026</V3Kick><V3H size={32} style={{ marginTop:6 }}>Meals</V3H></div>
      </div>
      <div style={{ padding:'20px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
          <V3NavArrow dir="left"/><V3Kick>Week of 06 Apr</V3Kick><V3NavArrow dir="right"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
          {['M','T','W','T','F','S','S'].map((l, i) => (
            <div key={i} style={{ borderRadius:18, padding:'10px 2px', background:v3.card, opacity:0.35, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
              <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.dimmer }}>{l}</div>
              <div style={{ fontFamily:v3.disp, fontSize:17, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1 }}>{6 + i}</div>
              <div style={{ display:'flex', gap:2.5 }}>
                {[0,1,2,3].map(k => <div key={k} style={{ width:4, height:4, borderRadius:999, background:'rgba(15,20,15,0.13)' }}/>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Kick>Before plan start</V3Kick>
        <V3H size={23} style={{ marginTop:6 }}>8 April</V3H>
      </div>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={26} pad={20}>
          <V3Kick>No plan</V3Kick>
          <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, marginTop:9, lineHeight:1.55 }}>
            No meal plan for this date. Your plan started on 20 April and repeats every 14 days.
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};
