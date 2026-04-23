// Meal detail + Water + related views
const { S2Scaffold, S2Card, S2Bar, S2VBar, S2Check, S2Placeholder, s2HairLabel, s2Pill, s2Btn, s2DataRow } = window;

// Top back bar for deep screens
window.S2TopBar = function TopBar({ onBack, title, kicker, right }) {
  const s2 = window.s2;
  return (
    <div style={{ padding:'6px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <button onClick={onBack} style={{
        background:'transparent', border:`1px solid ${s2.lineStrong}`,
        width: 36, height: 36, color: s2.text, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <svg width="11" height="11" viewBox="0 0 11 11"><path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
      </button>
      <div style={{ textAlign:'center' }}>
        {kicker && <s2HairLabel>{kicker}</s2HairLabel>}
        {title && <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500, marginTop: 2 }}>{title}</div>}
      </div>
      <div style={{ width: 36, height: 36, display:'flex', alignItems:'center', justifyContent:'center' }}>{right}</div>
    </div>
  );
};

// ─── Meal detail ───────────────────────────────────────────────
window.S2MealDetail = function MealDetail({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <window.S2TopBar onBack={() => onNav && onNav('meals')} kicker="MEAL · 02 OF 04" title="Lunch · 13:00"/>

      <div style={{ padding:'18px 20px 0' }}>
        <S2Placeholder h={210} label="HERO · TANDOORI CHICKEN PLATE"/>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel color={s2.accent}>LUNCH · 13:00 · 1 PORTION</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 400, letterSpacing:'-0.025em', marginTop: 6, lineHeight: 1.1 }}>
          Tandoori Chicken Breast + Cucumber Raita
        </div>
        <div style={{ fontFamily: s2.sans, fontSize: 14, color: s2.textDim, marginTop: 10, lineHeight: 1.55 }}>
          Marinated in yogurt and garam masala, cooked on high heat for a smoky char. Served with cool cucumber raita and a side of lightly stir-fried cabbage with cumin.
        </div>
      </div>

      {/* Macro hero */}
      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={18}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div>
              <s2HairLabel>ENERGY</s2HairLabel>
              <div style={{ fontFamily: s2.sans, fontSize: 54, fontWeight: 300, letterSpacing:'-0.035em', lineHeight: 0.95, marginTop: 4 }}>
                360<span style={{ fontSize: 16, color: s2.textDim, marginLeft: 6 }}>kcal</span>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <s2HairLabel>27%</s2HairLabel>
              <s2HairLabel color={s2.textDim} style={{ marginTop: 2 }}>OF DAILY</s2HairLabel>
            </div>
          </div>
          <div style={{ height: 18 }}/>
          <div style={{ display:'flex', gap: 20, alignItems:'flex-end' }}>
            {[
              { v:55, t:165, c: s2.protein, label:'PROTEIN', k:'P' },
              { v:12, t:60,  c: s2.carbs,   label:'CARBS',   k:'C' },
              { v:10, t:45,  c: s2.fat,     label:'FAT',     k:'F' },
              { v:3,  t:25,  c: s2.fibre,   label:'FIBRE',   k:'Fi' },
            ].map(m => (
              <div key={m.k} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex: 1, gap: 8 }}>
                <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.text }}>{m.v}<span style={{ color: s2.textDim, fontSize: 9 }}>g</span></div>
                <S2VBar pct={m.v/m.t} color={m.c} h={70}/>
                <s2HairLabel color={m.c} style={{ fontSize: 8 }}>{m.label}</s2HairLabel>
              </div>
            ))}
          </div>
        </S2Card>
      </div>

      {/* Impact on day */}
      <div style={{ padding:'18px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel>IMPACT ON TODAY</s2HairLabel>
          <div style={{ display:'flex', gap: 14, marginTop: 10, alignItems:'baseline' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim }}>BEFORE</div>
              <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, marginTop: 2 }}>610<span style={{ fontSize: 10, color: s2.textDim }}>kcal</span></div>
            </div>
            <div style={{ fontFamily: s2.mono, fontSize: 14, color: s2.accent }}>→</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.accent }}>AFTER</div>
              <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, marginTop: 2, color: s2.accent }}>970<span style={{ fontSize: 10, color: s2.textDim }}>kcal</span></div>
            </div>
          </div>
        </S2Card>
      </div>

      {/* Ingredients */}
      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 4 }}>INGREDIENTS · 7</s2HairLabel>
        {[
          ['Chicken breast', '150 g'],
          ['Greek yogurt', '60 g'],
          ['Ginger-garlic paste', '10 g'],
          ['Garam masala', '2 g'],
          ['Cucumber', '80 g'],
          ['Cabbage, shredded', '70 g'],
          ['Lemon', '½'],
        ].map(([n,q], i, arr) => <s2DataRow key={n} label={n} value={q} last={i===arr.length-1}/>)}
      </div>

      {/* CTAs */}
      <div style={{ padding:'22px 20px 0', display:'flex', flexDirection:'column', gap: 10 }}>
        <s2Btn full primary onClick={() => onNav && onNav('meals')}>MARK AS EATEN</s2Btn>
        <s2Btn full onClick={() => onNav && onNav('replaceSheet')}>↻ SWAP WITH AI</s2Btn>
      </div>
      <div style={{ height: 24 }}/>
    </S2Scaffold>
  );
};

// ─── Water sheet ───────────────────────────────────────────────
// Beaker glass — flat-top silhouette with inward-slanted sides, same 2:3 height as the previous pyramid.
const S2WaterGlass = ({ on, i, s2, onClick }) => {
  const fill = on ? s2.accent : 'transparent';
  const stroke = on ? s2.accent : s2.lineStrong;
  return (
    <button onClick={onClick} style={{
      aspectRatio:'2/3', background:'transparent', border:'none', padding: 0,
      cursor:'pointer', position:'relative',
    }}>
      <svg width="100%" height="100%" viewBox="0 0 30 45" preserveAspectRatio="none">
        {/* Beaker body: narrower at top, flares slightly outward to base */}
        <path d="M 5 3 L 25 3 L 27 42 L 3 42 Z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="miter"/>
        {/* Waterline tick on filled glasses */}
        {on && <line x1="4" y1="14" x2="26" y2="14" stroke={s2.bg} strokeWidth="1" opacity="0.35"/>}
      </svg>
      <div style={{
        position:'absolute', top: '50%', left: 0, right: 0, transform:'translateY(-50%)',
        textAlign:'center', fontFamily: s2.mono, fontSize: 11, fontWeight: 600,
        color: on ? '#0C0907' : s2.textDimmer, letterSpacing:'0.05em',
      }}>{i + 1}</div>
    </button>
  );
};

window.S2Water = function Water({ onNav }) {
  const s2 = window.s2;
  const [filled, setFilled] = React.useState(6);
  return (
    <S2Scaffold tab="meals" onNav={onNav}>
      <window.S2TopBar onBack={() => onNav && onNav('meals')} kicker="HYDRATION" title="Water intake"/>

      <div style={{ padding:'28px 20px 0', textAlign:'center' }}>
        <s2HairLabel>TODAY · GOAL 3.0 L</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 96, fontWeight: 200, letterSpacing:'-0.05em', color: s2.accent, lineHeight: 1, marginTop: 10 }}>
          {(filled * 0.3).toFixed(1)}<span style={{ fontSize: 24, color: s2.textDim, marginLeft: 6 }}>L</span>
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDim, marginTop: 6, letterSpacing:'0.15em' }}>{Math.round(filled*10)}% · {filled} OF 10 GLASSES</div>
      </div>

      {/* Glasses grid */}
      <div style={{ padding:'30px 28px 0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 10 }}>
          {Array.from({length:10}, (_,i) => (
            <S2WaterGlass key={i} on={i < filled} i={i} s2={s2}
              onClick={() => setFilled(i + 1 === filled ? i : i + 1)}/>
          ))}
        </div>
      </div>

      {/* Quick log */}
      <div style={{ padding:'28px 20px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 10 }}>
        {[
          { l:'+1 GLASS', s:'250 ml' },
          { l:'+BOTTLE',  s:'500 ml' },
          { l:'+LITER',   s:'1.0 L' },
        ].map((x,i) => (
          <button key={i} style={{
            background:'transparent', border:`1px solid ${s2.lineStrong}`,
            padding:'14px 8px', cursor:'pointer', color: s2.text,
          }}>
            <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing:'0.15em', color: s2.accent }}>{x.l}</div>
            <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, marginTop: 4, letterSpacing:'0.1em' }}>{x.s}</div>
          </button>
        ))}
      </div>

      {/* 7 day */}
      <div style={{ padding:'28px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>LAST 7 DAYS</s2HairLabel>
        <div style={{ display:'flex', alignItems:'flex-end', gap: 8, height: 80 }}>
          {[2.4, 2.8, 3.0, 2.6, 2.2, 3.1, 1.8].map((v, i) => (
            <div key={i} style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', gap: 6 }}>
              <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim }}>{v}L</div>
              <div style={{ width:'100%', background: s2.surface2, height: 54, position:'relative' }}>
                <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${(v/3.5)*100}%`, background: i === 6 ? s2.accent : s2.accentSoft, opacity: i === 6 ? 1 : 0.4 }}/>
              </div>
              <s2HairLabel style={{ fontSize: 8 }}>{['M','T','W','T','F','S','S'][i]}</s2HairLabel>
            </div>
          ))}
        </div>
      </div>
    </S2Scaffold>
  );
};

// ─── Monthly kcal detail ─────────────────────────────────────
window.S2Kcal = function Kcal({ onNav }) {
  const s2 = window.s2;
  const days = [1250,1310,1290,1210,1320,1280,1340,1360,1250,1190,1220,1310,1290,1265];
  return (
    <S2Scaffold tab="tracker" onNav={onNav}>
      <window.S2TopBar onBack={() => onNav && onNav('tracker')} kicker="APRIL 2026" title="Daily calories"/>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel>14-DAY AVERAGE</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 72, fontWeight: 300, letterSpacing:'-0.04em', color: s2.accent, lineHeight: 0.95, marginTop: 6 }}>
          1,268<span style={{ fontSize: 16, color: s2.textDim, marginLeft: 6 }}>kcal/d</span>
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.textDim, marginTop: 6, letterSpacing:'0.1em' }}>
          4% UNDER TARGET · HEALTHY DEFICIT
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ padding:'24px 20px 0' }}>
        <S2Card padding={16}>
          <div style={{ display:'flex', alignItems:'flex-end', gap: 4, height: 160, position:'relative' }}>
            <div style={{ position:'absolute', top: 20, left: 0, right: 0, borderTop:`1px dashed ${s2.lineStrong}`, zIndex: 0 }}/>
            <div style={{ position:'absolute', top: 16, right: 0, fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer }}>TGT 1,320</div>
            {days.map((v,i) => (
              <div key={i} style={{ flex:1, height:'100%', display:'flex', alignItems:'flex-end', position:'relative', zIndex: 1 }}>
                <div style={{ width:'100%', height:`${(v/1500)*100}%`, background: v > 1320 ? s2.warn : s2.accent, opacity: i === days.length - 1 ? 1 : 0.7 }}/>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing:'0.1em' }}>
            <span>APR 9</span><span>APR 22</span>
          </div>
        </S2Card>
      </div>

      {/* Breakdown */}
      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 4 }}>BREAKDOWN</s2HairLabel>
        <s2DataRow label="BEST DAY"    value="1,190" unit="kcal · Apr 13"/>
        <s2DataRow label="WORST DAY"   value="1,360" unit="kcal · Apr 16" accent={s2.warn}/>
        <s2DataRow label="HIT TARGET"  value="12/14" unit="days" accent={s2.accent}/>
        <s2DataRow label="DEFICIT"     value="−7,280" unit="kcal" accent={s2.accent} last/>
      </div>
    </S2Scaffold>
  );
};
