// Flow screens: swap/replace, add meal, weight log, customise, meal prep, regen
const { S2Scaffold, S2TopBar, S2Card, S2Bar, S2VBar, S2Check, S2Placeholder, s2HairLabel, s2Pill, s2Btn, s2DataRow } = window;

// ─── Swap · Sheet (choice: search / AI) ───────────────────────
window.S2ReplaceSheet = function ReplaceSheet({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('meal')} kicker="MEAL · DINNER" title="Swap meal"/>

      <div style={{ padding:'18px 20px 0' }}>
        <S2Card padding={14} style={{ borderColor: s2.accentSoft, background: 'rgba(255,176,102,0.04)' }}>
          <s2HairLabel>REPLACING</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 15, fontWeight: 500, marginTop: 4 }}>
            Grilled Fish + Sautéed Spinach + Tomato Soup
          </div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 6 }}>
            310 kcal · 46P · 12C · 8F · 6Fi
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'24px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>PICK A METHOD</s2HairLabel>

        <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
          <button onClick={() => onNav && onNav('replaceSearch')} style={{
            background: s2.surface, border:`1px solid ${s2.line}`, textAlign:'left',
            padding: 18, cursor:'pointer', color: s2.text,
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap: 14 }}>
              <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent }}>01</div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily: s2.sans, fontSize: 17, fontWeight: 500 }}>Search food database</div>
                <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 4 }}>Pick from 2,400 Indian & global dishes. Exact macros.</div>
              </div>
              <div style={{ color: s2.accent }}>→</div>
            </div>
          </button>

          <button onClick={() => onNav && onNav('replaceAI')} style={{
            background: s2.accentFill, border:`1px solid ${s2.accent}`, textAlign:'left',
            padding: 18, cursor:'pointer', color: s2.text,
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap: 14 }}>
              <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent }}>02</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
                  <div style={{ fontFamily: s2.sans, fontSize: 17, fontWeight: 500 }}>Ask AI to suggest</div>
                  <s2Pill color={s2.accent}>RECOMMENDED</s2Pill>
                </div>
                <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 4 }}>Describe what you want. AI matches macros automatically.</div>
              </div>
              <div style={{ color: s2.accent }}>→</div>
            </div>
          </button>
        </div>
      </div>

      {/* Quick alternatives */}
      <div style={{ padding:'26px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>QUICK ALTERNATIVES</s2HairLabel>
        {[
          { n:'Grilled Paneer Tikka + Salad', k:295, p:38, c:10, f:11 },
          { n:'Egg Bhurji + Multigrain Roti',  k:320, p:42, c:18, f:9 },
          { n:'Moong Dal + Cucumber Kachumber', k:280, p:36, c:22, f:6 },
        ].map((o, i, arr) => (
          <div key={i} onClick={() => onNav && onNav('replaceResult')} style={{
            padding:'14px 0', borderBottom: i === arr.length-1 ? 'none' : `1px solid ${s2.line}`,
            cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div>
              <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500 }}>{o.n}</div>
              <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 4 }}>
                {o.k} kcal · <span style={{ color: s2.protein }}>P{o.p}</span> · <span style={{ color: s2.carbs }}>C{o.c}</span> · <span style={{ color: s2.fat }}>F{o.f}</span>
              </div>
            </div>
            <div style={{ color: s2.textDim }}>→</div>
          </div>
        ))}
      </div>
    </S2Scaffold>
  );
};

// ─── Swap · Search ────────────────────────────────────────────
window.S2ReplaceSearch = function ReplaceSearch({ onNav }) {
  const s2 = window.s2;
  const results = [
    { n:'Chicken Tikka', k:240, p:32 },
    { n:'Chicken Biryani (small)', k:420, p:24 },
    { n:'Chicken Shawarma Plate', k:520, p:42 },
    { n:'Chicken Curry + Rice', k:480, p:28 },
    { n:'Chicken Kathi Roll', k:380, p:26 },
  ];
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('replaceSheet')} kicker="SEARCH · FOOD DATABASE" title="Find food"/>

      <div style={{ padding:'18px 20px 0' }}>
        <div style={{
          border:`1px solid ${s2.accent}`, background: s2.surface,
          padding:'14px 16px', display:'flex', alignItems:'center', gap: 12,
        }}>
          <div style={{ color: s2.accent, fontFamily: s2.mono, fontSize: 14 }}>⌕</div>
          <div style={{ flex:1, fontFamily: s2.sans, fontSize: 16, color: s2.text }}>
            chicken<span style={{ display:'inline-block', width: 1, height: 16, background: s2.accent, marginLeft: 2, verticalAlign:'middle' }}/>
          </div>
          <s2HairLabel color={s2.textDim}>5 HITS</s2HairLabel>
        </div>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>RESULTS</s2HairLabel>
        {results.map((r, i, arr) => (
          <div key={i} onClick={() => onNav && onNav('replaceQty')} style={{
            padding:'14px 0', borderBottom: i === arr.length-1 ? 'none' : `1px solid ${s2.line}`,
            cursor:'pointer', display:'flex', alignItems:'center', gap: 12,
          }}>
            <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer, width: 18 }}>{String(i+1).padStart(2,'0')}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily: s2.sans, fontSize: 14, fontWeight: 500 }}>{r.n}</div>
              <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 3 }}>
                {r.k} kcal · <span style={{ color: s2.protein }}>P{r.p}g</span>
              </div>
            </div>
            <div style={{ color: s2.accent }}>+</div>
          </div>
        ))}
      </div>
    </S2Scaffold>
  );
};

// ─── Swap · Quantity ──────────────────────────────────────────
window.S2ReplaceQty = function ReplaceQty({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('replaceSearch')} kicker="ADJUST QUANTITY" title="Chicken Tikka"/>

      <div style={{ padding:'18px 20px 0' }}>
        <S2Placeholder h={170} label="CHICKEN TIKKA"/>
      </div>

      <div style={{ padding:'28px 20px 0', textAlign:'center' }}>
        <s2HairLabel>PORTION</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 72, fontWeight: 300, letterSpacing:'-0.04em', color: s2.accent, lineHeight: 1, marginTop: 10 }}>
          150<span style={{ fontSize: 18, color: s2.textDim, marginLeft: 6 }}>g</span>
        </div>

        <div style={{ display:'flex', justifyContent:'center', gap: 14, marginTop: 22 }}>
          {['−50','−10','+10','+50'].map((s,i) => (
            <button key={i} style={{
              background:'transparent', border:`1px solid ${s2.lineStrong}`,
              padding:'10px 14px', fontFamily: s2.mono, fontSize: 12, fontWeight: 600,
              color: s2.text, cursor:'pointer', minWidth: 52,
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Live macros */}
      <div style={{ padding:'28px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel>AT 150 G</s2HairLabel>
          <div style={{ display:'flex', gap: 14, marginTop: 12, alignItems:'flex-end' }}>
            {[
              { v:240, u:'kcal', c: s2.accent, l:'ENERGY' },
              { v:32,  u:'g',    c: s2.protein, l:'PROTEIN' },
              { v:4,   u:'g',    c: s2.carbs,   l:'CARBS' },
              { v:11,  u:'g',    c: s2.fat,     l:'FAT' },
            ].map((m,i) => (
              <div key={i} style={{ flex:1 }}>
                <div style={{ fontFamily: s2.sans, fontSize: 20, fontWeight: 400, color: m.c, letterSpacing:'-0.02em' }}>
                  {m.v}<span style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, marginLeft: 2 }}>{m.u}</span>
                </div>
                <s2HairLabel color={m.c} style={{ fontSize: 8, marginTop: 4 }}>{m.l}</s2HairLabel>
              </div>
            ))}
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'24px 20px 0' }}>
        <s2Btn full primary onClick={() => onNav && onNav('replaceResult')}>CONFIRM SWAP</s2Btn>
      </div>
    </S2Scaffold>
  );
};

// ─── Swap · AI prompt ─────────────────────────────────────────
window.S2ReplaceAI = function ReplaceAI({ onNav }) {
  const s2 = window.s2;
  const chips = ['Something light', 'Quick · under 15 min', 'No dairy', 'High protein', 'Spicy', 'South Indian'];
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('replaceSheet')} kicker="AI SWAP" title="Describe your craving"/>

      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={16}>
          <s2HairLabel>YOU</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 20, fontWeight: 400, marginTop: 8, letterSpacing:'-0.01em', lineHeight: 1.3 }}>
            I want something warm, high protein, not fish — fish again feels repetitive.
          </div>
          <div style={{ marginTop: 10, fontFamily: s2.mono, fontSize: 10, color: s2.textDim, letterSpacing:'0.1em' }}>
            ── 89 CHARS
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>OR PICK A HINT</s2HairLabel>
        <div style={{ display:'flex', flexWrap:'wrap', gap: 8 }}>
          {chips.map((c,i) => (
            <button key={i} style={{
              background:'transparent', border:`1px solid ${s2.lineStrong}`,
              padding:'8px 12px', fontFamily: s2.sans, fontSize: 12, fontWeight: 400,
              color: s2.text, cursor:'pointer',
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'28px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel>CONSTRAINTS KEPT</s2HairLabel>
          <div style={{ marginTop: 8 }}>
            <s2DataRow label="TARGET KCAL" value="≈ 310" accent={s2.accent}/>
            <s2DataRow label="TARGET PROTEIN" value="≈ 46g" accent={s2.protein}/>
            <s2DataRow label="BUDGET" value="UNDER 20 MIN" last/>
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'24px 20px 0' }}>
        <s2Btn full primary onClick={() => onNav && onNav('replaceResult')}>GENERATE OPTIONS →</s2Btn>
      </div>
    </S2Scaffold>
  );
};

// ─── Swap · Result ────────────────────────────────────────────
window.S2ReplaceResult = function ReplaceResult({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('replaceAI')} kicker="AI PICKED" title="Match · 97%"/>

      <div style={{ padding:'18px 20px 0' }}>
        <S2Placeholder h={200} label="CHICKEN SHORBA"/>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel color={s2.accent}>DINNER · 20:00 · 1 BOWL + ROTI</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 400, letterSpacing:'-0.025em', marginTop: 6, lineHeight: 1.1 }}>
          Chicken Shorba + Multigrain Roti
        </div>
        <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 10, lineHeight: 1.55 }}>
          Warming chicken broth with black pepper and ginger, served with a single multigrain roti. Ready in 18 minutes. High protein, no fish.
        </div>
      </div>

      {/* Diff card */}
      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel>VS ORIGINAL</s2HairLabel>
          <div style={{ marginTop: 10 }}>
            {[
              { l:'ENERGY',  a:'310', b:'305', u:'kcal', d:'−5' },
              { l:'PROTEIN', a:'46',  b:'44',  u:'g',    d:'−2' },
              { l:'CARBS',   a:'12',  b:'20',  u:'g',    d:'+8' },
              { l:'FAT',     a:'8',   b:'7',   u:'g',    d:'−1' },
              { l:'FIBRE',   a:'6',   b:'4',   u:'g',    d:'−2' },
            ].map((r,i,arr) => (
              <div key={i} style={{ display:'flex', padding:'10px 0', borderBottom: i === arr.length-1 ? 'none' : `1px solid ${s2.line}`, alignItems:'baseline' }}>
                <div style={{ flex:1, fontFamily: s2.mono, fontSize: 9, letterSpacing:'0.22em', color: s2.textDimmer }}>{r.l}</div>
                <div style={{ fontFamily: s2.mono, fontSize: 12, color: s2.textDim, textAlign:'right', width: 56, textDecoration:'line-through' }}>{r.a}{r.u}</div>
                <div style={{ fontFamily: s2.mono, fontSize: 12, color: s2.text, textAlign:'right', width: 56, marginLeft: 8 }}>{r.b}{r.u}</div>
                <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.accent, textAlign:'right', width: 40, marginLeft: 8 }}>{r.d}</div>
              </div>
            ))}
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'22px 20px 0', display:'flex', flexDirection:'column', gap: 10 }}>
        <s2Btn full primary onClick={() => onNav && onNav('meals')}>ACCEPT SWAP</s2Btn>
        <s2Btn full onClick={() => onNav && onNav('replaceAI')}>TRY ANOTHER</s2Btn>
      </div>
      <div style={{ height: 24 }}/>
    </S2Scaffold>
  );
};

// ─── Add extra meal ───────────────────────────────────────────
window.S2AddMeal = function AddMeal({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('meals')} kicker="OFF-PLAN" title="Log extra meal"/>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>WHAT DID YOU EAT?</s2HairLabel>
        <div style={{
          border:`1px solid ${s2.accent}`, background: s2.surface,
          padding:'18px 16px', fontFamily: s2.sans, fontSize: 15, color: s2.text,
          minHeight: 96, lineHeight: 1.5,
        }}>
          Two slices of wheat toast with peanut butter and a small banana<span style={{ display:'inline-block', width: 1, height: 16, background: s2.accent, marginLeft: 2, verticalAlign:'middle' }}/>
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 6, letterSpacing:'0.1em' }}>
          63 / 200
        </div>
      </div>

      {/* AI estimate */}
      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={16} style={{ borderColor: s2.accent }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <s2HairLabel color={s2.accent}>AI ESTIMATE</s2HairLabel>
            <s2HairLabel>CONFIDENCE · HIGH</s2HairLabel>
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 44, fontWeight: 300, letterSpacing:'-0.03em', color: s2.accent, lineHeight: 1, marginTop: 10 }}>
            340<span style={{ fontSize: 14, color: s2.textDim, marginLeft: 4 }}>kcal</span>
          </div>
          <div style={{ display:'flex', gap: 14, marginTop: 14 }}>
            {[
              { l:'PROTEIN', v:10, c: s2.protein },
              { l:'CARBS',   v:42, c: s2.carbs },
              { l:'FAT',     v:14, c: s2.fat },
              { l:'FIBRE',   v:6,  c: s2.fibre },
            ].map((m,i) => (
              <div key={i} style={{ flex:1 }}>
                <div style={{ fontFamily: s2.mono, fontSize: 14, fontWeight: 500, color: m.c }}>{m.v}<span style={{ fontSize: 9, color: s2.textDim }}>g</span></div>
                <s2HairLabel color={m.c} style={{ fontSize: 8, marginTop: 4 }}>{m.l}</s2HairLabel>
              </div>
            ))}
          </div>
        </S2Card>
      </div>

      {/* When */}
      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>WHEN</s2HairLabel>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 6 }}>
          {[
            { l:'JUST NOW', on: true },
            { l:'1H AGO' },
            { l:'BREAKFAST' },
            { l:'CUSTOM' },
          ].map((x,i) => (
            <button key={i} style={{
              background: x.on ? s2.accentFill : 'transparent',
              border:`1px solid ${x.on ? s2.accent : s2.lineStrong}`,
              color: x.on ? s2.accent : s2.text,
              padding:'12px 6px', fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.1em',
              cursor:'pointer',
            }}>{x.l}</button>
          ))}
        </div>
      </div>

      {/* Impact */}
      <div style={{ padding:'22px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel>TODAY AFTER LOGGING</s2HairLabel>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, alignItems:'baseline' }}>
            <div style={{ fontFamily: s2.sans, fontSize: 24, fontWeight: 300 }}>1,310<span style={{ fontSize: 11, color: s2.textDim }}>/1,320 kcal</span></div>
            <s2HairLabel color={s2.warn}>10 kcal LEFT</s2HairLabel>
          </div>
          <div style={{ height: 8 }}/>
          <S2Bar pct={1310/1320} color={s2.warn}/>
        </S2Card>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2Btn full primary onClick={() => onNav && onNav('meals')}>LOG MEAL</s2Btn>
      </div>
    </S2Scaffold>
  );
};

// ─── Weight log ───────────────────────────────────────────────
window.S2WeightLog = function WeightLog({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('profile')} kicker="ENTRY · 22 APR 07:42" title="Log weight"/>

      <div style={{ padding:'40px 20px 0', textAlign:'center' }}>
        <s2HairLabel>YOUR WEIGHT</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 120, fontWeight: 200, letterSpacing:'-0.06em', color: s2.accent, lineHeight: 0.9, marginTop: 14 }}>
          69.8
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 14, color: s2.textDim, letterSpacing:'0.15em', marginTop: 8 }}>KG</div>
        <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent, marginTop: 14, letterSpacing:'0.1em' }}>
          ↓ 0.3 KG SINCE LAST ENTRY · 3d
        </div>
      </div>

      {/* Numeric slider track */}
      <div style={{ padding:'42px 20px 0' }}>
        <div style={{ position:'relative', height: 48 }}>
          <div style={{ position:'absolute', top: 22, left: 0, right: 0, height: 1, background: s2.lineStrong }}/>
          <div style={{ position:'absolute', top: 8, left:'50%', transform:'translateX(-50%)', width: 2, height: 30, background: s2.accent }}/>
          <div style={{ position:'absolute', top: 0, left:'50%', transform:'translateX(-50%)', fontFamily: s2.mono, fontSize: 10, color: s2.accent, whiteSpace:'nowrap' }}>69.8</div>
          {[66,67,68,69,70,71,72,73,74].map((v,i) => {
            const left = (i / 8) * 100;
            return (
              <React.Fragment key={v}>
                <div style={{ position:'absolute', top: 18, left:`${left}%`, width: 1, height: 10, background: v === 70 ? s2.accent : s2.textDimmer }}/>
                <div style={{ position:'absolute', top: 32, left:`${left}%`, transform:'translateX(-50%)', fontFamily: s2.mono, fontSize: 9, color: s2.textDim }}>{v}</div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Projection after log */}
      <div style={{ padding:'40px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel>IMPACT ON TREND</s2HairLabel>
          <div style={{ marginTop: 10 }}>
            <s2DataRow label="28-DAY AVG" value="70.8" unit="kg"/>
            <s2DataRow label="FROM START" value="−2.4" unit="kg" accent={s2.accent}/>
            <s2DataRow label="TO GOAL"    value="−1.8" unit="kg"/>
            <s2DataRow label="GOAL ETA"   value="03 JUN 26" accent={s2.accent} last/>
          </div>
        </S2Card>
      </div>

      <div style={{ padding:'26px 20px 0', display:'flex', gap: 10 }}>
        <s2Btn onClick={() => onNav && onNav('profile')} style={{ flex:1 }}>CANCEL</s2Btn>
        <s2Btn primary onClick={() => onNav && onNav('profile')} style={{ flex:2 }}>SAVE ENTRY</s2Btn>
      </div>
    </S2Scaffold>
  );
};

// ─── Customise plan ───────────────────────────────────────────
window.S2Customise = function Customise({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('profile')} kicker="PLAN RULES" title="Customise"/>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>FREE-FORM INSTRUCTIONS</s2HairLabel>
        <div style={{
          border:`1px solid ${s2.lineStrong}`, background: s2.surface,
          padding:'14px 16px', minHeight: 120, fontFamily: s2.sans, fontSize: 14,
          color: s2.text, lineHeight: 1.55,
        }}>
          Keep breakfast eggs-heavy on weekdays. No fish more than twice a week. Lunch must be under 400 kcal on training days. Prefer one-pot meals for dinner.<span style={{ display:'inline-block', width: 1, height: 16, background: s2.accent, marginLeft: 2, verticalAlign:'middle' }}/>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 4 }}>RULES</s2HairLabel>
        {[
          { l:'VEGETARIAN ONLY',      on: false },
          { l:'NO SEAFOOD',           on: false },
          { l:'LACTOSE-FREE',         on: false },
          { l:'HIGH-PROTEIN PRIORITY', on: true },
          { l:'MINIMIZE PREP TIME',   on: true },
          { l:'SPICY MEALS',          on: true },
        ].map((t,i,arr) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 0', borderBottom: i === arr.length-1 ? 'none' : `1px solid ${s2.line}`,
          }}>
            <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 500, letterSpacing:'0.18em', color: t.on ? s2.text : s2.textDim }}>{t.l}</div>
            <div style={{
              width: 34, height: 18, background: t.on ? s2.accent : s2.surface2,
              border:`1px solid ${t.on ? s2.accent : s2.lineStrong}`,
              position:'relative',
            }}>
              <div style={{
                position:'absolute', top: 1, left: t.on ? 17 : 1, bottom: 1, width: 14,
                background: t.on ? '#0C0907' : s2.textDim, transition:'left 180ms',
              }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Meal count slider */}
      <div style={{ padding:'22px 20px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <s2HairLabel>MEALS PER DAY</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, color: s2.accent, letterSpacing:'-0.02em' }}>4</div>
        </div>
        <div style={{ marginTop: 12, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 6 }}>
          {[3,4,5,6].map(n => (
            <button key={n} style={{
              background: n === 4 ? s2.accentFill : 'transparent',
              border:`1px solid ${n === 4 ? s2.accent : s2.lineStrong}`,
              color: n === 4 ? s2.accent : s2.text,
              padding:'14px', fontFamily: s2.sans, fontSize: 18, fontWeight: 500, cursor:'pointer',
            }}>{n}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'26px 20px 0' }}>
        <s2Btn full primary onClick={() => onNav && onNav('regenConfirm')}>APPLY & REGENERATE</s2Btn>
      </div>
      <div style={{ height: 24 }}/>
    </S2Scaffold>
  );
};

// ─── Meal prep guide ──────────────────────────────────────────
window.S2MealPrep = function MealPrep({ onNav }) {
  const s2 = window.s2;
  const steps = [
    { t:'Shop Saturday evening', d:'Fresh produce is cheapest and most stocked after 7pm in most supermarkets.', m:30 },
    { t:'Batch 3 proteins on Sunday', d:'Grill chicken, boil eggs, portion paneer. Refrigerate in 3-day labeled containers.', m:40 },
    { t:'Chop veg in one session', d:'Onion, tomato, cucumber, spinach — airtight jars keep 4 days crisp.', m:15 },
    { t:'Pre-portion rice + dal', d:'Cook 2 cups dry. Freeze in single-serve bags. Microwave from frozen in 3 min.', m:25 },
    { t:'Label with dates + macros', d:'Masking tape + sharpie. Each container gets meal name and macro count.', m:10 },
  ];
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('tips')} kicker="PROTOCOL · SUNDAY" title="Meal prep"/>

      <div style={{ padding:'22px 20px 0', textAlign:'center' }}>
        <s2HairLabel>TOTAL TIME</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 72, fontWeight: 300, letterSpacing:'-0.04em', color: s2.accent, lineHeight: 1, marginTop: 8 }}>
          120<span style={{ fontSize: 16, color: s2.textDim, marginLeft: 6 }}>min</span>
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 6, letterSpacing:'0.15em' }}>
          SAVES 5 HOURS · MON–FRI
        </div>
      </div>

      <div style={{ padding:'28px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 12 }}>STEPS</s2HairLabel>
        {steps.map((s,i) => (
          <div key={i} style={{ display:'flex', gap: 14, padding:'16px 0', borderBottom: i === steps.length-1 ? 'none' : `1px solid ${s2.line}` }}>
            <div style={{ fontFamily: s2.sans, fontSize: 32, fontWeight: 200, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1, width: 44 }}>
              {String(i+1).padStart(2,'0')}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500 }}>{s.t}</div>
                <s2HairLabel color={s2.textDim}>{s.m} MIN</s2HairLabel>
              </div>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 6, lineHeight: 1.55 }}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </S2Scaffold>
  );
};

// ─── Regen confirm ────────────────────────────────────────────
window.S2RegenConfirm = function RegenConfirm({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <S2TopBar onBack={() => onNav && onNav('profile')} kicker="DESTRUCTIVE" title="Regenerate plan"/>

      <div style={{ padding:'42px 28px 0', textAlign:'center' }}>
        <div style={{
          width: 72, height: 72, border:`1px solid ${s2.warn}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto', color: s2.warn, fontFamily: s2.sans, fontSize: 36, fontWeight: 200,
        }}>!</div>
        <div style={{ fontFamily: s2.sans, fontSize: 28, fontWeight: 400, letterSpacing:'-0.02em', marginTop: 24, lineHeight: 1.2 }}>
          Replace your current plan?
        </div>
        <div style={{ fontFamily: s2.sans, fontSize: 14, color: s2.textDim, marginTop: 12, lineHeight: 1.55 }}>
          Your current 14-day plan has 32 days left. AI will generate a fresh plan using your updated rules and current weight.
        </div>
      </div>

      <div style={{ padding:'28px 20px 0' }}>
        <S2Card padding={14}>
          <s2HairLabel style={{ marginBottom: 4 }}>WHAT CHANGES</s2HairLabel>
          <s2DataRow label="MEALS REPLACED" value="~56" accent={s2.warn}/>
          <s2DataRow label="SHOPPING LIST" value="REBUILT"/>
          <s2DataRow label="PROGRESS LOG" value="KEPT" accent={s2.accent}/>
          <s2DataRow label="STREAK" value="KEPT · 12d" accent={s2.accent} last/>
        </S2Card>
      </div>

      <div style={{ padding:'32px 20px 0', display:'flex', flexDirection:'column', gap: 10 }}>
        <s2Btn full primary onClick={() => onNav && onNav('regenProgress')} style={{ background: s2.warn }}>YES · REGENERATE</s2Btn>
        <s2Btn full onClick={() => onNav && onNav('profile')}>CANCEL</s2Btn>
      </div>
    </S2Scaffold>
  );
};

// ─── Regen progress ───────────────────────────────────────────
window.S2RegenProgress = function RegenProgress({ onNav }) {
  const s2 = window.s2;
  const steps = [
    { l:'READING YOUR RULES', done: true, ms:'0.8s' },
    { l:'ANALYZING PREFERENCES', done: true, ms:'1.2s' },
    { l:'BUILDING 14-DAY PLAN', done: false, active: true, pct: 62 },
    { l:'MATCHING MACROS', done: false },
    { l:'WRITING SHOPPING LIST', done: false },
  ];
  return (
    <S2Scaffold noTabs>
      <div style={{ padding:'60px 28px 0', textAlign:'center' }}>
        <s2HairLabel color={s2.accent}>AI · GENERATING</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 44, fontWeight: 300, letterSpacing:'-0.035em', marginTop: 10, lineHeight: 1.1 }}>
          Building your<br/>new plan.
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 72, fontWeight: 200, color: s2.accent, letterSpacing:'-0.04em', marginTop: 32, lineHeight: 1 }}>
          62<span style={{ fontSize: 18, color: s2.textDim }}>%</span>
        </div>
      </div>

      <div style={{ padding:'40px 20px 0' }}>
        {steps.map((s,i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap: 14,
            padding:'14px 0', borderBottom: i === steps.length-1 ? 'none' : `1px solid ${s2.line}`,
          }}>
            <div style={{
              width: 16, height: 16,
              border:`1px solid ${s.done ? s2.accent : (s.active ? s2.accent : s2.lineStrong)}`,
              background: s.done ? s2.accent : 'transparent',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0,
            }}>
              {s.done && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5 L4 7.5 L8.5 2.5" stroke="#0C0907" strokeWidth="1.8" fill="none" strokeLinecap="square"/></svg>}
              {s.active && <div style={{ width: 6, height: 6, background: s2.accent }}/>}
            </div>
            <div style={{
              flex:1, fontFamily: s2.mono, fontSize: 11, letterSpacing:'0.18em', fontWeight: 500,
              color: s.done ? s2.text : (s.active ? s2.accent : s2.textDimmer),
            }}>{s.l}</div>
            <s2HairLabel color={s.active ? s2.accent : s2.textDim}>{s.ms || (s.active ? `${s.pct}%` : '—')}</s2HairLabel>
          </div>
        ))}
      </div>

      <div style={{ padding:'40px 20px 0', textAlign:'center' }}>
        <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, lineHeight: 1.5, fontStyle:'italic' }}>
          "A new plan is a new contract with yourself."
        </div>
      </div>
    </S2Scaffold>
  );
};
