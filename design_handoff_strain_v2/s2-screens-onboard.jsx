// Auth + Onboarding screens for Strain v2

const { S2Scaffold, S2Card, S2Bar, S2Placeholder, s2HairLabel, s2Pill, s2Btn, s2DataRow } = window;

// ─── Auth · Sign in ───────────────────────────────────────────
window.S2Auth = function Auth({ onNav }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <div style={{ padding:'40px 28px 0' }}>
        {/* Brand mark */}
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, background: s2.accent }}/>
          <div style={{ fontFamily: s2.mono, fontSize: 10, letterSpacing:'0.3em', color: s2.text, fontWeight: 600 }}>AI-DPT</div>
        </div>
      </div>

      <div style={{ padding:'60px 28px 0' }}>
        <s2HairLabel>PERSONAL DIET PROTOCOL</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 48, fontWeight: 300, letterSpacing:'-0.035em', marginTop: 14, lineHeight: 1.02 }}>
          Eat with<br/>intent.
        </div>
        <div style={{ fontFamily: s2.sans, fontSize: 14, color: s2.textDim, marginTop: 18, lineHeight: 1.55, maxWidth: 280 }}>
          A 14-day plan built around your body, your goal, and your pantry. Adjusted daily by AI.
        </div>
      </div>

      <div style={{ padding:'80px 28px 0' }}>
        <s2Btn full primary onClick={() => onNav && onNav('ob1')}>CREATE ACCOUNT</s2Btn>
        <div style={{ height: 10 }}/>
        <s2Btn full onClick={() => onNav && onNav('meals')}>I ALREADY HAVE ONE</s2Btn>
      </div>

      <div style={{ padding:'28px 28px 0', textAlign:'center' }}>
        <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing:'0.15em', lineHeight: 1.8 }}>
          BY CONTINUING YOU ACCEPT THE<br/>TERMS OF USE · PRIVACY POLICY
        </div>
      </div>
    </S2Scaffold>
  );
};

// Shared: onboarding step chrome
function OBChrome({ step, total, children, onBack, onNext, nextLabel = 'CONTINUE →' }) {
  const s2 = window.s2;
  return (
    <S2Scaffold noTabs>
      <div style={{ padding:'6px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack} style={{
          background:'transparent', border:`1px solid ${s2.lineStrong}`,
          width: 36, height: 36, color: s2.text, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
        </button>
        <s2HairLabel>STEP {String(step).padStart(2,'0')} / {String(total).padStart(2,'0')}</s2HairLabel>
        <div style={{ width: 36 }}/>
      </div>

      {/* Progress bar */}
      <div style={{ padding:'16px 20px 0' }}>
        <div style={{ display:'flex', gap: 4 }}>
          {Array.from({length: total}, (_,i) => (
            <div key={i} style={{ flex: 1, height: 2, background: i < step ? s2.accent : s2.line }}/>
          ))}
        </div>
      </div>

      {children}

      <div style={{ padding:'28px 20px 24px' }}>
        <s2Btn full primary onClick={onNext}>{nextLabel}</s2Btn>
      </div>
    </S2Scaffold>
  );
}
window.S2OBChrome = OBChrome;

// ─── OB 1 · Welcome + basics ──────────────────────────────────
window.S2OB1 = function OB1({ onNav }) {
  const s2 = window.s2;
  return (
    <OBChrome step={1} total={5} onBack={() => onNav && onNav('auth')} onNext={() => onNav && onNav('ob2')}>
      <div style={{ padding:'30px 20px 0' }}>
        <s2HairLabel>WELCOME</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing:'-0.03em', marginTop: 10, lineHeight: 1.1 }}>
          What should<br/>we call you?
        </div>
      </div>

      <div style={{ padding:'36px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 8 }}>NAME</s2HairLabel>
        <div style={{
          borderBottom:`1px solid ${s2.accent}`, padding:'8px 0',
          fontFamily: s2.sans, fontSize: 28, fontWeight: 300, color: s2.text, letterSpacing:'-0.02em',
        }}>
          Harshit<span style={{ display:'inline-block', width: 2, height: 24, background: s2.accent, marginLeft: 3, verticalAlign:'middle' }}/>
        </div>
      </div>

      <div style={{ padding:'30px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>SEX (FOR ENERGY CALCULATIONS)</s2HairLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
          {[
            { l:'MALE',   on: true },
            { l:'FEMALE', on: false },
          ].map((o,i) => (
            <button key={i} style={{
              background: o.on ? s2.accentFill : 'transparent',
              border:`1px solid ${o.on ? s2.accent : s2.lineStrong}`,
              color: o.on ? s2.accent : s2.text,
              padding:'18px', fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing:'0.2em', cursor:'pointer',
            }}>{o.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'28px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>AGE</s2HairLabel>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily: s2.sans, fontSize: 72, fontWeight: 200, color: s2.accent, letterSpacing:'-0.04em', lineHeight: 1 }}>28</div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, letterSpacing:'0.15em', marginTop: 4 }}>YEARS</div>
        </div>
      </div>
    </OBChrome>
  );
};

// ─── OB 2 · Body ──────────────────────────────────────────────
window.S2OB2 = function OB2({ onNav }) {
  const s2 = window.s2;
  return (
    <OBChrome step={2} total={5} onBack={() => onNav && onNav('ob1')} onNext={() => onNav && onNav('ob3')}>
      <div style={{ padding:'30px 20px 0' }}>
        <s2HairLabel>STATS</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing:'-0.03em', marginTop: 10, lineHeight: 1.1 }}>
          Your body<br/>today.
        </div>
      </div>

      <div style={{ padding:'42px 20px 0', display:'flex', gap: 14 }}>
        <div style={{ flex:1, border:`1px solid ${s2.line}`, padding: 16 }}>
          <s2HairLabel>HEIGHT</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 46, fontWeight: 200, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1, marginTop: 10 }}>176</div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 4, letterSpacing:'0.15em' }}>CM</div>
        </div>
        <div style={{ flex:1, border:`1px solid ${s2.line}`, padding: 16 }}>
          <s2HairLabel>WEIGHT</s2HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 46, fontWeight: 200, color: s2.accent, letterSpacing:'-0.03em', lineHeight: 1, marginTop: 10 }}>72.2</div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 4, letterSpacing:'0.15em' }}>KG</div>
        </div>
      </div>

      <div style={{ padding:'28px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>ACTIVITY LEVEL</s2HairLabel>
        {[
          { l:'SEDENTARY', d:'Desk job, little exercise' },
          { l:'LIGHT', d:'Light exercise 1–3d / week' },
          { l:'MODERATE', d:'Exercise 3–5d / week', on: true },
          { l:'ACTIVE', d:'Hard exercise 6–7d / week' },
          { l:'ATHLETE', d:'2x daily, physical job' },
        ].map((o,i,arr) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 0', borderBottom: i === arr.length-1 ? 'none' : `1px solid ${s2.line}`,
            cursor:'pointer',
          }}>
            <div>
              <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing:'0.18em', color: o.on ? s2.accent : s2.text }}>{o.l}</div>
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 4 }}>{o.d}</div>
            </div>
            <div style={{
              width: 18, height: 18, borderRadius:'50%',
              border:`1px solid ${o.on ? s2.accent : s2.lineStrong}`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {o.on && <div style={{ width: 8, height: 8, background: s2.accent, borderRadius:'50%' }}/>}
            </div>
          </div>
        ))}
      </div>
    </OBChrome>
  );
};

// ─── OB 3 · Goal ──────────────────────────────────────────────
window.S2OB3 = function OB3({ onNav }) {
  const s2 = window.s2;
  return (
    <OBChrome step={3} total={5} onBack={() => onNav && onNav('ob2')} onNext={() => onNav && onNav('ob4')}>
      <div style={{ padding:'30px 20px 0' }}>
        <s2HairLabel>GOAL</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing:'-0.03em', marginTop: 10, lineHeight: 1.1 }}>
          What are you<br/>building toward?
        </div>
      </div>

      <div style={{ padding:'30px 20px 0' }}>
        {[
          { l:'LOSE FAT', d:'Calorie deficit with protein priority', on: true },
          { l:'MAINTAIN', d:'Stay at current weight, recomp' },
          { l:'GAIN MUSCLE', d:'Small surplus, high protein' },
          { l:'ATHLETIC PERF', d:'Energy dense, timed carbs' },
        ].map((o,i,arr) => (
          <div key={i} style={{
            padding:'18px', marginBottom: 10,
            border:`1px solid ${o.on ? s2.accent : s2.line}`,
            background: o.on ? s2.accentFill : 'transparent',
            cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div>
              <div style={{ fontFamily: s2.sans, fontSize: 18, fontWeight: 500, color: o.on ? s2.accent : s2.text, letterSpacing:'-0.01em' }}>{o.l}</div>
              <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 4 }}>{o.d}</div>
            </div>
            {o.on && <div style={{ color: s2.accent, fontFamily: s2.mono, fontSize: 18 }}>✓</div>}
          </div>
        ))}
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>TARGET WEIGHT</s2HairLabel>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily: s2.sans, fontSize: 60, fontWeight: 200, color: s2.accent, letterSpacing:'-0.04em', lineHeight: 1 }}>68.0</div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDim, marginTop: 4, letterSpacing:'0.15em' }}>KG · −4.2 FROM TODAY</div>
        </div>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>INTENSITY</s2HairLabel>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 6 }}>
          {[
            { l:'GENTLE', s:'0.25kg/w' },
            { l:'STEADY', s:'0.5kg/w' },
            { l:'AGGRESSIVE', s:'0.75kg/w', on: true },
          ].map((x,i) => (
            <button key={i} style={{
              background: x.on ? s2.accentFill : 'transparent',
              border:`1px solid ${x.on ? s2.accent : s2.lineStrong}`,
              color: x.on ? s2.accent : s2.text,
              padding:'12px 6px', cursor:'pointer',
            }}>
              <div style={{ fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.15em' }}>{x.l}</div>
              <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, marginTop: 4 }}>{x.s}</div>
            </button>
          ))}
        </div>
      </div>
    </OBChrome>
  );
};

// ─── OB 4 · Diet ──────────────────────────────────────────────
window.S2OB4 = function OB4({ onNav }) {
  const s2 = window.s2;
  return (
    <OBChrome step={4} total={5} onBack={() => onNav && onNav('ob3')} onNext={() => onNav && onNav('ob5')} nextLabel="BUILD MY PLAN →">
      <div style={{ padding:'30px 20px 0' }}>
        <s2HairLabel>DIET</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing:'-0.03em', marginTop: 10, lineHeight: 1.1 }}>
          How do<br/>you eat?
        </div>
      </div>

      <div style={{ padding:'30px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>STYLE</s2HairLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6 }}>
          {[
            { l:'NON-VEG', on: true },
            { l:'VEGETARIAN' },
            { l:'EGGETARIAN' },
            { l:'VEGAN' },
          ].map((x,i) => (
            <button key={i} style={{
              background: x.on ? s2.accentFill : 'transparent',
              border:`1px solid ${x.on ? s2.accent : s2.lineStrong}`,
              color: x.on ? s2.accent : s2.text,
              padding:'14px 8px', fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing:'0.15em', cursor:'pointer',
            }}>{x.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>CUISINES (PICK 2+)</s2HairLabel>
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
          {[
            { l:'INDIAN', on: true },
            { l:'MEDITERRANEAN', on: true },
            { l:'CHINESE' },
            { l:'ITALIAN' },
            { l:'CONTINENTAL' },
            { l:'JAPANESE' },
            { l:'MEXICAN' },
            { l:'THAI' },
          ].map((c,i) => (
            <button key={i} style={{
              background: c.on ? s2.accent : 'transparent',
              border:`1px solid ${c.on ? s2.accent : s2.lineStrong}`,
              color: c.on ? '#0C0907' : s2.text,
              padding:'8px 12px', fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.15em', cursor:'pointer',
            }}>{c.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>EXCLUDE</s2HairLabel>
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
          {['DAIRY','GLUTEN','NUTS','SHELLFISH','PORK','BEEF'].map((x,i) => (
            <button key={i} style={{
              background:'transparent', border:`1px solid ${s2.line}`,
              color: s2.textDim,
              padding:'8px 12px', fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing:'0.15em', cursor:'pointer',
            }}>{x}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'22px 20px 0' }}>
        <s2HairLabel style={{ marginBottom: 10 }}>PLAN LENGTH</s2HairLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
          {[
            { d:7,  label:'7-DAY' },
            { d:14, label:'14-DAY', rec: true },
          ].map(o => (
            <div key={o.d} style={{
              position:'relative',
              border:`1px solid ${o.rec ? s2.accent : s2.lineStrong}`,
              background: o.rec ? s2.accentFill : 'transparent',
              padding: '14px', cursor:'pointer',
            }}>
              {o.rec && <div style={{ position:'absolute', top:-8, right: 8, fontFamily: s2.mono, fontSize: 8, background: s2.accent, color:'#0C0907', padding:'2px 6px', letterSpacing:'0.15em', fontWeight: 700 }}>REC</div>}
              <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500, color: o.rec ? s2.accent : s2.text }}>{o.label}</div>
            </div>
          ))}
        </div>
      </div>
    </OBChrome>
  );
};

// ─── OB 5 · Generating ────────────────────────────────────────
window.S2OB5 = function OB5({ onNav }) {
  const s2 = window.s2;
  const steps = [
    { l:'READING YOUR BODY', done: true },
    { l:'SETTING MACRO TARGETS', done: true },
    { l:'BUILDING 14-DAY MENU', active: true, pct: 78 },
    { l:'BALANCING NUTRIENTS', done: false },
    { l:'WRITING SHOPPING LIST', done: false },
  ];
  return (
    <S2Scaffold noTabs>
      <div style={{ padding:'80px 28px 0', textAlign:'center' }}>
        <s2HairLabel color={s2.accent}>AI · BUILDING YOUR PROTOCOL</s2HairLabel>
        <div style={{ fontFamily: s2.sans, fontSize: 44, fontWeight: 300, letterSpacing:'-0.035em', marginTop: 18, lineHeight: 1.1 }}>
          Welcome,<br/>Harshit.
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 72, fontWeight: 200, color: s2.accent, letterSpacing:'-0.04em', marginTop: 40, lineHeight: 1 }}>
          78<span style={{ fontSize: 18, color: s2.textDim }}>%</span>
        </div>
      </div>

      <div style={{ padding:'48px 20px 0' }}>
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
            {s.active && <s2HairLabel color={s2.accent}>{s.pct}%</s2HairLabel>}
          </div>
        ))}
      </div>

      <div style={{ padding:'48px 20px 0' }}>
        <s2Btn full primary onClick={() => onNav && onNav('meals')}>ENTER APP →</s2Btn>
      </div>
    </S2Scaffold>
  );
};
