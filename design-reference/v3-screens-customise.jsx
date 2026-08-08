// v3 — grounded overrides: Customise plan, Regenerate confirm/progress, Reset password
// Sources: MealPlanCustomiser.tsx, ProfileTab.tsx (showConfirm + regenerating blocks), ResetPasswordScreen.tsx
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3IconBtn, V3Row } = window;

const V3_SUGGESTION_CHIPS = [
  '+ More protein','+ Lighter dinners','+ No repetition','+ Add soups','+ Quick recipes',
  '+ Budget friendly','+ More variety','+ Less spicy','+ Bigger breakfast',
];
const V3_MAX_CHARS = 500;

// ── Customise meal plan (MealPlanCustomiser.tsx) ─────────────
window.V3Customise = function V3Customise({ onNav }) {
  const [text, setText] = React.useState('Make dinners lighter, under 300 calories, Include at least one soup or broth per day');
  const has = text.trim().length > 0;
  const count = text.length;
  const charColor = count >= 480 ? v3.warn : count >= 400 ? '#B0871C' : v3.dimmer;
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Plan settings" title="Customise meal plan"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={26} pad={16} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <V3Kick style={{ marginBottom:7 }}>Customise meal plan</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>
              Tell us anything you’d like changed. Applied on next plan regeneration.
            </div>
          </div>

          {/* textarea */}
          <div style={{
            background:v3.paper, borderRadius:18, padding:'13px 15px', minHeight:80,
            fontFamily:v3.sans, fontSize:13, fontWeight:500, lineHeight:1.55,
            color: has ? v3.text : v3.dimmer,
          }}>
            {has ? text : 'e.g. Add more eggs to breakfast, avoid rajma this week, make dinners lighter, include a soup every day…'}
          </div>

          {/* clear + save status + counter */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {has && (
                <button onClick={() => setText('')} style={{
                  background:'transparent', border:'none', padding:0, cursor:'pointer',
                  fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.14em', color:v3.dimmer, textTransform:'uppercase',
                }}>Clear</button>
              )}
              <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.14em', color:'#2F8C7C', textTransform:'uppercase' }}>Saved</span>
            </div>
            <span style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:charColor, letterSpacing:'0.05em' }}>{count} / {V3_MAX_CHARS}</span>
          </div>

          {/* suggestion chips — horizontally scrollable */}
          <div style={{ overflowX:'auto', margin:'0 -16px', padding:'0 16px 4px' }}>
            <div style={{ display:'flex', gap:6, width:'max-content' }}>
              {V3_SUGGESTION_CHIPS.map(c => (
                <button key={c} style={{
                  flexShrink:0, padding:'7px 11px', background:'transparent', borderRadius:999,
                  border:`1.5px solid ${v3.lineStrong}`, cursor:'pointer',
                  fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.1em',
                  color:'#2F8C7C', textTransform:'uppercase', whiteSpace:'nowrap',
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* regenerate button with active-instructions dot */}
          <button onClick={() => onNav && onNav('regenConfirm')} style={{
            width:'100%', padding:'15px 0', borderRadius:999, border:'none', cursor:'pointer', position:'relative',
            background:v3.lime, color:v3.ink,
            fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase',
          }}>
            {has ? 'Regenerate with my changes' : 'Regenerate meal plan'}
            {has && <span style={{ position:'absolute', top:10, right:14, width:5, height:5, borderRadius:999, background:v3.ink }}/>}
          </button>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Customise · monthly limit reached ────────────────────────
window.V3CustomiseLimit = function V3CustomiseLimit({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Plan settings" title="Customise meal plan"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={18} pad={13}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <V3Kick>Plan regenerations this month</V3Kick>
            <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:800, color:v3.warn }}>3 / 3 USED</span>
          </div>
        </V3Card>
        <V3Card bg="rgba(229,72,77,0.08)" r={18} pad={13} style={{ marginTop:9, textAlign:'center' }}>
          <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.warn }}>Monthly limit reached. Resets on 1 May 2026.</div>
        </V3Card>

        <V3Card r={26} pad={16} style={{ marginTop:12, display:'flex', flexDirection:'column', gap:14 }}>
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
            <span style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:700, color:v3.dimmer, letterSpacing:'0.05em' }}>0 / {V3_MAX_CHARS}</span>
          </div>
          <div style={{ overflowX:'auto', margin:'0 -16px', padding:'0 16px 4px' }}>
            <div style={{ display:'flex', gap:6, width:'max-content' }}>
              {V3_SUGGESTION_CHIPS.map(c => (
                <button key={c} style={{
                  flexShrink:0, padding:'7px 11px', background:'transparent', borderRadius:999,
                  border:`1.5px solid ${v3.line}`, cursor:'not-allowed', opacity:0.4,
                  fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.1em',
                  color:'#2F8C7C', textTransform:'uppercase', whiteSpace:'nowrap',
                }}>{c}</button>
              ))}
            </div>
          </div>
          <button disabled style={{
            width:'100%', padding:'15px 0', borderRadius:999, cursor:'not-allowed',
            background:v3.paper, border:`1.5px solid ${v3.lineStrong}`, color:v3.dimmer,
            fontFamily:v3.sans, fontSize:10.5, fontWeight:800, letterSpacing:'0.16em', textTransform:'uppercase',
          }}>Monthly limit reached</button>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Regenerate · confirm modal (ProfileTab showConfirm) ──────
window.V3RegenConfirm = function V3RegenConfirm({ onNav }) {
  const [hasInstructions, setHas] = React.useState(true);
  const instructions = 'Make dinners lighter, under 300 calories, Include at least one soup or broth per day';
  return (
    <V3Scaffold nav={false} onNav={onNav} bg="rgba(15,20,15,0.62)" dark>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:20 }}>
        <V3Card r={28} pad={24} style={{ width:'100%', maxWidth:340, boxShadow:'0 20px 60px rgba(15,20,15,0.4)' }}>
          {hasInstructions ? (<>
            <V3Kick style={{ marginBottom:11 }}>Regenerate with changes</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:700, color:v3.text, marginBottom:11 }}>Apply your custom instructions?</div>
            <div style={{ background:v3.paper, borderRadius:16, padding:'11px 13px', marginBottom:11 }}>
              <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, fontStyle:'italic', lineHeight:1.5 }}>“{instructions}”</div>
            </div>
            <V3Kick style={{ marginBottom:20, fontSize:8.5 }}>Your tracking history will be preserved</V3Kick>
          </>) : (<>
            <V3Kick style={{ marginBottom:11 }}>Regenerate plan</V3Kick>
            <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:700, color:v3.text, marginBottom:7 }}>Create a new 14-day plan?</div>
            <V3Kick style={{ marginBottom:20, fontSize:8.5 }}>Your tracking history will be preserved</V3Kick>
          </>)}
          <div style={{ display:'flex', gap:10 }}>
            <V3Btn kind="ghost" small style={{ flex:1 }} onClick={() => onNav && onNav('profile')}>Cancel</V3Btn>
            <V3Btn small style={{ flex:1 }} onClick={() => onNav && onNav('regenProgress')}>
              {hasInstructions ? 'Yes, regen' : 'Regenerate'}
            </V3Btn>
          </div>
          <button onClick={() => setHas(h => !h)} style={{
            width:'100%', marginTop:14, background:'transparent', border:'none', cursor:'pointer', padding:0,
            fontFamily:v3.sans, fontSize:9, fontWeight:700, letterSpacing:'0.12em', color:v3.dimmer, textTransform:'uppercase',
          }}>Toggle: {hasInstructions ? 'without' : 'with'} instructions</button>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Regenerate · progress (ProfileTab regenerating) ──────────
window.V3RegenProgress = function V3RegenProgress({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <style>{`@keyframes v3shimmer{0%{left:-60%}100%{left:100%}}`}</style>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:32 }}>
        <div style={{ textAlign:'center', maxWidth:280, width:'100%' }}>
          <V3Kick style={{ marginBottom:16 }}>Regenerating</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:27, fontWeight:700, letterSpacing:'-0.035em', color:v3.text, marginBottom:13 }}>
            Building your plan
          </div>
          <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:'#5F8C12', letterSpacing:'0.08em', marginBottom:24, minHeight:18 }}>
            Validating meal macros...
          </div>
          {/* indeterminate shimmer bar */}
          <div style={{ height:3, borderRadius:999, background:v3.track, position:'relative', overflow:'hidden' }}>
            <div style={{
              position:'absolute', top:0, left:'-60%', height:'100%', width:'60%',
              background:`linear-gradient(90deg, transparent, ${v3.lime}, transparent)`,
              animation:'v3shimmer 1.4s infinite linear',
            }}/>
          </div>
          <V3Btn kind="ghost" small full style={{ marginTop:28 }} onClick={() => onNav && onNav('planOverview')}>Continue</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Regenerate · error ───────────────────────────────────────
window.V3RegenError = function V3RegenError({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:32 }}>
        <div style={{ textAlign:'center', maxWidth:280, width:'100%' }}>
          <V3Kick style={{ marginBottom:16 }}>Regenerating</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:27, fontWeight:700, letterSpacing:'-0.035em', color:v3.text, marginBottom:13 }}>
            Building your plan
          </div>
          <div style={{ height:3, borderRadius:999, background:v3.track }}/>
          <V3Card bg="rgba(229,72,77,0.08)" r={18} pad={14} style={{ marginTop:20, border:`1px solid rgba(229,72,77,0.35)` }}>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color:v3.warn }}>Request timed out</div>
            <button onClick={() => onNav && onNav('profile')} style={{
              background:'transparent', border:'none', cursor:'pointer', padding:0, marginTop:9,
              fontFamily:v3.sans, fontSize:9.5, fontWeight:800, letterSpacing:'0.14em', color:'#5F8C12', textTransform:'uppercase',
            }}>Back</button>
          </V3Card>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Reset password (ResetPasswordScreen.tsx) ─────────────────
window.V3ResetPassword = function V3ResetPassword({ onNav }) {
  const [state, setState] = React.useState('valid');
  const Input = ({ ph }) => (
    <div style={{ background:v3.paper, borderRadius:14, padding:'13px 15px', marginBottom:12, fontFamily:v3.sans, fontSize:14, fontWeight:500, color:v3.dimmer }}>{ph}</div>
  );
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:'0 20px' }}>
        <V3Card r={26} pad={28} style={{ width:'100%', maxWidth:380, boxShadow:'0 20px 60px rgba(15,20,15,0.14)' }}>
          {state === 'loading' && (<>
            <V3H size={22}>Verifying link…</V3H>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, marginTop:9 }}>One moment.</div>
          </>)}

          {state === 'invalid' && (<>
            <V3H size={22}>Reset link invalid</V3H>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.5, margin:'9px 0 20px' }}>
              This password-reset link has expired. Please request a new one.
            </div>
            <V3Btn kind="dark" full onClick={() => onNav && onNav('auth')}>Back to sign in</V3Btn>
          </>)}

          {state === 'done' && (<>
            <V3H size={22}>Password updated</V3H>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.5, margin:'9px 0 20px' }}>
              Your password has been reset. You can now sign in with your new password.
            </div>
            <V3Btn kind="dark" full onClick={() => onNav && onNav('auth')}>Sign in</V3Btn>
          </>)}

          {state === 'valid' && (<>
            <V3H size={22}>Set a new password</V3H>
            <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.5, margin:'9px 0 20px' }}>
              Enter a new password for your account.
            </div>
            <Input ph="New password (min 6 chars)"/>
            <Input ph="Confirm new password"/>
            <V3Btn kind="dark" full style={{ marginTop:4 }} onClick={() => setState('done')}>Update password</V3Btn>
          </>)}

          {/* state switcher for review */}
          <div style={{ display:'flex', gap:5, marginTop:18, justifyContent:'center' }}>
            {['loading','valid','done','invalid'].map(s => (
              <button key={s} onClick={() => setState(s)} style={{
                border:'none', cursor:'pointer', borderRadius:999, padding:'5px 10px',
                background: state === s ? v3.ink : v3.paper, color: state === s ? v3.lime : v3.dimmer,
                fontFamily:v3.sans, fontSize:8.5, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase',
              }}>{s}</button>
            ))}
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};
