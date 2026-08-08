// v3 — screens rebuilt from the real app: Recipes tab, real Learn tab, plan overview/review,
// share sheets, notification settings, weight log list, single-meal regenerate.
const { V3Scaffold, V3Title, V3TopBar, V3SectionLabel, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3Check, V3IconBtn, V3Food, V3Row } = window;

// ── Recipes · browse (BrowseRecipesTab) ──────────────────────
window.V3Recipes = function V3Recipes({ onNav }) {
  const [mealType, setMealType] = React.useState('All');
  const recipes = [
    { n:'Paneer Tikka Masala', t:'Dinner', d:'Veg', c:'North Indian', k:412, p:28, time:'35 min', likes:214, liked:true, tint:v3.peach },
    { n:'Moong Dal Chilla', t:'Breakfast', d:'Veg', c:'North Indian', k:238, p:16, time:'20 min', likes:186, liked:false, tint:v3.butter },
    { n:'Chicken Chettinad', t:'Lunch', d:'Non-veg', c:'South Indian', k:386, p:44, time:'45 min', likes:301, liked:true, tint:v3.peach },
    { n:'Greek Yogurt Bowl', t:'Snack', d:'Veg', c:'Mediterranean', k:184, p:19, time:'5 min', likes:97, liked:false, tint:v3.mint },
    { n:'Egg Bhurji', t:'Breakfast', d:'Eggs', c:'North Indian', k:262, p:21, time:'12 min', likes:143, liked:false, tint:v3.butter },
    { n:'Grilled Fish Tikka', t:'Dinner', d:'Non-veg', c:'Punjabi', k:298, p:46, time:'30 min', likes:158, liked:false, tint:v3.sky },
  ];
  return (
    <V3Scaffold tab="recipes" onNav={onNav}>
      <V3Title kick="Community · 248 recipes" title="Recipes" right={<V3IconBtn bg={v3.card}>⌕</V3IconBtn>}/>

      <div style={{ padding:'18px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, background:v3.card, borderRadius:999, padding:'13px 18px' }}>
          <span style={{ color:v3.dimmer, fontSize:15 }}>⌕</span>
          <span style={{ flex:1, fontFamily:v3.sans, fontSize:13.5, fontWeight:500, color:v3.dimmer }}>Search recipes or ingredients</span>
        </div>
      </div>

      <div style={{ padding:'14px 22px 0', display:'flex', gap:7, overflowX:'auto' }}>
        {['All','Breakfast','Lunch','Dinner','Snack'].map(f => (
          <button key={f} onClick={() => setMealType(f)} style={{
            border:'none', cursor:'pointer', borderRadius:999, padding:'9px 14px', flexShrink:0,
            background: mealType === f ? v3.ink : v3.card, color: mealType === f ? v3.lime : v3.dim,
            fontFamily:v3.sans, fontSize:11.5, fontWeight:700,
          }}>{f}</button>
        ))}
      </div>

      <div style={{ padding:'10px 22px 0', display:'flex', gap:7, flexWrap:'wrap' }}>
        {['Veg','High protein','Under 300 kcal','Quick','Sort: Popular'].map((f, i) => (
          <V3Chip key={i} bg={v3.card} size={11} pad="8px 12px" style={{ border:`1px solid ${v3.line}` }}>{f}</V3Chip>
        ))}
      </div>

      <div style={{ padding:'20px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>
        {recipes.map((r, i) => (
          <V3Card key={i} r={24} pad={14} onClick={() => onNav && onNav('meal')}>
            <div style={{ display:'flex', gap:13, alignItems:'flex-start' }}>
              <V3Food size={54} tint={r.tint} glyph={r.d === 'Veg' ? 'leaf' : 'bowl'}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, letterSpacing:'-0.015em', lineHeight:1.3 }}>{r.n}</div>
                <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.dim, marginTop:4 }}>{r.t} · {r.c} · {r.time}</div>
                <div style={{ display:'flex', gap:6, marginTop:9, flexWrap:'wrap' }}>
                  <V3Chip bg={v3.paper} size={10} pad="4px 9px">{r.k} kcal</V3Chip>
                  <V3Chip bg="rgba(111,185,59,0.14)" color="#4C8526" size={10} pad="4px 9px">P {r.p}</V3Chip>
                  <V3Chip bg={v3.paper} size={10} pad="4px 9px">{r.d}</V3Chip>
                </div>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                <div style={{ fontSize:16, color: r.liked ? v3.warn : v3.dimmer }}>{r.liked ? '♥' : '♡'}</div>
                <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:700, color:v3.dimmer, marginTop:2 }}>{r.likes}</div>
              </div>
            </div>
          </V3Card>
        ))}
      </div>
    </V3Scaffold>
  );
};

// ── Learn (real TipsTab — collapsible sections) ──────────────
const V3_TIPS = [
  { id:'meal-timing', label:'Meal timing', tint:v3.butter, tips:[
    { title:'Biggest meal at lunch', body:'Have your largest meal at lunch when metabolism peaks. Finish dinner by 8 PM for a natural 10-hour overnight fast.' },
    { title:'Eat before 8 PM', body:'Late eating raises cortisol and blunts overnight fat metabolism. Move your last meal earlier even by 30 minutes.' },
    { title:'Pre-workout fuel', body:'Eat a small protein + carb meal 1–1.5 hours before training. Rice + egg or banana + peanut butter are ideal.' },
  ]},
  { id:'hydration', label:'Hydration', tint:v3.sky, tips:[
    { title:'Water is key', body:'Drink 2.5–3.5 L daily based on body weight. Dehydration mimics hunger — a glass before each meal reduces appetite.' },
    { title:'Electrolytes matter', body:'On a deficit, kidneys excrete more sodium. A pinch of rock salt in water prevents fatigue and headaches.' },
    { title:'Green tea 2×/day', body:'Green tea lifts metabolic rate 4–5% and improves fat oxidation. Mid-morning and mid-afternoon; avoid after 5 PM.' },
  ]},
  { id:'avoid', label:'What to avoid', tint:v3.peach, tips:[
    { title:'Liquid calories', body:'Juices, sodas and sweetened coffees add 200–400 kcal without filling you up. Swap for water or black coffee.' },
    { title:'Ultra-processed snacks', body:'Engineered to override satiety signals. Keep them out of the house — you cannot moderate what is in arm’s reach.' },
    { title:'Skipping meals', body:'Skipping makes you hungrier later and lowers metabolism. If time-pressed, have a protein shake rather than nothing.' },
  ]},
  { id:'subs', label:'Smart substitutions', tint:v3.mint, tips:[
    { title:'Cauliflower rice', body:'Saves 150–200 kcal per serving with no drop in volume. Grate raw cauliflower and microwave 3 minutes.' },
    { title:'Greek yogurt for cream', body:'Same creamy texture with 5× the protein and 60% fewer calories. Works in curries, smoothies and dressings.' },
    { title:'Eggs over protein powder', body:'The most bioavailable protein at a fraction of the cost. 3 eggs = 18 g protein, healthy fats, vitamins.' },
  ]},
  { id:'portions', label:'Portion control', tint:v3.lilac, tips:[
    { title:'Plate method', body:'Half vegetables, quarter protein, quarter complex carbs. Hits macro targets without weighing every meal.' },
    { title:'Use smaller plates', body:'A 10-inch plate feels full with 30% less food than a 12-inch plate. Small change, big impact.' },
    { title:'Slow down', body:'Satiety signals take 15–20 minutes. Put the fork down between bites and aim for 20+ minutes per meal.' },
  ]},
  { id:'exercise', label:'Exercise & recovery', tint:v3.lime, tips:[
    { title:'Strength train 3–4×/week', body:'Builds muscle that burns calories at rest and prevents metabolic slowdown. Prioritise squat, press, pull.' },
    { title:'10,000 steps daily', body:'NEAT accounts for 15–30% of daily burn. Walking and stairs add up to 300–500 extra kcal a day.' },
    { title:'Morning walk fasted', body:'A 20–30 minute brisk walk before breakfast taps fat stores. 3× per week, no gym required.' },
  ]},
  { id:'sleep', label:'Sleep & stress', tint:v3.lilac, tips:[
    { title:'7–8 hours sleep', body:'Deprivation raises ghrelin 24% and reduces leptin. Poor sleep undermines your diet however strict you are.' },
    { title:'Manage stress', body:'Chronic stress raises cortisol which drives belly fat storage. Ten minutes of breathing daily makes a difference.' },
    { title:'Consistent schedule', body:'Same bed and wake times, weekends included. Irregular sleep disrupts cortisol and insulin rhythm.' },
  ]},
  { id:'tracking', label:'Tracking & progress', tint:v3.butter, tips:[
    { title:'Weigh once a week', body:'Monday morning, after the bathroom, before eating. Daily swings are water — follow the weekly trend.' },
    { title:'Take progress photos', body:'The scale misses body composition. Front, side and back every two weeks in the same lighting.' },
    { title:'Log meals immediately', body:'Mark meals eaten right after finishing. Immediate logging is more accurate than end-of-day memory.' },
  ]},
];

window.V3Learn = function V3Learn({ onNav }) {
  const [open, setOpen] = React.useState({ 'meal-timing': true });
  return (
    <V3Scaffold tab="tips" onNav={onNav}>
      <V3Title kick="Science-backed" title="Learn"/>

      {/* goal context card */}
      <div style={{ padding:'20px 22px 0' }}>
        <V3Card bg={v3.lime} r={28} pad={18}>
          <V3Kick color={v3.panelDim}>Your goal</V3Kick>
          <div style={{ display:'flex', alignItems:'center', gap:18, marginTop:12 }}>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:34, fontWeight:700, letterSpacing:'-0.045em', lineHeight:1, color:'rgba(15,20,15,0.55)' }}>
                69.8<span style={{ fontSize:14 }}>kg</span>
              </div>
              <V3Kick color={v3.panelDim} style={{ marginTop:5 }}>Current</V3Kick>
            </div>
            <span style={{ fontSize:18, color:v3.ink }}>→</span>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:34, fontWeight:700, letterSpacing:'-0.045em', lineHeight:1 }}>
                68.0<span style={{ fontSize:14 }}>kg</span>
              </div>
              <V3Kick color={v3.panelDim} style={{ marginTop:5 }}>Target</V3Kick>
            </div>
          </div>
          <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid rgba(15,20,15,0.14)', fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:'rgba(15,20,15,0.62)' }}>
            1.8 kg to lose · 1,320 kcal/day
          </div>
        </V3Card>
      </div>

      {/* meal prep guide entry */}
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={16} onClick={() => onNav && onNav('mealPrep')}>
          <div style={{ display:'flex', alignItems:'center', gap:13 }}>
            <div style={{ width:42, height:42, borderRadius:999, background:v3.mint, display:'grid', placeItems:'center', fontSize:17 }}>◔</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>Weekly meal prep guide</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:v3.dim, marginTop:3 }}>90 minutes · 6 tasks this week</div>
            </div>
            <span style={{ color:v3.dimmer, fontWeight:700 }}>→</span>
          </div>
        </V3Card>
      </div>

      {/* collapsible tip sections */}
      <div style={{ padding:'20px 0 0' }}>
        <V3SectionLabel>Eight topics · 24 tips</V3SectionLabel>
        <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', gap:9 }}>
          {V3_TIPS.map(sec => {
            const on = !!open[sec.id];
            return (
              <V3Card key={sec.id} r={24} pad={0} style={{ overflow:'hidden' }}>
                <button onClick={() => setOpen(p => ({ ...p, [sec.id]: !p[sec.id] }))} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:11, padding:'15px 17px',
                  background: on ? sec.tint : 'transparent', border:'none', cursor:'pointer', textAlign:'left',
                  transition:'background 200ms ease-out',
                }}>
                  <div style={{ width:8, height:8, borderRadius:999, background: on ? v3.ink : sec.tint, flexShrink:0 }}/>
                  <span style={{ flex:1, fontFamily:v3.sans, fontSize:13, fontWeight:700, letterSpacing:'-0.01em', color:v3.text }}>{sec.label}</span>
                  <span style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color: on ? 'rgba(15,20,15,0.5)' : v3.dimmer }}>{sec.tips.length}</span>
                  <span style={{ color: on ? v3.ink : v3.dimmer, fontSize:12, fontWeight:700, transform: on ? 'rotate(90deg)' : 'none', transition:'transform 200ms' }}>›</span>
                </button>
                {on && (
                  <div style={{ padding:'4px 17px 15px', display:'flex', flexDirection:'column', gap:8 }}>
                    {sec.tips.map((t, i) => (
                      <div key={i} style={{ background:v3.paper, borderRadius:16, padding:'13px 15px' }}>
                        <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:700 }}>{t.title}</div>
                        <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim, marginTop:5, lineHeight:1.55 }}>{t.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </V3Card>
            );
          })}
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Plan overview (post-generation summary) ──────────────────
window.V3PlanOverview = function V3PlanOverview({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('ob7')} kick="Your plan is ready" title="14-day plan"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg={v3.lime} r={30} pad={20}>
          <V3Kick color={v3.panelDim}>Daily targets</V3Kick>
          <div style={{ fontFamily:v3.disp, fontSize:46, fontWeight:700, letterSpacing:'-0.05em', marginTop:8, lineHeight:1 }}>
            1,320<span style={{ fontFamily:v3.sans, fontSize:14, fontWeight:600, marginLeft:6 }}>kcal</span>
          </div>
          <div style={{ display:'flex', gap:7, marginTop:16, flexWrap:'wrap' }}>
            {['P 165 g','C 60 g','F 45 g','Fibre 25 g'].map((c, i) => <V3Chip key={i} bg="rgba(15,20,15,0.10)" size={11}>{c}</V3Chip>)}
          </div>
        </V3Card>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:12 }}>
          {[{ v:'14', l:'Days', bg:v3.mint }, { v:'56', l:'Meals', bg:v3.butter }, { v:'2,180', l:'TDEE', bg:v3.peach }].map((s, i) => (
            <V3Card key={i} bg={s.bg} r={20} pad={14}>
              <div style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.04em' }}>{s.v}</div>
              <div style={{ fontFamily:v3.sans, fontSize:10, fontWeight:600, color:v3.panelDim, marginTop:4 }}>{s.l}</div>
            </V3Card>
          ))}
        </div>

        <V3Card r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick style={{ marginBottom:4 }}>Built around</V3Kick>
          <V3Row label="Diet" value="Non-veg · eggs"/>
          <V3Row label="Cuisines" value="South Indian, Punjabi"/>
          <V3Row label="Meals per day" value="4"/>
          <V3Row label="Eating window" value="16:8 fasting"/>
          <V3Row label="Avoiding" value="Brinjal, mushroom"/>
          <V3Row label="Equipment" value="Stovetop, blender" last/>
        </V3Card>

        <V3Card bg={v3.cream} r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick color={v3.panelDim}>Goal projection</V3Kick>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginTop:10 }}>
            <div style={{ fontFamily:v3.disp, fontSize:30, fontWeight:700, letterSpacing:'-0.04em' }}>
              03 Jun<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginLeft:6 }}>2026</span>
            </div>
            <V3Chip bg={v3.card} size={11}>42 days</V3Chip>
          </div>
        </V3Card>

        <V3Btn kind="dark" full style={{ marginTop:20 }} onClick={() => onNav && onNav('planReview')}>Review the meals</V3Btn>
        <V3Btn kind="ghost" full small style={{ marginTop:9 }} onClick={() => onNav && onNav('meals')}>Skip to my plan</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Plan review (day accordion) ──────────────────────────────
window.V3PlanReview = function V3PlanReview({ onNav }) {
  const [openDay, setOpenDay] = React.useState(0);
  const days = [
    { l:'Day 1 · Mon', k:1318, meals:[
      { t:'Breakfast', n:'Masala egg white scramble', k:280 }, { t:'Lunch', n:'Tandoori chicken + raita', k:360 },
      { t:'Snack', n:'Roasted chana + buttermilk', k:130 }, { t:'Dinner', n:'Grilled fish + spinach', k:310 },
    ]},
    { l:'Day 2 · Tue', k:1324, meals:[
      { t:'Breakfast', n:'Moong dal chilla + curd', k:295 }, { t:'Lunch', n:'Chicken chettinad + salad', k:372 },
      { t:'Snack', n:'Makhana + green tea', k:120 }, { t:'Dinner', n:'Paneer bhurji + 2 roti', k:320 },
    ]},
    { l:'Day 3 · Wed', k:1315, meals:[
      { t:'Breakfast', n:'Oats with berries', k:268 }, { t:'Lunch', n:'Rajma + brown rice', k:388 },
      { t:'Snack', n:'Greek yogurt bowl', k:184 }, { t:'Dinner', n:'Grilled fish tikka', k:298 },
    ]},
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('planOverview')} kick="14 days · 56 meals" title="Review your plan"
        right={<V3Chip bg={v3.limeSoft} size={11}>±3% accurate</V3Chip>}/>
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:9 }}>
        {days.map((d, i) => {
          const on = openDay === i;
          return (
            <V3Card key={i} r={24} pad={0} style={{ overflow:'hidden' }}>
              <button onClick={() => setOpenDay(on ? -1 : i)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:12, padding:'15px 17px',
                background: on ? v3.lime : 'transparent', border:'none', cursor:'pointer', textAlign:'left',
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{d.l}</div>
                  <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color: on ? 'rgba(15,20,15,0.6)' : v3.dim, marginTop:3 }}>4 meals · {d.k} kcal</div>
                </div>
                <span style={{ color: on ? v3.ink : v3.dimmer, fontSize:12, fontWeight:700, transform: on ? 'rotate(90deg)' : 'none', transition:'transform 200ms' }}>›</span>
              </button>
              {on && (
                <div style={{ padding:'6px 17px 15px' }}>
                  {d.meals.map((m, j) => (
                    <div key={j} style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 0', borderBottom: j === d.meals.length - 1 ? 'none' : `1px solid ${v3.line}` }}>
                      <V3Chip bg={v3.paper} size={9} pad="3px 8px">{m.t}</V3Chip>
                      <span style={{ flex:1, fontFamily:v3.sans, fontSize:13, fontWeight:600 }}>{m.n}</span>
                      <span style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dim }}>{m.k}</span>
                    </div>
                  ))}
                </div>
              )}
            </V3Card>
          );
        })}
        <V3Chip bg={v3.card} size={11.5} pad="12px 16px" style={{ justifyContent:'center', border:`1px dashed ${v3.lineStrong}`, color:v3.dim }}>+ 11 more days</V3Chip>
        <V3Btn kind="dark" full style={{ marginTop:8 }} onClick={() => onNav && onNav('meals')}>Start this plan</V3Btn>
        <V3Btn kind="ghost" full small onClick={() => onNav && onNav('regenConfirm')}>Regenerate instead</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Single meal regenerate ───────────────────────────────────
window.V3MealRegen = function V3MealRegen({ onNav }) {
  const [note, setNote] = React.useState('Something lighter');
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('meal')} kick="Dinner · Wed 22 Apr" title="Regenerate this meal"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={26} pad={16}>
          <div style={{ display:'flex', gap:13, alignItems:'center' }}>
            <V3Food size={48} tint={v3.mint}/>
            <div style={{ flex:1 }}>
              <V3Kick>Currently planned</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700, marginTop:5 }}>Grilled Fish + Sautéed Spinach</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:v3.dim, marginTop:5 }}>310 kcal · P46 C12 F8</div>
            </div>
          </div>
        </V3Card>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>What should change?</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Something lighter','More protein','Different cuisine','Quicker to cook','Use what I have'].map(o => (
              <button key={o} onClick={() => setNote(o)} style={{
                border:'none', cursor:'pointer', borderRadius:999, padding:'11px 15px',
                background: note === o ? v3.lime : v3.card, color:v3.text, fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
              }}>{o}</button>
            ))}
          </div>
        </div>

        <V3Card r={26} pad={18} style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>Add a note (optional)</V3Kick>
          <div style={{ background:v3.paper, borderRadius:18, padding:'14px 16px', fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.55 }}>
            “Keep it under 20 minutes, no deep frying.”
          </div>
        </V3Card>

        <V3Card bg={v3.cream} r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick color={v3.panelDim}>The new meal will hold</V3Kick>
          <div style={{ marginTop:10 }}>
            <V3Row label="Calories within" value="±40 kcal"/>
            <V3Row label="Protein floor" value="42 g"/>
            <V3Row label="Shopping list" value="Regenerated after" last/>
          </div>
        </V3Card>

        <V3Btn full style={{ marginTop:20 }} onClick={() => onNav && onNav('replaceAI')}>Regenerate meal</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Share sheet (meal / shopping) ────────────────────────────
window.V3ShareSheet = function V3ShareSheet({ onNav }) {
  const [lang, setLang] = React.useState('English');
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('meal')} kick="Share · recipe" title="Send to your cook"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg={v3.lime} r={30} pad={20}>
          <V3Kick color={v3.panelDim}>Sharing</V3Kick>
          <V3H size={24} style={{ marginTop:10 }}>Tandoori Chicken Breast + Cucumber Raita</V3H>
          <div style={{ display:'flex', gap:7, marginTop:14, flexWrap:'wrap' }}>
            {['8 ingredients','4 steps','Serves 4','35 min'].map((c, i) => <V3Chip key={i} bg="rgba(15,20,15,0.10)" size={10.5}>{c}</V3Chip>)}
          </div>
        </V3Card>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>Recipe language</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['English','हिन्दी','ಕನ್ನಡ','தமிழ்','తెలుగు'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                border:'none', cursor:'pointer', borderRadius:999, padding:'11px 15px',
                background: lang === l ? v3.ink : v3.card, color: lang === l ? v3.lime : v3.dim,
                fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
              }}>{l}</button>
            ))}
          </div>
        </div>

        <V3Card r={26} pad={18} style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:4 }}>Include</V3Kick>
          <V3Row label="Ingredient quantities" value="Yes" color={v3.limeDeep}/>
          <V3Row label="Step-by-step method" value="Yes" color={v3.limeDeep}/>
          <V3Row label="Audio guide link" value="Yes" color={v3.limeDeep}/>
          <V3Row label="Macros" value="Hidden" last/>
        </V3Card>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:20 }}>
          <V3Btn full>Share on WhatsApp</V3Btn>
          <V3Btn kind="light" full>Copy link</V3Btn>
          <V3Btn kind="ghost" full small>Download as image</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Weight log list ──────────────────────────────────────────
window.V3WeightList = function V3WeightList({ onNav }) {
  const logs = [
    { d:'22 Apr', w:69.8, delta:-0.3, note:'Morning, fasted' },
    { d:'18 Apr', w:70.1, delta:-0.2, note:'' },
    { d:'14 Apr', w:70.3, delta:-0.5, note:'After travel week' },
    { d:'10 Apr', w:70.8, delta:-0.4, note:'' },
    { d:'06 Apr', w:71.2, delta:+0.1, note:'Post-wedding' },
    { d:'02 Apr', w:71.1, delta:-0.5, note:'' },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="12 entries · 94 days" title="Weight history"
        right={<V3IconBtn bg={v3.lime} onClick={() => onNav && onNav('weightLog')}>+</V3IconBtn>}/>
      <div style={{ padding:'22px 22px 0', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[{ v:'−2.4', u:'kg', l:'Total', bg:v3.lime }, { v:'−0.42', u:'kg/wk', l:'Trend', bg:v3.mint }, { v:'1.8', u:'kg', l:'To goal', bg:v3.peach }].map((s, i) => (
          <V3Card key={i} bg={s.bg} r={20} pad={14}>
            <div style={{ fontFamily:v3.disp, fontSize:22, fontWeight:700, letterSpacing:'-0.04em' }}>{s.v}</div>
            <div style={{ fontFamily:v3.sans, fontSize:9.5, fontWeight:600, color:v3.panelDim, marginTop:4 }}>{s.u} · {s.l}</div>
          </V3Card>
        ))}
      </div>
      <div style={{ padding:'12px 22px 0' }}>
        <V3Card r={26} pad={16}>
          {logs.map((l, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 0', borderBottom: i === logs.length - 1 ? 'none' : `1px solid ${v3.line}` }}>
              <div style={{ width:52, flexShrink:0 }}>
                <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dim }}>{l.d}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:v3.disp, fontSize:19, fontWeight:700, letterSpacing:'-0.035em' }}>
                  {l.w}<span style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.dim, marginLeft:3 }}>kg</span>
                </div>
                {l.note && <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:500, color:v3.dimmer, marginTop:2 }}>{l.note}</div>}
              </div>
              <V3Chip bg={l.delta < 0 ? v3.limeSoft : 'rgba(229,72,77,0.10)'} color={l.delta < 0 ? '#5F8C12' : v3.warn} size={10.5}>
                {l.delta > 0 ? '+' : ''}{l.delta}
              </V3Chip>
            </div>
          ))}
        </V3Card>
      </div>
    </V3Scaffold>
  );
};

// ── Notification settings ────────────────────────────────────
window.V3Notifications = function V3Notifications({ onNav }) {
  const [on, setOn] = React.useState({ meals:true, water:true, weight:false, prep:true, digest:false });
  const Toggle = ({ k }) => (
    <div onClick={() => setOn(s => ({ ...s, [k]: !s[k] }))} style={{
      width:46, height:27, borderRadius:999, flexShrink:0, cursor:'pointer', padding:3,
      background: on[k] ? v3.lime : 'rgba(15,20,15,0.13)', transition:'background 200ms ease-out',
      display:'flex', justifyContent: on[k] ? 'flex-end' : 'flex-start',
    }}>
      <div style={{ width:21, height:21, borderRadius:999, background:v3.card, boxShadow:'0 2px 5px rgba(15,20,15,0.2)' }}/>
    </div>
  );
  const Item = ({ k, title, sub, last }) => (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 0', borderBottom: last ? 'none' : `1px solid ${v3.line}` }}>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{title}</div>
        <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:500, color:v3.dim, marginTop:3, lineHeight:1.45 }}>{sub}</div>
      </div>
      <Toggle k={k}/>
    </div>
  );
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Settings" title="Notifications"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:6 }}>Daily</V3Kick>
          <Item k="meals" title="Meal reminders" sub="At each planned meal time — 07:30, 13:00, 17:00, 20:00"/>
          <Item k="water" title="Hydration nudges" sub="Every 2 hours until your goal is hit"/>
          <Item k="weight" title="Weigh-in reminder" sub="Monday mornings at 07:00" last/>
        </V3Card>

        <V3Card r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick style={{ marginBottom:6 }}>Weekly</V3Kick>
          <Item k="prep" title="Meal prep Sunday" sub="Saturday evening, with your batch list"/>
          <Item k="digest" title="Progress digest" sub="Sunday night summary of adherence and weight" last/>
        </V3Card>

        <V3Card bg={v3.cream} r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick color={v3.panelDim}>Quiet hours</V3Kick>
          <div style={{ marginTop:10 }}>
            <V3Row label="No notifications between" value="22:00 – 06:30" chevron last/>
          </div>
        </V3Card>

        <V3Btn kind="dark" full style={{ marginTop:20 }} onClick={() => onNav && onNav('profile')}>Save</V3Btn>
      </div>
    </V3Scaffold>
  );
};
