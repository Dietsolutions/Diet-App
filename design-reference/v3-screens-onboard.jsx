// v3 — Auth + onboarding
const { V3Scaffold, V3ObHead, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3CtaBar, V3Bar, V3Ring, V3IconBtn, V3Food } = window;

window.V3Auth = function V3Auth({ onNav }) {
  return (
    <V3Scaffold nav={false} bg={v3.ink} dark>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:800 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:18, fontWeight:700, letterSpacing:'-0.03em', color:v3.onDark }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:9, fontWeight:800, color:v3.lime }}>AI</span>
        </div>

        <div style={{ marginTop:70 }}>
          <V3Chip bg="rgba(246,247,243,0.10)" color={v3.onDark} size={11}>Plan · Cook · Shop · Track</V3Chip>
          <V3H size={52} color={v3.onDark} style={{ marginTop:20 }}>
            The meal plan<br/>you’ll <span style={{ color:v3.lime }}>actually</span><br/>eat.
          </V3H>
          <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.onDarkDim, marginTop:18, lineHeight:1.65, maxWidth:300 }}>
            Macro-accurate plans built on real home-cooked food — with recipes, a shopping list and tracking in one place.
          </div>
        </div>

        <div style={{ marginTop:40, display:'flex', gap:10 }}>
          {[{ v:'±3%', l:'Macro accuracy' }, { v:'5', l:'Languages' }, { v:'4', l:'Meals a day' }].map((s, i) => (
            <div key={i} style={{ flex:1, borderRadius:20, background:'rgba(246,247,243,0.06)', padding:'14px 12px' }}>
              <div style={{ fontFamily:v3.disp, fontSize:22, fontWeight:700, letterSpacing:'-0.04em', color:v3.lime }}>{s.v}</div>
              <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:600, color:v3.onDarkDim, marginTop:5 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:'auto', paddingTop:44, paddingBottom:28, display:'flex', flexDirection:'column', gap:10 }}>
          <V3Btn full onClick={() => onNav && onNav('ob1')}>Continue with Google</V3Btn>
          <V3Btn kind="onDark" full onClick={() => onNav && onNav('ob1')}>Continue as guest</V3Btn>
          <div style={{ textAlign:'center', fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.onDarkDimmer, marginTop:6 }}>
            By continuing you accept our terms and privacy policy.
          </div>
        </div>
      </div>
    </V3Scaffold>
  );
};

// 1 · Welcome
window.V3OB1 = function V3OB1({ onNav }) {
  return (
    <V3Scaffold nav={false}>
      <V3ObHead step={1} onSkip={() => onNav && onNav('meals')}/>
      <div style={{ padding:'34px 22px 0' }}>
        <V3H size={44}>
          Personal meals,<br/>your way,<br/>anytime.
        </V3H>
        <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dim, marginTop:16, lineHeight:1.6, maxWidth:300 }}>
          Tell us about your body and the food you love. We build the plan, the recipes and the shopping list around it.
        </div>
      </div>
      <div style={{ position:'relative', margin:'26px 14px 0' }}>
        <div style={{ borderRadius:30, overflow:'hidden', height:300, background:v3.mint }}>
          <image-slot id="v3-ob-hero" placeholder="Drop a fresh-produce photo" style={{ width:'100%', height:'100%' }}></image-slot>
        </div>
        <V3Chip bg={v3.card} size={11} style={{ position:'absolute', top:20, left:18, boxShadow:'0 8px 20px rgba(15,20,15,0.12)' }}>150 kcal</V3Chip>
        <V3Chip bg={v3.card} size={11} style={{ position:'absolute', top:56, right:18, boxShadow:'0 8px 20px rgba(15,20,15,0.12)' }}>340 kcal</V3Chip>
      </div>
      <div style={{ padding:'20px 22px 0' }}>
        <V3CtaBar label="Get started" onClick={() => onNav && onNav('ob2')}/>
      </div>
    </V3Scaffold>
  );
};

// 2 · Body stats
window.V3OB2 = function V3OB2({ onNav }) {
  const [v, setV] = React.useState({ age:29, weight:72, height:176, sex:'Male' });
  const Stepper = ({ label, val, unit, k, step = 1 }) => (
    <V3Card r={24} pad={16}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <V3Kick>{label}</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:30, fontWeight:700, letterSpacing:'-0.04em', marginTop:7 }}>
            {val}<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginLeft:4 }}>{unit}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <V3IconBtn bg={v3.paper} size={38} onClick={() => setV(s => ({ ...s, [k]: s[k] - step }))}>−</V3IconBtn>
          <V3IconBtn bg={v3.lime} size={38} onClick={() => setV(s => ({ ...s, [k]: s[k] + step }))}>+</V3IconBtn>
        </div>
      </div>
    </V3Card>
  );
  return (
    <V3Scaffold nav={false}>
      <V3ObHead step={2} onSkip={() => onNav && onNav('meals')}/>
      <div style={{ padding:'30px 22px 0' }}>
        <V3H size={40}>Tell us about<br/>your body</V3H>
        <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, marginTop:12, lineHeight:1.6 }}>
          This sets your calorie and macro targets. You can change it any time.
        </div>
      </div>
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <Stepper label="Age" val={v.age} unit="years" k="age"/>
        <Stepper label="Weight" val={v.weight} unit="kg" k="weight"/>
        <Stepper label="Height" val={v.height} unit="cm" k="height"/>
        <V3Card r={24} pad={16}>
          <V3Kick style={{ marginBottom:12 }}>Sex</V3Kick>
          <div style={{ display:'flex', gap:8 }}>
            {['Male','Female','Other'].map(s => (
              <button key={s} onClick={() => setV(x => ({ ...x, sex:s }))} style={{
                flex:1, border:'none', borderRadius:999, padding:'12px 0', cursor:'pointer',
                background: v.sex === s ? v3.ink : v3.paper, color: v.sex === s ? v3.onDark : v3.dim,
                fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
              }}>{s}</button>
            ))}
          </div>
        </V3Card>
        <V3Card bg={v3.limeSoft} r={24} pad={16}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <V3Kick color="rgba(15,20,15,0.5)">Estimated maintenance</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:26, fontWeight:700, letterSpacing:'-0.04em', marginTop:6 }}>2,180 <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600 }}>kcal/day</span></div>
            </div>
            <V3Chip bg={v3.card} size={10.5}>BMI 23.2</V3Chip>
          </div>
        </V3Card>
      </div>
      <div style={{ padding:'20px 22px 0' }}><V3CtaBar label="Continue" onClick={() => onNav && onNav('ob3')}/></div>
    </V3Scaffold>
  );
};

// 3 · Goal
window.V3OB3 = function V3OB3({ onNav }) {
  const [sel, setSel] = React.useState('loss');
  const goals = [
    { id:'loss', t:'Lose fat', s:'0.5 kg a week · aggressive but sustainable', bg:v3.lime, kcal:'1,320 kcal' },
    { id:'maintain', t:'Maintain', s:'Hold your current weight, eat better', bg:v3.mint, kcal:'2,180 kcal' },
    { id:'gain', t:'Build muscle', s:'Lean surplus with high protein', bg:v3.peach, kcal:'2,520 kcal' },
  ];
  return (
    <V3Scaffold nav={false}>
      <V3ObHead step={3} onSkip={() => onNav && onNav('meals')}/>
      <div style={{ padding:'30px 22px 0' }}>
        <V3H size={40}>What are we<br/>solving for?</V3H>
      </div>
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>
        {goals.map(g => {
          const on = sel === g.id;
          return (
            <V3Card key={g.id} r={26} pad={18} bg={on ? g.bg : v3.card} onClick={() => setSel(g.id)} border={on ? 'transparent' : v3.line}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div>
                  <V3H size={22}>{g.t}</V3H>
                  <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:500, color: on ? 'rgba(15,20,15,0.62)' : v3.dim, marginTop:6, lineHeight:1.5 }}>{g.s}</div>
                </div>
                <div style={{ width:26, height:26, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center', background: on ? v3.ink : 'transparent', border: on ? 'none' : `1.5px solid ${v3.lineStrong}`, color:v3.lime, fontSize:13, fontWeight:800 }}>{on ? '✓' : ''}</div>
              </div>
              {on && <V3Chip bg="rgba(15,20,15,0.10)" size={10.5} style={{ marginTop:14 }}>Daily target {g.kcal}</V3Chip>}
            </V3Card>
          );
        })}
        <V3Card bg={v3.cream} r={24} pad={16}>
          <V3Kick color={v3.panelDim}>Pace</V3Kick>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            {['Gentle','Steady','Aggressive'].map((p, i) => (
              <V3Chip key={i} bg={i === 2 ? v3.ink : v3.card} color={i === 2 ? v3.lime : v3.dim} size={12} pad="10px 14px" style={{ flex:1, justifyContent:'center' }}>{p}</V3Chip>
            ))}
          </div>
        </V3Card>
      </div>
      <div style={{ padding:'20px 22px 0' }}><V3CtaBar label="Continue" onClick={() => onNav && onNav('ob4')}/></div>
    </V3Scaffold>
  );
};

// 4 · Diet & preferences
window.V3OB4 = function V3OB4({ onNav }) {
  const [diet, setDiet] = React.useState(['Non-veg','Eggs']);
  const [avoid, setAvoid] = React.useState(['Brinjal']);
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const Group = ({ label, options, list, set, tint }) => (
    <V3Card r={26} pad={18}>
      <V3Kick style={{ marginBottom:14 }}>{label}</V3Kick>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {options.map(o => {
          const on = list.includes(o);
          return (
            <button key={o} onClick={() => toggle(list, set, o)} style={{
              border:'none', cursor:'pointer', borderRadius:999, padding:'11px 15px',
              background: on ? tint : v3.paper, color:v3.text,
              fontFamily:v3.sans, fontSize:12.5, fontWeight:700, transition:'background 200ms ease-out',
            }}>{on ? '✓ ' : ''}{o}</button>
          );
        })}
      </div>
    </V3Card>
  );
  return (
    <V3Scaffold nav={false}>
      <V3ObHead step={4} onSkip={() => onNav && onNav('meals')}/>
      <div style={{ padding:'30px 22px 0' }}>
        <V3H size={40}>How do you<br/>eat?</V3H>
      </div>
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <Group label="Diet" options={['Veg','Non-veg','Eggs','Jain','Vegan','Gluten-free']} list={diet} set={setDiet} tint={v3.lime}/>
        <Group label="Foods to avoid" options={['Brinjal','Mushroom','Peanut','Dairy','Soy','Seafood']} list={avoid} set={setAvoid} tint={v3.peach}/>
        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:12 }}>Recipe language</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['English','हिन्दी','ಕನ್ನಡ','தமிழ்','తెలుగు'].map((l, i) => (
              <V3Chip key={i} bg={i === 0 ? v3.ink : v3.paper} color={i === 0 ? v3.lime : v3.dim} size={12.5} pad="11px 15px">{l}</V3Chip>
            ))}
          </div>
          <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:v3.dim, marginTop:12, lineHeight:1.5 }}>
            Recipes and audio can be shared in this language — handy if someone else cooks for you.
          </div>
        </V3Card>
      </div>
      <div style={{ padding:'20px 22px 0' }}><V3CtaBar label="Build my plan" onClick={() => onNav && onNav('ob5')}/></div>
    </V3Scaffold>
  );
};

// 5 · Generating
window.V3OB5 = function V3OB5({ onNav }) {
  const lines = [
    { t:'Reading your profile', done:true }, { t:'Setting calorie and macro targets', done:true },
    { t:'Balancing the week for variety', done:true }, { t:'Correcting portions against the database', now:true },
    { t:'Writing recipes and the shopping list' },
  ];
  return (
    <V3Scaffold nav={false} bg={v3.ink} dark>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:800 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color:v3.onDark }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, color:v3.lime }}>AI</span>
        </div>

        <div style={{ marginTop:60, display:'grid', placeItems:'center' }}>
          <V3Ring pct={0.68} size={190} thick={16} color={v3.lime} track="rgba(246,247,243,0.10)" dashRemainder>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:44, fontWeight:700, letterSpacing:'-0.05em', color:v3.onDark, lineHeight:1 }}>68<span style={{ fontSize:20 }}>%</span></div>
              <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.onDarkDim, marginTop:6 }}>Building plan</div>
            </div>
          </V3Ring>
        </div>

        <div style={{ marginTop:40 }}>
          <V3H size={34} color={v3.onDark}>Cooking up<br/>your 14 days</V3H>
        </div>

        <div style={{ marginTop:26, display:'flex', flexDirection:'column', gap:9 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background: l.now ? 'rgba(198,242,78,0.10)' : 'transparent', borderRadius:16, padding:'11px 13px' }}>
              <div style={{
                width:22, height:22, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center',
                background: l.done ? v3.lime : l.now ? 'transparent' : 'transparent',
                border: l.done ? 'none' : `1.5px solid ${l.now ? v3.lime : v3.lineDark}`,
                color:v3.ink, fontSize:11, fontWeight:800,
              }}>{l.done ? '✓' : ''}</div>
              <span style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color: l.done ? v3.onDarkDim : l.now ? v3.lime : v3.onDarkDimmer }}>{l.t}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop:'auto', paddingTop:36, paddingBottom:28 }}>
          <V3Btn full onClick={() => onNav && onNav('meals')}>See my plan</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};
