// v3 Light — light replacements for the five full-dark screens.
// Loaded after the base screens; overrides V3Auth, V3OB5, V3Water, V3ReplaceAI, V3RegenProgress.
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3Ring, V3IconBtn, V3Row } = window;

// shared: progress checklist on light
function V3Steps({ lines }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background: l.now ? v3.limeSoft : v3.card, borderRadius:16, padding:'12px 14px' }}>
          <div style={{
            width:22, height:22, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center',
            background: l.done ? v3.lime : 'transparent',
            border: l.done ? 'none' : `1.5px solid ${l.now ? v3.limeDeep : v3.lineStrong}`,
            color:v3.ink, fontSize:11, fontWeight:800,
          }}>{l.done ? '✓' : ''}</div>
          <span style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color: l.done ? v3.dim : l.now ? v3.text : v3.dimmer }}>{l.t}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sign in ──────────────────────────────────────────────────
window.V3Auth = function V3Auth({ onNav }) {
  return (
    <V3Scaffold nav={false} bg={v3.paper}>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:800 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:18, fontWeight:700, letterSpacing:'-0.03em', color:v3.text }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:9, fontWeight:800, color:'#5F8C12' }}>AI</span>
        </div>

        <div style={{ marginTop:64 }}>
          <V3Chip bg={v3.card} size={11}>Plan · Cook · Shop · Track</V3Chip>
          <V3H size={52} style={{ marginTop:20 }}>
            The meal plan<br/>you’ll <span style={{ color:'#5F8C12' }}>actually</span><br/>eat.
          </V3H>
          <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dim, marginTop:18, lineHeight:1.65, maxWidth:300 }}>
            Macro-accurate plans built on real home-cooked food — with recipes, a shopping list and tracking in one place.
          </div>
        </div>

        <div style={{ marginTop:36, display:'flex', gap:10 }}>
          {[{ v:'±3%', l:'Macro accuracy', bg:v3.lime }, { v:'5', l:'Languages', bg:v3.mint }, { v:'4', l:'Meals a day', bg:v3.peach }].map((s, i) => (
            <V3Card key={i} bg={s.bg} r={22} pad={14} style={{ flex:1 }}>
              <div style={{ fontFamily:v3.disp, fontSize:22, fontWeight:700, letterSpacing:'-0.04em' }}>{s.v}</div>
              <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:600, color:v3.panelDim, marginTop:5 }}>{s.l}</div>
            </V3Card>
          ))}
        </div>

        <div style={{ marginTop:'auto', paddingTop:44, paddingBottom:28, display:'flex', flexDirection:'column', gap:10 }}>
          <V3Btn kind="dark" full onClick={() => onNav && onNav('ob1')}>Continue with Google</V3Btn>
          <V3Btn kind="light" full onClick={() => onNav && onNav('ob1')}>Continue as guest</V3Btn>
          <div style={{ textAlign:'center', fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.dimmer, marginTop:6 }}>
            By continuing you accept our terms and privacy policy.
          </div>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Onboarding · generating ──────────────────────────────────
window.V3OB5 = function V3OB5({ onNav }) {
  const lines = [
    { t:'Reading your profile', done:true }, { t:'Setting calorie and macro targets', done:true },
    { t:'Balancing the week for variety', done:true }, { t:'Correcting portions against the database', now:true },
    { t:'Writing recipes and the shopping list' },
  ];
  return (
    <V3Scaffold nav={false} bg={v3.paper}>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:800 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color:v3.text }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, color:'#5F8C12' }}>AI</span>
        </div>

        <V3Card bg={v3.lime} r={32} pad={24} style={{ marginTop:44, display:'grid', placeItems:'center' }}>
          <V3Ring pct={0.68} size={186} thick={16} color={v3.ink} track="rgba(15,20,15,0.16)" dashRemainder>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:44, fontWeight:700, letterSpacing:'-0.05em', lineHeight:1 }}>68<span style={{ fontSize:20 }}>%</span></div>
              <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.panelDim, marginTop:6 }}>Building plan</div>
            </div>
          </V3Ring>
        </V3Card>

        <div style={{ marginTop:30 }}>
          <V3H size={34}>Cooking up<br/>your 14 days</V3H>
        </div>

        <div style={{ marginTop:22 }}><V3Steps lines={lines}/></div>

        <div style={{ marginTop:'auto', paddingTop:30, paddingBottom:28 }}>
          <V3Btn kind="dark" full onClick={() => onNav && onNav('meals')}>See my plan</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Water ────────────────────────────────────────────────────
window.V3Water = function V3Water({ onNav }) {
  const [filled, setFilled] = React.useState(6);
  const week = [2.1,2.6,1.8,2.8,2.2,2.7,1.8];
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.paper}>
      <V3TopBar onBack={() => onNav && onNav('meals')} kick="Hydration · today" title="Water"
        right={<V3Chip bg={v3.card} size={11}>Goal 3.0 L</V3Chip>}/>

      <div style={{ padding:'20px 22px 0' }}>
        <V3Card bg={v3.sky} r={32} pad={20}>
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            <V3Ring pct={filled/10} size={144} thick={14} color={v3.ink} track="rgba(15,20,15,0.14)" dashRemainder>
              <div>
                <div style={{ fontFamily:v3.disp, fontSize:34, fontWeight:700, letterSpacing:'-0.045em', lineHeight:1 }}>{(filled*0.3).toFixed(1)}</div>
                <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.panelDim, marginTop:4 }}>of 3.0 L</div>
              </div>
            </V3Ring>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:30, fontWeight:700, letterSpacing:'-0.04em' }}>{filled*10}%</div>
              <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.panelDim, marginTop:5 }}>{filled} of 10 glasses</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:'rgba(15,20,15,0.45)', marginTop:10, lineHeight:1.5 }}>
                {filled >= 10 ? 'Goal hit for today.' : `${10 - filled} glasses left to hit your goal.`}
              </div>
            </div>
          </div>
        </V3Card>
      </div>

      {/* glasses */}
      <div style={{ padding:'16px 22px 0', display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {Array.from({ length:10 }).map((_, i) => {
          const on = i < filled;
          return (
            <div key={i} onClick={() => setFilled(filled === i + 1 ? i : i + 1)} style={{
              aspectRatio:'2/3', borderRadius:'10px 10px 16px 16px', cursor:'pointer',
              background: on ? v3.water : v3.card, border: on ? 'none' : `1.5px solid ${v3.line}`,
              display:'grid', placeItems:'center', position:'relative', overflow:'hidden', transition:'background 200ms ease-out',
            }}>
              {on && <div style={{ position:'absolute', left:0, right:0, top:'26%', height:1, background:'rgba(255,255,255,0.55)' }}/>}
              <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, color: on ? v3.ink : v3.dimmer, zIndex:1 }}>{i+1}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding:'18px 22px 0', display:'flex', gap:8 }}>
        {[{ l:'+1 glass', v:1 }, { l:'+ Bottle', v:2 }, { l:'+ 1 litre', v:3 }].map((b, i) => (
          <V3Btn key={i} small kind="light" full onClick={() => setFilled(f => Math.min(10, f + b.v))}>{b.l}</V3Btn>
        ))}
      </div>

      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={18}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <V3Kick>Last 7 days</V3Kick>
            <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:'#1F7FB8' }}>Avg 2.3 L</span>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:96, marginTop:16 }}>
            {week.map((v, i) => {
              const today = i === 6;
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
                  <div style={{ width:'100%', height:`${(v/3)*100}%`, borderRadius:10, background: today ? v3.water : 'rgba(99,184,232,0.30)' }}/>
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

// ── Swap · AI thinking ───────────────────────────────────────
window.V3ReplaceAI = function V3ReplaceAI({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.paper}>
      <V3TopBar onBack={() => onNav && onNav('replaceSheet')} kick="AI meal swap" title="Finding a better fit"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg={v3.lime} r={32} pad={24} style={{ display:'grid', placeItems:'center' }}>
          <V3Ring pct={0.42} size={164} thick={15} color={v3.ink} track="rgba(15,20,15,0.16)" dashRemainder>
            <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, color:v3.panelDim, lineHeight:1.5 }}>Scanning<br/>1,240 meals</div>
          </V3Ring>
        </V3Card>
      </div>
      <div style={{ padding:'20px 22px 0' }}>
        <V3Steps lines={[
          { t:'Matching your macro gap', done:true }, { t:'Filtering your diet rules', done:true },
          { t:'Checking ingredients you have', now:true }, { t:'Ranking by taste history' },
        ]}/>
      </div>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Btn kind="dark" full onClick={() => onNav && onNav('replaceResult')}>See the suggestion</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Regenerate · progress ────────────────────────────────────
window.V3RegenProgress = function V3RegenProgress({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.paper}>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:790 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color:v3.text }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, color:'#5F8C12' }}>AI</span>
        </div>

        <V3Card bg={v3.lime} r={32} pad={24} style={{ marginTop:40, display:'grid', placeItems:'center' }}>
          <V3Ring pct={0.34} size={182} thick={16} color={v3.ink} track="rgba(15,20,15,0.16)" dashRemainder>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:42, fontWeight:700, letterSpacing:'-0.05em', lineHeight:1 }}>34<span style={{ fontSize:19 }}>%</span></div>
              <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.panelDim, marginTop:6 }}>Day 5 of 14</div>
            </div>
          </V3Ring>
        </V3Card>

        <div style={{ marginTop:28 }}>
          <V3H size={32}>Rebuilding<br/>your week</V3H>
          <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, marginTop:12, lineHeight:1.6 }}>
            Keep the app open. This takes about 20 seconds.
          </div>
        </div>

        <div style={{ marginTop:22 }}>
          <V3Steps lines={[
            { t:'Day 1–4 · written', done:true }, { t:'Day 5 · balancing macros', now:true },
            { t:'Day 6–14 · queued' }, { t:'Shopping list · pending' },
          ]}/>
        </div>

        <div style={{ marginTop:'auto', paddingTop:30, paddingBottom:28, display:'flex', flexDirection:'column', gap:10 }}>
          <V3Btn kind="dark" full onClick={() => onNav && onNav('meals')}>Open the new plan</V3Btn>
          <V3Btn kind="ghost" full small onClick={() => onNav && onNav('profile')}>Cancel</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};
