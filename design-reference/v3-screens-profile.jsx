// v3 — Auth, Profile, Monthly macros rebuilt from AuthScreen.tsx, ProfileTab.tsx, MonthlyCalorieChart.tsx
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3IconBtn, V3Row } = window;
// ── Sign in / Sign up (AuthScreen.tsx) ───────────────────────
window.V3Auth = function V3Auth({ onNav }) {
  const [mode, setMode] = React.useState('signup');
  const isSignup = mode === 'signup';
  const Field = ({ label, value, ph, right, error }) => (
    <div>
      <V3Kick style={{ marginBottom:8 }}>{label}</V3Kick>
      <div style={{ position:'relative' }}>
        <div style={{
          background:v3.card, border:`1.5px solid ${error ? v3.warn : v3.line}`, borderRadius:16,
          padding: right ? '14px 44px 14px 16px' : '14px 16px',
          fontFamily:v3.sans, fontSize:15, fontWeight:600, color: value ? v3.text : v3.dimmer,
        }}>{value || ph}</div>
        {right && <div style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)' }}>{right}</div>}
      </div>
      {error && <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.1em', color:v3.warn, marginTop:6 }}>⚠ {error}</div>}
    </div>
  );
  return (
    <V3Scaffold nav={false}>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:820 }}>
        {/* logo block */}
        <div style={{ textAlign:'center', marginTop:34, marginBottom:30 }}>
          <div style={{ width:56, height:56, borderRadius:20, background:v3.lime, display:'grid', placeItems:'center', margin:'0 auto 14px', fontSize:26 }}>🍽️</div>
          <div style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.035em' }}>Plan Your Plate</div>
          <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.18em', color:'#5F8C12', marginTop:4 }}>YOUR NUTRITION COMPANION</div>
          <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, marginTop:9 }}></div>
        </div>

        {/* mode toggle */}
        <div style={{ display:'flex', gap:6, background:'rgba(15,20,15,0.06)', borderRadius:999, padding:5, marginBottom:22 }}>
          {[['login','Login'],['signup','Sign up']].map(([id, l]) => (
            <button key={id} onClick={() => setMode(id)} style={{
              flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'11px 0',
              background: mode === id ? v3.ink : 'transparent', color: mode === id ? v3.lime : v3.dim,
              fontFamily:v3.sans, fontSize:11.5, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
          <Field label={isSignup ? 'Username' : 'Username or email'} value={isSignup ? 'harshit' : ''}
            ph={isSignup ? 'yourname' : 'yourname or you@email.com'}
            right={isSignup ? <span style={{ color:'#5F8C12', fontSize:13, fontWeight:800 }}>✓</span> : undefined}/>
          {isSignup && <Field label="Email" value="" ph="you@email.com"/>}
          <Field label="Password" value="••••••••" ph="••••••••" right={<span style={{ fontSize:14, cursor:'pointer' }}>👁</span>}/>
          {isSignup && (
            <div style={{ marginTop:-8 }}>
              <div style={{ height:3, borderRadius:999, background:v3.track, overflow:'hidden' }}>
                <div style={{ width:'66%', height:'100%', background:v3.butter }}/>
              </div>
              <V3Kick color="#B0871C" style={{ marginTop:5, fontSize:8.5 }}>Good</V3Kick>
            </div>
          )}
          {isSignup && <Field label="Confirm password" value="••••••••" ph="••••••••"
            right={<span style={{ display:'flex', gap:7, alignItems:'center' }}><span style={{ color:'#5F8C12', fontSize:12, fontWeight:800 }}>✓</span><span style={{ fontSize:14 }}>👁</span></span>}/>}

          <V3Btn kind="dark" full style={{ marginTop:3 }} onClick={() => onNav && onNav(isSignup ? 'ob1' : 'meals')}>
            {isSignup ? 'Create account →' : 'Login →'}
          </V3Btn>

          {!isSignup && (
            <div style={{ textAlign:'right' }}>
              <button onClick={() => onNav && onNav('forgotPassword')} style={{
                background:'none', border:'none', cursor:'pointer', padding:0,
                fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, textDecoration:'underline', textUnderlineOffset:3,
              }}>Forgot password?</button>
            </div>
          )}
        </div>

        {/* divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 0' }}>
          <div style={{ flex:1, height:1, background:v3.line }}/><V3Kick>or</V3Kick><div style={{ flex:1, height:1, background:v3.line }}/>
        </div>

        {/* social */}
        <div style={{ display:'flex', gap:10 }}>
          <button style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 0', background:v3.card, border:`1.5px solid ${v3.line}`, borderRadius:999, cursor:'pointer', fontFamily:v3.sans, fontSize:13, fontWeight:700 }}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Google
          </button>
          <button style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 0', background:v3.ink, border:'none', borderRadius:999, cursor:'pointer', fontFamily:v3.sans, fontSize:13, fontWeight:700, color:'#fff' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Apple
          </button>
        </div>

        <div style={{ textAlign:'center', marginTop:24 }}><V3Kick>AI-powered nutrition planning</V3Kick></div>

        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, marginTop:18, paddingBottom:24, fontFamily:v3.sans, fontSize:11, fontWeight:600, flexWrap:'wrap' }}>
          <a href="Privacy Policy.html">Privacy Policy</a>
          <span style={{ color:v3.dimmer }}>|</span>
          <a href="Privacy Policy.html">Terms of Service</a>
          <span style={{ color:v3.dimmer }}>|</span>
          <a href="#" onClick={e => { e.preventDefault(); onNav && onNav('disclaimer'); }}>Medical Disclaimer</a>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Medical disclaimer (linked from Sign in) ──────────────
window.V3Disclaimer = function V3Disclaimer({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('auth')} kick="Legal" title="Medical disclaimer"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={24} pad={20}>
          <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, lineHeight:1.65, color:v3.dim }}>
            This app provides AI-generated meal plans for informational purposes only.
            It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare
            provider before starting any diet or nutrition program.
          </div>
        </V3Card>
        <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:20, fontFamily:v3.sans, fontSize:11, fontWeight:600 }}>
          <a href="Privacy Policy.html">Privacy Policy</a>
          <span style={{ color:v3.dimmer }}>|</span>
          <a href="Privacy Policy.html">Terms of Service</a>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Forgot password modal ────────────────────────────────────
window.V3ForgotPassword = function V3ForgotPassword({ onNav }) {
  const [sent, setSent] = React.useState(false);
  return (
    <V3Scaffold nav={false} bg="rgba(15,20,15,0.62)" dark>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:20 }}>
        <V3Card r={28} pad={24} style={{ width:'100%', maxWidth:340, boxShadow:'0 20px 60px rgba(15,20,15,0.35)' }}>
          {sent ? (<>
            <V3H size={23}>Check your email</V3H>
            <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, lineHeight:1.55, marginTop:12 }}>
              If an account exists for <b style={{ color:v3.text }}>you@example.com</b>, we’ve sent a password-reset link. The link expires in 1 hour.
            </div>
            <V3Btn kind="light" full style={{ marginTop:20 }} onClick={() => onNav && onNav('auth')}>Done</V3Btn>
          </>) : (<>
            <V3H size={23}>Reset password</V3H>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.55, marginTop:9, marginBottom:18 }}>
              Enter the email on your account and we’ll send you a reset link.
            </div>
            <div style={{ background:v3.paper, borderRadius:16, padding:'13px 16px', fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dimmer }}>you@example.com</div>
            <div style={{ display:'flex', gap:9, marginTop:16 }}>
              <V3Btn kind="ghost" small style={{ flex:1 }} onClick={() => onNav && onNav('auth')}>Cancel</V3Btn>
              <V3Btn kind="dark" small style={{ flex:2 }} onClick={() => setSent(true)}>Send reset link</V3Btn>
            </div>
          </>)}
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Profile (ProfileTab.tsx) ─────────────────────────────────
window.V3Profile = function V3Profile({ onNav }) {
  const [unit, setUnit] = React.useState('kg');
  const [duration, setDuration] = React.useState(14);
  const [analytics, setAnalytics] = React.useState(false);
  const w = unit === 'kg' ? 69.8 : 153.9, t = unit === 'kg' ? 68 : 149.9;
  const pts = [72.2,72.0,71.9,71.6,71.4,71.5,71.2,70.8,70.6,70.3,70.1,69.8];
  const lo = 69.5, hi = 72.5;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 300, 70 - ((v - lo) / (hi - lo)) * 58]);
  const path = xy.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
  return (
    <V3Scaffold tab="profile" onNav={onNav}>
      <div style={{ padding:'16px 22px 0' }}>
        <V3Kick>Your body</V3Kick>
        <V3H size={32} style={{ marginTop:6 }}>Profile</V3H>
      </div>

      <div style={{ padding:'18px 22px 0', display:'flex', flexDirection:'column', gap:13 }}>
        {/* user card */}
        <V3Card r={24} pad={16}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:50, height:50, borderRadius:999, background:v3.lime, display:'grid', placeItems:'center', fontFamily:v3.disp, fontSize:19, fontWeight:700, flexShrink:0 }}>HA</div>
            <div>
              <div style={{ fontFamily:v3.sans, fontSize:16, fontWeight:700 }}>Harshit</div>
              <V3Kick style={{ marginTop:4 }}>harshit@email.com</V3Kick>
            </div>
          </div>
        </V3Card>

        {/* body stats + units toggle */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <V3Kick>Body stats</V3Kick>
            <div style={{ display:'flex', gap:5, background:'rgba(15,20,15,0.06)', borderRadius:999, padding:3 }}>
              {['kg','lbs'].map(u => (
                <button key={u} onClick={() => setUnit(u)} style={{
                  border:'none', cursor:'pointer', borderRadius:999, padding:'5px 13px',
                  background: unit === u ? v3.ink : 'transparent', color: unit === u ? v3.lime : v3.dim,
                  fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
                }}>{u}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:9, marginBottom:9 }}>
            {[{ l:'Current', v:w, u:unit }, { l:'Target', v:t, u:unit, a:true }, { l:'BMI', v:22.5, u:'' }].map(s => (
              <V3Card key={s.l} r={20} pad={13} bg={s.a ? v3.lime : v3.card}>
                <V3Kick color={s.a ? v3.panelDim : undefined}>{s.l}</V3Kick>
                <div style={{ fontFamily:v3.disp, fontSize:23, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1, marginTop:7 }}>
                  {s.v}<span style={{ fontSize:11, color: s.a ? v3.panelDim : v3.dimmer }}>{s.u}</span>
                </div>
              </V3Card>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
            {[['Goal','Lose fat'],['Intensity','Aggressive']].map(([l, v]) => (
              <V3Card key={l} r={18} pad={13}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <V3Kick>{l}</V3Kick>
                  <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700 }}>{v}</span>
                </div>
              </V3Card>
            ))}
          </div>
        </div>

        {/* goal projection */}
        <V3Card bg={v3.limeSoft} r={24} pad={17}>
          <V3Kick color={v3.panelDim}>Goal projection</V3Kick>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginTop:9 }}>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:29, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1 }}>3 Jun 2026</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:v3.dim, marginTop:6 }}>1.8 kg to go · −0.42 kg/wk</div>
            </div>
            <V3Chip bg={v3.card} size={10.5}>6 weeks</V3Chip>
          </div>
        </V3Card>

        {/* weight stats + chart */}
        <V3Card r={26} pad={17}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[['72.2','Started', v3.text],['69.8','Current','#5F8C12'],['−2.4 kg','Lost','#5F8C12']].map(([v, l, c]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:v3.disp, fontSize:21, fontWeight:700, letterSpacing:'-0.04em', color:c }}>{v}</div>
                <V3Kick style={{ marginTop:5 }}>{l}</V3Kick>
              </div>
            ))}
          </div>
          <div style={{ height:74, marginTop:14 }}>
            <svg width="100%" height="100%" viewBox="0 0 300 74" preserveAspectRatio="none">
              <defs><linearGradient id="v3pw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={v3.limeDeep} stopOpacity="0.32"/><stop offset="100%" stopColor={v3.limeDeep} stopOpacity="0"/></linearGradient></defs>
              <path d={`${path} L 300 74 L 0 74 Z`} fill="url(#v3pw)"/>
              <path d={path} fill="none" stroke={v3.limeDeep} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
              <circle cx={xy[xy.length-1][0]} cy={xy[xy.length-1][1]} r="3.2" fill={v3.limeDeep}/>
            </svg>
          </div>
          <div style={{ display:'flex', gap:9, marginTop:12 }}>
            <V3Btn small kind="light" full onClick={() => onNav && onNav('weightLog')}>+ Log weight</V3Btn>
            <V3Btn small kind="ghost" full onClick={() => onNav && onNav('weightList')}>History</V3Btn>
          </div>
        </V3Card>

        {/* daily targets — 5 nutrient cards */}
        <div>
          <V3Kick style={{ marginBottom:10 }}>Daily targets</V3Kick>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:7 }}>
            {[['1320','kcal',v3.text],['165g','Pro',v3.protein],['60g','Carb','#B0871C'],['45g','Fat','#C4573A'],['25g','Fbre','#2F8C7C']].map(([v, l, c]) => (
              <div key={l} style={{ background:`${c}14`, borderRadius:16, padding:'11px 4px', textAlign:'center' }}>
                <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:800, color:c, lineHeight:1 }}>{v}</div>
                <V3Kick style={{ fontSize:7.5, marginTop:5 }}>{l}</V3Kick>
              </div>
            ))}
          </div>
        </div>

        {/* preferences */}
        <V3Card r={24} pad={17}>
          <V3Kick style={{ marginBottom:5 }}>Preferences</V3Kick>
          <V3Row label="Diet" value="Non-veg"/>
          <V3Row label="Cuisines" value="South Indian, Punjabi"/>
          <V3Row label="Meals/day" value="4"/>
          <V3Row label="Activity" value="Moderate" last/>
        </V3Card>

        {/* plan duration */}
        <div>
          <V3Kick style={{ marginBottom:5 }}>Plan duration</V3Kick>
          <V3Kick style={{ marginBottom:10, fontSize:8.5 }}>Changes take effect on next regeneration</V3Kick>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
            {[7,14].map(d => {
              const on = duration === d;
              return (
                <button key={d} onClick={() => setDuration(d)} style={{
                  border:'none', cursor:'pointer', borderRadius:20, padding:'15px 14px', textAlign:'left',
                  background: on ? v3.lime : v3.card, position:'relative',
                }}>
                  {d === 14 && <V3Chip bg={v3.ink} color={v3.lime} size={8} pad="3px 8px" style={{ position:'absolute', top:-8, right:10 }}>REC</V3Chip>}
                  <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:700 }}>{d}-Day Plan</div>
                  <V3Kick color={on ? v3.panelDim : undefined} style={{ marginTop:5 }}>{d === 7 ? 'One week' : 'Max variety'}</V3Kick>
                </button>
              );
            })}
          </div>
        </div>

        {/* plan history */}
        <div>
          <V3Kick style={{ marginBottom:5 }}>Plan history</V3Kick>
          <V3Kick style={{ marginBottom:10, fontSize:8.5 }}>Your tracking data is preserved across all plans</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {[{ d:14, dt:'20 Apr 2026', k:1318, active:true }, { d:7, dt:'6 Apr 2026', k:1290 }, { d:7, dt:'23 Mar 2026', k:1305 }].map((p, i) => (
              <V3Card key={i} r={18} pad={13} bg={p.active ? v3.limeSoft : v3.card}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <V3Kick color={p.active ? '#5F8C12' : v3.dim}>{p.d}-day plan</V3Kick>
                      {p.active ? <V3Chip bg={v3.lime} size={7.5} pad="2px 6px">ACTIVE</V3Chip>
                        : i === 1 ? <V3Chip bg="transparent" size={7.5} pad="2px 6px" style={{ border:`1px solid ${v3.line}`, color:v3.dimmer }}>PREVIOUS</V3Chip> : null}
                    </div>
                    <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:600, color:v3.dimmer, marginTop:4 }}>{p.dt}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color: p.active ? '#5F8C12' : v3.dim }}>{p.k}</div>
                    <V3Kick style={{ fontSize:7.5 }}>kcal/day</V3Kick>
                  </div>
                </div>
              </V3Card>
            ))}
          </div>
        </div>

        {/* generation usage */}
        <div>
          <V3Card r={18} pad={13}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <V3Kick>Plan regenerations this month</V3Kick>
              <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:800, color:'#5F8C12' }}>1 / 3 USED</span>
            </div>
          </V3Card>
        </div>

        {/* meal plan customiser — inline, as in ProfileTab.tsx */}
        <V3Card r={26} pad={16} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <V3Kick style={{ marginBottom:7 }}>Customise meal plan</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>
              Tell us anything you’d like changed. Applied on next plan regeneration.
            </div>
          </div>
          <div style={{ background:v3.paper, borderRadius:18, padding:'13px 15px', minHeight:80, fontFamily:v3.sans, fontSize:13, fontWeight:500, lineHeight:1.55, color:v3.dimmer }}>
            e.g. Add more eggs to breakfast, avoid rajma this week, make dinners lighter, include a soup every day…
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <span style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.dimmer, letterSpacing:'0.05em' }}>0 / 500</span>
          </div>
          <div style={{ overflowX:'auto', margin:'0 -16px', padding:'0 16px 4px' }}>
            <div style={{ display:'flex', gap:6, width:'max-content' }}>
              {['+ More protein','+ Lighter dinners','+ No repetition','+ Add soups','+ Quick recipes','+ Budget friendly','+ More variety','+ Less spicy','+ Bigger breakfast'].map(c => (
                <button key={c} onClick={() => onNav && onNav('customise')} style={{
                  flexShrink:0, padding:'7px 11px', background:'transparent', borderRadius:999,
                  border:`1.5px solid ${v3.lineStrong}`, cursor:'pointer',
                  fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.1em',
                  color:'#2F8C7C', textTransform:'uppercase', whiteSpace:'nowrap',
                }}>{c}</button>
              ))}
            </div>
          </div>
          <button onClick={() => onNav && onNav('regenConfirm')} style={{
            width:'100%', padding:'15px 0', borderRadius:999, border:'none', cursor:'pointer',
            background:v3.lime, color:v3.ink,
            fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase',
          }}>Regenerate meal plan</button>
        </V3Card>

        <V3Btn kind="warn" full>Logout</V3Btn>
        <V3Btn kind="ghost" full onClick={() => onNav && onNav('deleteAccount')}>Delete account</V3Btn>

        {/* notifications — inline, as in ProfileTab.tsx */}
        <div>
          <V3Kick style={{ marginBottom:10 }}>Notifications</V3Kick>
          <V3Card r={24} pad={16}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:4 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700 }}>Notifications</div>
                <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:v3.dim, marginTop:3 }}>Active — tap to disable</div>
              </div>
              <div style={{ width:44, height:24, borderRadius:999, flexShrink:0, padding:2, background:v3.lime, display:'flex', justifyContent:'flex-end' }}>
                <div style={{ width:20, height:20, borderRadius:999, background:v3.card, boxShadow:'0 2px 5px rgba(15,20,15,0.2)' }}/>
              </div>
            </div>
            {[['Meal reminders','Breakfast, lunch & dinner alerts'],['Water reminders','Every 2h'],['Daily summary','21:00 — how you did today']].map(([l, s], i) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderTop:`1px solid ${v3.line}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:600 }}>{l}</div>
                  <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:500, color:v3.dimmer, marginTop:2 }}>{s}</div>
                </div>
                <div style={{ width:38, height:21, borderRadius:999, flexShrink:0, padding:2, background: i < 2 ? v3.lime : 'rgba(15,20,15,0.13)', display:'flex', justifyContent: i < 2 ? 'flex-end' : 'flex-start' }}>
                  <div style={{ width:17, height:17, borderRadius:999, background:v3.card, boxShadow:'0 2px 4px rgba(15,20,15,0.18)' }}/>
                </div>
              </div>
            ))}
            <button onClick={() => onNav && onNav('notifications')} style={{
              width:'100%', marginTop:12, background:'transparent', border:'none', cursor:'pointer', padding:0,
              fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.13em', color:'#5F8C12', textTransform:'uppercase',
            }}>All notification settings →</button>
          </V3Card>
        </div>

        {/* rate & share */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
          {[['⭐','Rate the app'],['🔗','Tell a friend']].map(([e, l]) => (
            <V3Card key={l} r={20} pad={14} style={{ textAlign:'center' }}>
              <div style={{ fontSize:18 }}>{e}</div>
              <V3Kick style={{ marginTop:6 }}>{l}</V3Kick>
            </V3Card>
          ))}
        </div>

        {/* analytics toggle */}
        <V3Card r={20} pad={14}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
            <div>
              <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:700 }}>Usage analytics</div>
              <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.dimmer, marginTop:3 }}>Anonymous usage data to improve the app</div>
            </div>
            <div onClick={() => setAnalytics(a => !a)} style={{
              width:44, height:24, borderRadius:999, flexShrink:0, cursor:'pointer', padding:2,
              background: analytics ? v3.lime : 'rgba(15,20,15,0.13)', display:'flex', justifyContent: analytics ? 'flex-end' : 'flex-start',
            }}><div style={{ width:20, height:20, borderRadius:999, background:v3.card, boxShadow:'0 2px 5px rgba(15,20,15,0.2)' }}/></div>
          </div>
        </V3Card>

        {/* AI disclaimer */}
        <V3Card bg="rgba(198,242,78,0.16)" r={18} pad={13}>
          <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, lineHeight:1.55, color:v3.dim }}>
            <b style={{ color:'#5F8C12' }}>AI Disclaimer:</b> Meal plans are AI-generated and for informational purposes only.
            Not a substitute for professional medical advice. Consult a healthcare provider before starting any diet program.
          </div>
        </V3Card>

        <div style={{ display:'flex', justifyContent:'center', gap:16, fontFamily:v3.sans, fontSize:11, fontWeight:600 }}>
          <a href="Privacy Policy.html">Privacy Policy</a><span style={{ color:v3.dimmer }}>|</span><a href="Privacy Policy.html">Terms of Service</a>
        </div>
        <div style={{ textAlign:'center' }}><V3Kick>Plan Your Plate v1.0.0</V3Kick></div>
      </div>
    </V3Scaffold>
  );
};

// ── Delete account confirm ───────────────────────────────────
window.V3DeleteAccount = function V3DeleteAccount({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Account" title="Delete account"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg="rgba(229,72,77,0.10)" r={24} pad={18}>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ width:24, height:24, borderRadius:999, background:v3.warn, color:'#fff', display:'grid', placeItems:'center', fontSize:13, fontWeight:800, flexShrink:0 }}>!</div>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.text, lineHeight:1.55 }}>
              This permanently deletes all your data including meal plans, logs, and profile. This cannot be undone.
            </div>
          </div>
        </V3Card>
        <V3Card r={24} pad={17} style={{ marginTop:12 }}>
          <V3Kick style={{ marginBottom:10 }}>Confirm your password</V3Kick>
          <div style={{ background:v3.paper, borderRadius:16, padding:'13px 16px', fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dimmer }}>Enter your password</div>
        </V3Card>
        <div style={{ display:'flex', gap:9, marginTop:20 }}>
          <V3Btn kind="ghost" full onClick={() => onNav && onNav('profile')}>Cancel</V3Btn>
          <V3Btn full style={{ background:v3.warn, color:'#fff' }}>Delete my account</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Monthly macros (MonthlyCalorieChart.tsx) ─────────────────
const V3_MACRO_CFG = {
  calories:{ label:'Calories', tab:'KCAL', unit:'kcal', color:'#5F8C12', consumed:38550, target:39600, dailyAvg:1285 },
  protein: { label:'Protein', tab:'Protein', unit:'g', color:v3.protein, consumed:4740, target:4950, dailyAvg:158 },
  carbs:   { label:'Carbs', tab:'Carbs', unit:'g', color:'#B0871C', consumed:1620, target:1800, dailyAvg:54 },
  fat:     { label:'Fat', tab:'Fat', unit:'g', color:'#C4573A', consumed:1260, target:1350, dailyAvg:42 },
  fibre:   { label:'Fibre', tab:'Fibre', unit:'g', color:'#2F8C7C', consumed:660, target:750, dailyAvg:22 },
};
const V3_DELTAS = {
  calories:[-140,-30,-200,20,-100,60,-60,-140,90,-30,20,-120,50,-30,-70,-10,-130,100,-40,10,-110,40,-80,-20,-50,30,-140,-30,0,-60],
  protein: [-23,-5,-10,5,-17,7,-3,-10,10,3,-5,-15,3,0,-8,-2,-12,6,-4,2,-9,4,-6,-3,-5,2,-11,-4,-1,-7],
  carbs:   [-8,1,-12,-5,-10,2,-4,-11,-2,-5,-9,-12,-3,-6,-7,-4,-13,-1,-6,-3,-10,-2,-8,-5,-6,-3,-11,-5,-4,-7],
  fat:     [-7,1,-5,3,-4,-1,-2,-7,5,-1,-3,-6,2,-3,-5,-2,-8,4,-3,-1,-6,0,-4,-2,-3,-1,-7,-2,-1,-4],
  fibre:   [-7,-1,-5,1,-4,0,-2,-6,2,-1,-3,-5,0,-3,-4,-2,-6,1,-3,-1,-5,0,-4,-2,-3,-1,-6,-2,-1,-3],
};

window.V3Kcal = function V3Kcal({ onNav }) {
  const [macro, setMacro] = React.useState('calories');
  const cfg = V3_MACRO_CFG[macro];
  const deltas = V3_DELTAS[macro];
  const maxAbs = Math.max(...deltas.map(Math.abs), 10);
  const yMax = Math.ceil(maxAbs / 10) * 10;
  const delta = cfg.consumed - cfg.target;
  const pct = Math.min((cfg.consumed / cfg.target) * 100, 100);
  const fmt = n => cfg.unit === 'kcal' ? Math.abs(n).toLocaleString() : Math.abs(Math.round(n)) + 'g';
  const H = 150, zero = H / 2;
  const deficitLine = zero + (cfg.target / 30 * 0.1 / yMax) * (H / 2);
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('tracker')} kick="Tracker" title="Monthly macros"
        right={<div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <V3IconBtn size={32} bg={v3.card}>‹</V3IconBtn>
          <span style={{ fontFamily:v3.sans, fontSize:10, fontWeight:800, letterSpacing:'0.1em', minWidth:80, textAlign:'center', textTransform:'uppercase' }}>April 2026</span>
          <V3IconBtn size={32} bg={v3.card} color={v3.dimmer}>›</V3IconBtn>
        </div>}/>

      <div style={{ padding:'20px 22px 0' }}>
        {/* macro tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${v3.line}`, marginBottom:16 }}>
          {Object.keys(V3_MACRO_CFG).map(mk => {
            const on = macro === mk, c = V3_MACRO_CFG[mk].color;
            return (
              <button key={mk} onClick={() => setMacro(mk)} style={{
                flex:1, background:'transparent', border:'none', cursor:'pointer', padding:'9px 2px',
                borderBottom: on ? `2px solid ${c}` : '2px solid transparent',
                fontFamily:v3.sans, fontSize:9, fontWeight:800, letterSpacing:'0.1em',
                color: on ? c : v3.dimmer, textTransform:'uppercase',
              }}>{V3_MACRO_CFG[mk].tab}</button>
            );
          })}
        </div>

        {/* 3 stat cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
          {[
            { l:'Consumed', v:cfg.consumed.toLocaleString() + (cfg.unit === 'g' ? 'g' : ''), c:v3.text },
            { l:'Target', v:cfg.target.toLocaleString() + (cfg.unit === 'g' ? 'g' : ''), c:v3.dim },
            { l:'Delta', v:(delta > 0 ? '+' : '−') + fmt(delta), c: delta > 0 ? v3.warn : '#2F8C7C' },
          ].map(s => (
            <V3Card key={s.l} r={18} pad={12} style={{ textAlign:'center' }}>
              <V3Kick style={{ fontSize:7.5, marginBottom:6 }}>{s.l}</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:800, color:s.c, letterSpacing:'-0.02em' }}>{s.v}</div>
            </V3Card>
          ))}
        </div>

        <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, letterSpacing:'0.1em', color:v3.dimmer, margin:'14px 0' }}>
          <span style={{ color:v3.text }}>30</span> OF <span style={{ color:v3.text }}>30</span> PLAN DAYS PROGRESSED (100%)
        </div>

        {/* daily avg / under / over — recomputed per macro tab */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
          {[
            { k:'Daily avg', v: cfg.unit === 'kcal' ? cfg.dailyAvg.toLocaleString() : cfg.dailyAvg, u: cfg.unit, bg:v3.lime },
            { k:'Under target', v: deltas.filter(d => d < 0).length, u:'days', bg:v3.mint },
            { k:'Over target', v: deltas.filter(d => d > 0).length, u:'days', bg:v3.peach },
          ].map(s => (
            <V3Card key={s.k} bg={s.bg} r={20} pad={13}>
              <V3Kick color="rgba(15,20,15,0.5)">{s.k}</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.04em', lineHeight:1, marginTop:7 }}>{s.v}</div>
              <div style={{ fontFamily:v3.sans, fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'rgba(15,20,15,0.5)', marginTop:5, textTransform:'uppercase' }}>{s.u}</div>
            </V3Card>
          ))}
        </div>

        {/* delta bar chart around zero */}
        <V3Kick style={{ marginBottom:8, fontSize:7.5 }}>Daily {cfg.label} balance</V3Kick>
        <div style={{ position:'relative', height:H, display:'flex', alignItems:'center', gap:2 }}>
          <div style={{ position:'absolute', left:0, right:0, top:zero, height:1, borderTop:`1px dashed ${v3.lineStrong}` }}/>
          <div style={{ position:'absolute', left:0, right:0, top:deficitLine, height:1, borderTop:`1px dashed rgba(47,140,124,0.5)` }}/>
          {deltas.map((d, i) => {
            const h = Math.abs(d) / yMax * (H / 2);
            const over = d > 0;
            return (
              <div key={i} style={{ flex:1, height:'100%', position:'relative' }}>
                <div style={{
                  position:'absolute', left:0, right:0, height:h,
                  top: over ? zero - h : zero,
                  background: over ? v3.warn : '#2F8C7C', borderRadius:2, opacity:0.9,
                }}/>
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:v3.sans, fontSize:9, fontWeight:700, color:v3.dimmer }}>
          <span>1</span><span>10</span><span>20</span><span>30</span>
        </div>

        {/* cumulative progress */}
        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:8, fontSize:7.5 }}>Cumulative progress</V3Kick>
          <V3Bar pct={pct / 100} h={5} color="#2F8C7C"/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.dimmer }}>
            <span>0</span>
            <span style={{ color:'#2F8C7C' }}>{pct.toFixed(1)}% of {cfg.label.toLowerCase()} target</span>
            <span>{cfg.target.toLocaleString()}{cfg.unit === 'kcal' ? ' kcal' : 'g'}</span>
          </div>
          <div style={{ marginTop:8, fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.05em', color: delta > 0 ? v3.warn : '#2F8C7C' }}>
            {fmt(delta)}{cfg.unit === 'kcal' ? ' KCAL' : ''} {delta > 0 ? 'OVER' : 'UNDER'} {cfg.label.toUpperCase()} TARGET
          </div>
          <div style={{ marginTop:5, fontFamily:v3.sans, fontSize:9.5, fontWeight:600, color:v3.dimmer }}>
            Daily avg: <span style={{ color:v3.text }}>{cfg.dailyAvg.toLocaleString()}{cfg.unit === 'g' ? 'g' : ''}</span> vs{' '}
            <span style={{ color:v3.text }}>{Math.round(cfg.target / 30).toLocaleString()}{cfg.unit === 'g' ? 'g' : ' kcal'}</span> goal
          </div>
        </div>

        {/* insight */}
        <V3Card r={20} pad={14} style={{ marginTop:16 }}>
          <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>
            {macro === 'calories' ? '✅ Healthy calories deficit. On track for your goal.'
             : macro === 'protein' ? '⚠️ Below your protein target. Try to increase protein intake.'
             : macro === 'fibre' ? '⚠️ Below your fibre target. Try to increase fibre intake.'
             : `🎯 Right on your ${cfg.label.toLowerCase()} target. Great consistency.`}
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};
