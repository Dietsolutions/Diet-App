// v3 — screens rebuilt directly from source files (override the earlier guesses in v3-screens-app2.jsx)
// Sources: PlanOverviewScreen.tsx, NotificationSettings.tsx, weight/WeightLogList.tsx, weight/WeightStatsHeader.tsx,
// plus states read in App.tsx and ShoppingTab.tsx.
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3IconBtn, V3Row } = window;

// ── Plan overview — "Review & customise" (PlanOverviewScreen.tsx) ────────────
window.V3PlanOverview = function V3PlanOverview({ onNav }) {
  const [open, setOpen] = React.useState(0);
  const days = [
    { l:'Day 1', k:1318, meals:[
      { t:'Breakfast', n:'Masala egg white scramble', k:280 }, { t:'Lunch', n:'Tandoori chicken + raita', k:360 },
      { t:'Snack', n:'Roasted chana + buttermilk', k:130 }, { t:'Dinner', n:'Grilled fish + spinach', k:310 },
    ]},
    { l:'Day 2', k:1324, meals:[
      { t:'Breakfast', n:'Moong dal chilla + curd', k:295 }, { t:'Lunch', n:'Chicken chettinad + salad', k:372 },
      { t:'Snack', n:'Makhana + green tea', k:120 }, { t:'Dinner', n:'Paneer bhurji + 2 roti', k:320 },
    ]},
    { l:'Day 3', k:1315, meals:[
      { t:'Breakfast', n:'Oats with berries', k:268 }, { t:'Lunch', n:'Rajma + brown rice', k:388 },
      { t:'Snack', n:'Greek yogurt bowl', k:184 }, { t:'Dinner', n:'Grilled fish tikka', k:298 },
    ]},
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav} footer={
      <div style={{ position:'absolute', left:0, right:0, bottom:0, background:v3.paper, borderTop:`1px solid ${v3.line}`, padding:'14px 22px 22px', zIndex:20 }}>
        <V3Btn kind="dark" full onClick={() => onNav && onNav('meals')}>Start my plan →</V3Btn>
        <div style={{ textAlign:'center', marginTop:11 }}>
          <button onClick={() => onNav && onNav('meals')} style={{
            background:'none', border:'none', cursor:'pointer', fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dimmer,
          }}>Skip review — enter app</button>
        </div>
      </div>
    }>
      <div style={{ padding:'24px 22px 0' }}>
        <V3Kick>Your plan is ready</V3Kick>
        <V3H size={36} style={{ marginTop:10 }}>Review &amp; customise</V3H>
        <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, marginTop:11, lineHeight:1.6 }}>
          Tap <span style={{ fontWeight:700, color:v3.text }}>Change</span> on any meal to get 4 AI alternatives.
        </div>
      </div>

      <div style={{ padding:'20px 22px 0', display:'flex', flexDirection:'column', gap:9 }}>
        {days.map((d, i) => {
          const on = open === i;
          return (
            <V3Card key={i} r={24} pad={0} style={{ overflow:'hidden' }}>
              <button onClick={() => setOpen(on ? -1 : i)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:12, padding:'15px 17px',
                background: on ? v3.lime : 'transparent', border:'none', cursor:'pointer', textAlign:'left',
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{d.l}</div>
                  <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color: on ? 'rgba(15,20,15,0.6)' : v3.dim, marginTop:3 }}>
                    {d.meals.length} meals · {d.k} kcal
                  </div>
                </div>
                <span style={{ color: on ? v3.ink : v3.dimmer, fontSize:12, fontWeight:700, transform: on ? 'rotate(90deg)' : 'none', transition:'transform 200ms' }}>›</span>
              </button>
              {on && (
                <div style={{ padding:'6px 17px 15px' }}>
                  {d.meals.map((m, j) => (
                    <div key={j} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom: j === d.meals.length - 1 ? 'none' : `1px solid ${v3.line}` }}>
                      <V3Chip bg={v3.paper} size={9} pad="3px 8px">{m.t}</V3Chip>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600 }}>{m.n}</div>
                        <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:600, color:v3.dimmer, marginTop:2 }}>{m.k} kcal</div>
                      </div>
                      <button onClick={() => onNav && onNav('changeMeal')} style={{
                        border:`1px solid ${v3.lineStrong}`, background:'transparent', borderRadius:999,
                        padding:'7px 12px', cursor:'pointer', fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.text, flexShrink:0,
                      }}>✎ Change</button>
                    </div>
                  ))}
                </div>
              )}
            </V3Card>
          );
        })}
        <V3Chip bg={v3.card} size={11.5} pad="12px 16px" style={{ justifyContent:'center', border:`1px dashed ${v3.lineStrong}`, color:v3.dim }}>+ 11 more days</V3Chip>
      </div>
    </V3Scaffold>
  );
};

// ── Change meal — 4 AI alternatives (ChangeMealSheet entry point) ────────────
window.V3ChangeMeal = function V3ChangeMeal({ onNav }) {
  const alts = [
    { n:'Paneer tikka + salad', k:352, p:29, tint:v3.butter },
    { n:'Egg bhurji + 2 roti', k:368, p:31, tint:v3.mint },
    { n:'Rajma + brown rice', k:355, p:24, tint:v3.peach },
    { n:'Chicken salad bowl', k:345, p:44, tint:v3.lilac },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('planOverview')} kick="Day 1 · lunch" title="4 alternatives"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={24} pad={15} style={{ opacity:0.65 }}>
          <V3Kick>Replacing</V3Kick>
          <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700, marginTop:5 }}>Tandoori chicken + raita · 360 kcal</div>
        </V3Card>
        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:9 }}>
          {alts.map((a, i) => (
            <V3Card key={i} r={22} pad={15} onClick={() => onNav && onNav('planOverview')}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:26, height:26, borderRadius:999, background:a.tint, display:'grid', placeItems:'center', fontFamily:v3.sans, fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{a.n}</div>
                  <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.dim, marginTop:3 }}>{a.k} kcal · {a.p} g protein</div>
                </div>
                <V3IconBtn bg={v3.paper} size={32}>+</V3IconBtn>
              </div>
            </V3Card>
          ))}
        </div>
        <V3Btn kind="ghost" full small style={{ marginTop:16 }} onClick={() => onNav && onNav('planOverview')}>Keep the original</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Notification settings (NotificationSettings.tsx) ─────────────────────────
window.V3Notifications = function V3Notifications({ onNav }) {
  const [master, setMaster] = React.useState(true);
  const [p, setP] = React.useState({
    mealReminders:true, mealFollowUps:true, planExpiry:true,
    waterReminders:true, weightReminders:true, weightMilestones:true,
    shoppingReminders:false, dailySummary:true, streakNotifs:true,
    reengagement:false, recipeDigest:false, tipsNotifs:true,
  });
  const [interval_, setInterval_] = React.useState(2);
  const Toggle = ({ on, onClick }) => (
    <div onClick={onClick} style={{
      width:44, height:24, borderRadius:999, flexShrink:0, cursor:'pointer', padding:2,
      background: on ? v3.lime : 'rgba(15,20,15,0.13)', transition:'background 200ms ease-out',
      display:'flex', justifyContent: on ? 'flex-end' : 'flex-start',
    }}><div style={{ width:20, height:20, borderRadius:999, background:v3.card, boxShadow:'0 2px 5px rgba(15,20,15,0.2)' }}/></div>
  );
  const Row = ({ k, label, sub, last }) => (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 0', borderBottom: last ? 'none' : `1px solid ${v3.line}` }}>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600 }}>{label}</div>
        {sub && <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:500, color:v3.dimmer, marginTop:3 }}>{sub}</div>}
      </div>
      <Toggle on={p[k]} onClick={() => setP(s => ({ ...s, [k]: !s[k] }))}/>
    </div>
  );
  const Time = ({ v }) => (
    <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, background:v3.paper, borderRadius:999, padding:'6px 12px' }}>{v}</span>
  );
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Settings" title="Notifications"/>
      <div style={{ padding:'22px 22px 0' }}>
        {/* master */}
        <V3Card bg={master ? v3.lime : v3.card} r={26} pad={18}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:v3.sans, fontSize:14.5, fontWeight:700 }}>Notifications</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color: master ? 'rgba(15,20,15,0.6)' : v3.dimmer, marginTop:3 }}>
                {master ? 'Active — tap to disable' : 'Enable to get reminders'}
              </div>
            </div>
            <Toggle on={master} onClick={() => setMaster(m => !m)}/>
          </div>
        </V3Card>

        {master && (<>
          <V3Card r={26} pad={18} style={{ marginTop:12 }}>
            <V3Kick style={{ marginBottom:6 }}>Meal reminders</V3Kick>
            <Row k="mealReminders" label="Meal reminders" sub="Breakfast, lunch &amp; dinner alerts"/>
            <Row k="mealFollowUps" label="Follow-up if not logged" sub="2 hours after each meal time"/>
            <Row k="planExpiry" label="Plan expiry alerts" sub="2 days before plan ends" last/>
            {p.mealReminders && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${v3.line}` }}>
                <V3Kick style={{ marginBottom:10 }}>Meal times</V3Kick>
                {[['Breakfast','08:00'],['Lunch','13:00'],['Dinner','20:00']].map(([m, t], i) => (
                  <div key={m} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom: i === 2 ? 'none' : `1px solid ${v3.line}` }}>
                    <span style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim }}>{m}</span>
                    <Time v={t}/>
                  </div>
                ))}
              </div>
            )}
          </V3Card>

          <V3Card r={26} pad={18} style={{ marginTop:12 }}>
            <V3Kick style={{ marginBottom:6 }}>Water &amp; wellness</V3Kick>
            <Row k="waterReminders" label="Water reminders" sub={`Every ${interval_}h — tap water to adjust`} last/>
            {p.waterReminders && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:14, marginTop:12, borderTop:`1px solid ${v3.line}` }}>
                <span style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim }}>Interval</span>
                <div style={{ display:'flex', gap:6 }}>
                  {[1,2,3,4].map(h => (
                    <button key={h} onClick={() => setInterval_(h)} style={{
                      border:'none', cursor:'pointer', borderRadius:999, padding:'7px 13px',
                      background: interval_ === h ? v3.ink : v3.paper, color: interval_ === h ? v3.lime : v3.dim,
                      fontFamily:v3.sans, fontSize:11.5, fontWeight:700,
                    }}>{h}h</button>
                  ))}
                </div>
              </div>
            )}
          </V3Card>

          <V3Card r={26} pad={18} style={{ marginTop:12 }}>
            <V3Kick style={{ marginBottom:6 }}>Weight tracking</V3Kick>
            <Row k="weightReminders" label="Daily weigh-in reminder" sub="Morning reminder + 10 AM follow-up"/>
            <Row k="weightMilestones" label="Milestone celebrations" sub="Every 1 kg lost, halfway, goal reached" last/>
            {p.weightReminders && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:14, marginTop:12, borderTop:`1px solid ${v3.line}` }}>
                <span style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim }}>Reminder time</span>
                <Time v="07:00"/>
              </div>
            )}
          </V3Card>

          <V3Card r={26} pad={18} style={{ marginTop:12 }}>
            <V3Kick style={{ marginBottom:6 }}>Other reminders</V3Kick>
            <Row k="shoppingReminders" label="Shopping reminders" sub="When items are unbought"/>
            <Row k="dailySummary" label="Daily summary" sub="21:00 — how you did today"/>
            <Row k="streakNotifs" label="Streak notifications" sub="At 3, 7, 14, 30-day milestones"/>
            <Row k="reengagement" label="Re-engagement reminder" sub="After 3+ days of inactivity"/>
            <Row k="recipeDigest" label="Recipe digest" sub="Weekly new recipe picks"/>
            <Row k="tipsNotifs" label="Nutrition tips" sub="Weekly knowledge &amp; tips" last/>
          </V3Card>
        </>)}

        <V3Card bg={v3.cream} r={24} pad={16} style={{ marginTop:12 }}>
          <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>
            On the web, push notifications are unavailable — they work in the iOS and Android apps.
          </div>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Weight history (WeightStatsHeader.tsx + WeightLogList.tsx) ───────────────
window.V3WeightList = function V3WeightList({ onNav }) {
  const [expanded, setExpanded] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);
  const all = [
    { id:'a', d:'22 Apr', w:69.8, delta:-0.3, note:'Morning, fasted' },
    { id:'b', d:'18 Apr', w:70.1, delta:-0.2, note:'' },
    { id:'c', d:'14 Apr', w:70.3, delta:-0.5, note:'After travel week' },
    { id:'d', d:'10 Apr', w:70.8, delta:-0.4, note:'' },
    { id:'e', d:'06 Apr', w:71.2, delta:+0.1, note:'Post-wedding' },
    { id:'f', d:'02 Apr', w:71.1, delta:-0.5, note:'' },
    { id:'g', d:'28 Mar', w:71.6, delta:-0.6, note:'' },
    { id:'h', d:'24 Mar', w:72.2, delta:null, note:'First entry' },
  ];
  const shown = expanded ? all : all.slice(0, 5);
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick={`${all.length} entries`} title="Weight progress"
        right={<V3Btn small onClick={() => onNav && onNav('weightLog')}>+ Log</V3Btn>}/>

      {/* stats header — started / current / lost */}
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={28} pad={18}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { v:'72.2', l:'Started', c:v3.text },
              { v:'69.8', l:'Current', c:'#5F8C12' },
              { v:'−2.4 kg', l:'Lost', c:'#5F8C12' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:v3.disp, fontSize:22, fontWeight:700, letterSpacing:'-0.04em', color:s.c }}>{s.v}</div>
                <V3Kick style={{ marginTop:5 }}>{s.l}</V3Kick>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16 }}><V3Bar pct={0.57} h={8}/></div>
          <div style={{ textAlign:'right', fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.dimmer, marginTop:7 }}>57% TO GOAL</div>
        </V3Card>
      </div>

      {/* log list */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={0} style={{ overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'15px 17px', borderBottom:`1px solid ${v3.line}` }}>
            <V3Kick>Weight history</V3Kick>
            <V3Kick>{all.length} entries</V3Kick>
          </div>
          {shown.map((l, i) => (
            <div key={l.id} style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 17px', borderBottom:`1px solid ${v3.line}` }}>
              <span style={{ width:46, flexShrink:0, fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.dimmer }}>{l.d}</span>
              <span style={{ fontFamily:v3.disp, fontSize:17, fontWeight:700, letterSpacing:'-0.035em' }}>
                {l.w}<span style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:600, color:v3.dim, marginLeft:2 }}>kg</span>
              </span>
              {l.delta != null && (
                <span style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, color: l.delta < 0 ? '#5F8C12' : v3.warn }}>
                  {l.delta > 0 ? '+' : ''}{l.delta}
                </span>
              )}
              {l.note && <span style={{ flex:1, minWidth:0, fontFamily:v3.sans, fontSize:10.5, fontWeight:500, color:v3.dimmer, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.note}</span>}
              <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                {confirm === l.id ? (
                  <>
                    <button onClick={() => setConfirm(null)} style={{ border:'none', borderRadius:999, background:'rgba(229,72,77,0.12)', color:v3.warn, fontFamily:v3.sans, fontSize:10, fontWeight:800, padding:'5px 10px', cursor:'pointer' }}>YES</button>
                    <button onClick={() => setConfirm(null)} style={{ border:'none', background:'transparent', color:v3.dimmer, fontFamily:v3.sans, fontSize:10, fontWeight:800, cursor:'pointer' }}>NO</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onNav && onNav('weightLog')} style={{ border:'none', background:'transparent', cursor:'pointer', color:v3.dimmer, fontSize:13, padding:0 }}>✎</button>
                    {i !== all.length - 1 && (
                      <button onClick={() => setConfirm(l.id)} style={{ border:'none', background:'transparent', cursor:'pointer', color:v3.dimmer, fontSize:13, padding:0 }}>🗑</button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => setExpanded(e => !e)} style={{
            width:'100%', padding:'14px 0', background:'transparent', border:'none', cursor:'pointer',
            fontFamily:v3.sans, fontSize:11, fontWeight:800, letterSpacing:'0.1em', color:'#5F8C12', textTransform:'uppercase',
          }}>{expanded ? 'Show less' : `Show all ${all.length} entries`}</button>
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── States: loading, offline, install prompt, error, empty shopping ──────────
window.V3States = function V3States({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('meals')} kick="System" title="States &amp; banners"/>
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:12 }}>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Offline banner</V3Kick>
          <div style={{ background:v3.warn, borderRadius:16, padding:'11px 16px', textAlign:'center', fontFamily:v3.sans, fontSize:12, fontWeight:600, color:'#fff' }}>
            No internet connection — some features may be unavailable
          </div>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Install prompt</V3Kick>
          <V3Card bg={v3.lime} r={20} pad={14}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <div style={{ width:32, height:32, borderRadius:999, background:'rgba(15,20,15,0.12)', display:'grid', placeItems:'center', fontSize:14 }}>▤</div>
              <span style={{ flex:1, fontFamily:v3.sans, fontSize:13, fontWeight:700 }}>Add to Home Screen</span>
              <V3Btn small kind="dark">Install</V3Btn>
              <span style={{ color:'rgba(15,20,15,0.5)', fontSize:17, cursor:'pointer' }}>×</span>
            </div>
          </V3Card>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Shopping list updated</V3Kick>
          <V3Card bg={v3.limeSoft} r={20} pad={14}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <div style={{ width:7, height:7, borderRadius:999, background:'#5F8C12', flexShrink:0 }}/>
              <span style={{ flex:1, fontFamily:v3.sans, fontSize:12.5, fontWeight:600, color:v3.dim }}>Shopping list updated to reflect your meal changes</span>
              <span style={{ color:v3.dimmer, fontSize:16, cursor:'pointer' }}>×</span>
            </div>
          </V3Card>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Empty shopping list</V3Kick>
          <V3Card r={24} pad={26} style={{ textAlign:'center' }}>
            <div style={{ width:48, height:48, borderRadius:999, background:v3.paper, margin:'0 auto 14px', display:'grid', placeItems:'center', fontSize:20, color:v3.dimmer }}>▢</div>
            <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>No shopping list generated</div>
            <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim, marginTop:7, lineHeight:1.55 }}>
              Your shopping list will appear here once your meal plan is set up.
            </div>
          </V3Card>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Loading</V3Kick>
          <V3Card r={24} pad={30} style={{ textAlign:'center' }}>
            <div style={{ width:44, height:44, borderRadius:999, background:v3.lime, margin:'0 auto 14px', display:'grid', placeItems:'center', fontSize:19 }}>◔</div>
            <V3Kick>Loading your plan…</V3Kick>
          </V3Card>
        </div>

        <div>
          <V3Kick style={{ marginBottom:9 }}>Error fallback</V3Kick>
          <V3Card r={24} pad={26} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:700 }}>Something went wrong</div>
            <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim, marginTop:7 }}>Please reload the page</div>
            <V3Btn small style={{ marginTop:16 }}>Reload</V3Btn>
          </V3Card>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Reset password (ResetPasswordScreen.tsx entry) ───────────────────────────
window.V3ResetPassword = function V3ResetPassword({ onNav }) {
  return (
    <V3Scaffold nav={false}>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:800 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:18, fontWeight:700, letterSpacing:'-0.03em' }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:9, fontWeight:800, color:'#5F8C12' }}>AI</span>
        </div>
        <div style={{ marginTop:60 }}>
          <V3Kick>Account</V3Kick>
          <V3H size={40} style={{ marginTop:12 }}>Set a new<br/>password</V3H>
          <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dim, marginTop:12, lineHeight:1.6 }}>
            Choose a password of at least 8 characters. You’ll be signed in straight after.
          </div>
        </div>
        <div style={{ marginTop:28, display:'flex', flexDirection:'column', gap:10 }}>
          <V3Card r={24} pad={16}>
            <V3Kick style={{ marginBottom:10 }}>New password</V3Kick>
            <div style={{ background:v3.paper, borderRadius:16, padding:'14px 16px', fontFamily:v3.sans, fontSize:15, fontWeight:700, letterSpacing:'0.2em', color:v3.dim }}>••••••••</div>
          </V3Card>
          <V3Card r={24} pad={16}>
            <V3Kick style={{ marginBottom:10 }}>Confirm password</V3Kick>
            <div style={{ background:v3.paper, borderRadius:16, padding:'14px 16px', fontFamily:v3.sans, fontSize:15, fontWeight:700, letterSpacing:'0.2em', color:v3.dim }}>••••••••</div>
          </V3Card>
          <V3Card bg={v3.limeSoft} r={20} pad={14}>
            <div style={{ display:'flex', gap:9, alignItems:'center' }}>
              <span style={{ color:'#5F8C12', fontWeight:800 }}>✓</span>
              <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim }}>Passwords match · 8+ characters</span>
            </div>
          </V3Card>
        </div>
        <div style={{ marginTop:'auto', paddingTop:40, paddingBottom:28, display:'flex', flexDirection:'column', gap:10 }}>
          <V3Btn kind="dark" full onClick={() => onNav && onNav('meals')}>Set password &amp; sign in</V3Btn>
          <V3Btn kind="ghost" full small onClick={() => onNav && onNav('auth')}>Back to sign in</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};
