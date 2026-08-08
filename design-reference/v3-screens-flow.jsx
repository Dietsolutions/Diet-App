// v3 — flows: meal swap, add meal, weight log, customise, meal prep, regenerate
const { V3Scaffold, V3TopBar, V3Kick, V3H, V3Card, V3Chip, V3Btn, V3Bar, V3Ring, V3Check, V3IconBtn, V3Food, V3Row } = window;

// ── Swap · sheet ─────────────────────────────────────────────
window.V3ReplaceSheet = function V3ReplaceSheet({ onNav }) {
  const [why, setWhy] = React.useState('Not in the mood');
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('meal')} kick="Meal swap · lunch" title="Swap this meal"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={26} pad={16}>
          <div style={{ display:'flex', gap:13, alignItems:'center' }}>
            <V3Food size={50} tint={v3.peach}/>
            <div style={{ flex:1 }}>
              <V3Kick>Currently planned</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:14, fontWeight:700, marginTop:5, lineHeight:1.3 }}>Tandoori Chicken Breast + Cucumber Raita</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:v3.dim, marginTop:6 }}>360 kcal · P55 C12 F10</div>
            </div>
          </div>
        </V3Card>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>Why are you swapping?</V3Kick>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {['Not in the mood','Missing ingredients','Eating out','Too heavy','Takes too long'].map(o => (
              <button key={o} onClick={() => setWhy(o)} style={{
                border:'none', cursor:'pointer', borderRadius:999, padding:'11px 15px',
                background: why === o ? v3.lime : v3.card, color:v3.text, fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
              }}>{o}</button>
            ))}
          </div>
        </div>

        <V3Card bg={v3.cream} r={26} pad={18} style={{ marginTop:20 }}>
          <V3Kick color={v3.panelDim}>The swap will keep</V3Kick>
          <div style={{ marginTop:10 }}>
            <V3Row label="Calories within" value="±40 kcal"/>
            <V3Row label="Protein floor" value="50 g"/>
            <V3Row label="Your diet rules" value="Non-veg · no brinjal" last/>
          </div>
        </V3Card>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:22 }}>
          <V3Btn full onClick={() => onNav && onNav('replaceAI')}>Find an AI replacement</V3Btn>
          <V3Btn kind="light" full onClick={() => onNav && onNav('replaceSearch')}>Search a food myself</V3Btn>
          <V3Btn kind="ghost" full small onClick={() => onNav && onNav('meal')}>Keep the planned meal</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Swap · search ────────────────────────────────────────────
window.V3ReplaceSearch = function V3ReplaceSearch({ onNav }) {
  const results = [
    { n:'Paneer tikka + salad', k:340, p:28, tint:v3.butter }, { n:'Rajma + 1 roti', k:365, p:22, tint:v3.peach },
    { n:'Egg bhurji + 2 roti', k:352, p:31, tint:v3.mint }, { n:'Grilled fish + veg', k:330, p:48, tint:v3.sky },
    { n:'Chicken salad bowl', k:345, p:44, tint:v3.lilac },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('replaceSheet')} kick="Swap · search" title="Find a food"/>
      <div style={{ padding:'22px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, background:v3.card, borderRadius:999, padding:'14px 18px' }}>
          <span style={{ color:v3.dimmer, fontSize:15 }}>⌕</span>
          <span style={{ flex:1, fontFamily:v3.sans, fontSize:14, fontWeight:600 }}>chicken</span>
          <V3Chip bg={v3.paper} size={10}>Clear</V3Chip>
        </div>
        <div style={{ display:'flex', gap:7, marginTop:14, flexWrap:'wrap' }}>
          {['Similar macros','High protein','Under 400 kcal','Quick'].map((f, i) => (
            <V3Chip key={i} bg={i === 0 ? v3.ink : v3.card} color={i === 0 ? v3.lime : v3.dim} size={11.5} pad="9px 13px">{f}</V3Chip>
          ))}
        </div>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>Matches · 5</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {results.map((r, i) => (
              <V3Card key={i} r={22} pad={14} onClick={() => onNav && onNav('replaceQty')}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <V3Food size={42} tint={r.tint}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{r.n}</div>
                    <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.dim, marginTop:4 }}>{r.k} kcal · {r.p} g protein</div>
                  </div>
                  <V3IconBtn bg={v3.paper} size={34}>+</V3IconBtn>
                </div>
              </V3Card>
            ))}
          </div>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Swap · quantity ──────────────────────────────────────────
window.V3ReplaceQty = function V3ReplaceQty({ onNav }) {
  const [qty, setQty] = React.useState(1.5);
  const per = { k:230, p:29, c:8, f:7 };
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('replaceSearch')} kick="Swap · portion" title="Chicken salad bowl"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={30} pad={20}>
          <V3Kick>Portion size</V3Kick>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14 }}>
            <V3IconBtn bg={v3.paper} size={46} onClick={() => setQty(q => Math.max(0.5, +(q - 0.5).toFixed(1)))}>−</V3IconBtn>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:v3.disp, fontSize:48, fontWeight:700, letterSpacing:'-0.05em', lineHeight:1 }}>{qty}</div>
              <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, color:v3.dimmer, marginTop:5 }}>BOWLS · 150 g each</div>
            </div>
            <V3IconBtn bg={v3.lime} size={46} onClick={() => setQty(q => +(q + 0.5).toFixed(1))}>+</V3IconBtn>
          </div>
        </V3Card>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginTop:12 }}>
          {[
            { v:Math.round(per.k*qty), l:'kcal', bg:v3.lime }, { v:`${Math.round(per.p*qty)} g`, l:'Protein', bg:v3.mint },
            { v:`${Math.round(per.c*qty)} g`, l:'Carbs', bg:v3.butter }, { v:`${Math.round(per.f*qty)} g`, l:'Fat', bg:v3.peach },
          ].map((m, i) => (
            <V3Card key={i} bg={m.bg} r={20} pad={14}>
              <div style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.04em' }}>{m.v}</div>
              <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:'rgba(15,20,15,0.55)', marginTop:5 }}>{m.l}</div>
            </V3Card>
          ))}
        </div>

        <V3Card bg={v3.cream} r={24} pad={16} style={{ marginTop:12 }}>
          <V3Kick color={v3.panelDim}>Effect on today</V3Kick>
          <div style={{ marginTop:10 }}>
            <V3Row label="Calories" value={`970 → ${970 - 360 + Math.round(per.k*qty)}`} color={v3.limeDeep}/>
            <V3Row label="Protein" value={`143 → ${143 - 55 + Math.round(per.p*qty)} g`}/>
            <V3Row label="Still under target by" value="205 kcal" last/>
          </div>
        </V3Card>

        <V3Btn full style={{ marginTop:20 }} onClick={() => onNav && onNav('replaceResult')}>Swap this in</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Swap · AI thinking ───────────────────────────────────────
window.V3ReplaceAI = function V3ReplaceAI({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.ink} dark>
      <V3TopBar dark onBack={() => onNav && onNav('replaceSheet')} kick="AI meal swap" title="Finding a better fit"/>
      <div style={{ padding:'40px 22px 0', display:'grid', placeItems:'center' }}>
        <V3Ring pct={0.42} size={168} thick={15} color={v3.lime} track="rgba(246,247,243,0.10)" dashRemainder>
          <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:700, color:v3.onDarkDim, lineHeight:1.5 }}>Scanning<br/>1,240 meals</div>
        </V3Ring>
      </div>
      <div style={{ padding:'34px 22px 0', display:'flex', flexDirection:'column', gap:9 }}>
        {[
          { t:'Matching your macro gap', done:true }, { t:'Filtering your diet rules', done:true },
          { t:'Checking ingredients you have', now:true }, { t:'Ranking by taste history' },
        ].map((l, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background: l.now ? 'rgba(198,242,78,0.10)' : 'transparent', borderRadius:16, padding:'11px 13px' }}>
            <div style={{ width:22, height:22, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center', background: l.done ? v3.lime : 'transparent', border: l.done ? 'none' : `1.5px solid ${l.now ? v3.lime : v3.lineDark}`, color:v3.ink, fontSize:11, fontWeight:800 }}>{l.done ? '✓' : ''}</div>
            <span style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color: l.done ? v3.onDarkDim : l.now ? v3.lime : v3.onDarkDimmer }}>{l.t}</span>
          </div>
        ))}
      </div>
      <div style={{ padding:'30px 22px 0' }}>
        <V3Btn full onClick={() => onNav && onNav('replaceResult')}>See the suggestion</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Swap · result ────────────────────────────────────────────
window.V3ReplaceResult = function V3ReplaceResult({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('replaceAI')} kick="AI meal swap" title="Here’s the swap"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card r={24} pad={16} style={{ opacity:0.6 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <V3Food size={40} tint={v3.peach}/>
            <div style={{ flex:1 }}>
              <V3Kick>Out</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:700, marginTop:4, textDecoration:'line-through' }}>Tandoori Chicken + Raita</div>
            </div>
            <span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:700, color:v3.dim }}>360 kcal</span>
          </div>
        </V3Card>

        <div style={{ textAlign:'center', padding:'10px 0', fontSize:18, color:v3.dimmer }}>↓</div>

        <V3Card bg={v3.lime} r={30} pad={20}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <V3Chip bg="rgba(15,20,15,0.12)" size={10.5}>In · better fit</V3Chip>
            <V3Chip bg={v3.ink} color={v3.lime} size={10.5}>+3 g protein</V3Chip>
          </div>
          <V3H size={26} style={{ marginTop:16 }}>Grilled fish + sautéed spinach</V3H>
          <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:'rgba(15,20,15,0.65)', marginTop:8, lineHeight:1.55 }}>
            Lighter on fat, closer to your protein floor, and uses the fish already on this week’s list.
          </div>
          <div style={{ display:'flex', gap:7, marginTop:14, flexWrap:'wrap' }}>
            {['330 kcal','P 58','C 10','F 7','25 min'].map((c, i) => <V3Chip key={i} bg="rgba(15,20,15,0.10)" size={10.5}>{c}</V3Chip>)}
          </div>
        </V3Card>

        <V3Card r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick style={{ marginBottom:4 }}>Today after the swap</V3Kick>
          <V3Row label="Calories" value="940 / 1,320"/>
          <V3Row label="Protein" value="146 / 165 g" color={v3.protein}/>
          <V3Row label="Shopping list" value="No change needed" last/>
        </V3Card>

        <div style={{ display:'flex', gap:9, marginTop:20 }}>
          <V3Btn full onClick={() => onNav && onNav('meals')}>Confirm swap</V3Btn>
          <V3Btn kind="light" onClick={() => onNav && onNav('replaceAI')}>Try another</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Add meal (off-plan log) ──────────────────────────────────
window.V3AddMeal = function V3AddMeal({ onNav }) {
  const picked = [
    { n:'Butter chicken', q:'1 katori', k:295, tint:v3.peach },
    { n:'Roti', q:'2', k:220, tint:v3.butter },
    { n:'Raita', q:'small bowl', k:80, tint:v3.sky },
  ];
  const total = picked.reduce((a, p) => a + p.k, 0);
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('meals')} kick="Off-plan · today" title="Log what you ate"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg={v3.ink} r={26} pad={18}>
          <V3Kick color={v3.onDarkDimmer}>Describe it in your words</V3Kick>
          <div style={{ fontFamily:v3.sans, fontSize:15, fontWeight:600, color:v3.onDark, marginTop:10, lineHeight:1.5 }}>
            “2 rotis with butter chicken and a small raita”
          </div>
          <div style={{ display:'flex', gap:9, marginTop:16 }}>
            <V3Btn small full onClick={() => onNav && onNav('addMeal')}>Estimate macros</V3Btn>
            <V3Btn small kind="onDark">🎤</V3Btn>
          </div>
        </V3Card>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>Detected items · 3</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {picked.map((p, i) => (
              <V3Card key={i} r={22} pad={14}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <V3Food size={40} tint={p.tint}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>{p.n}</div>
                    <div style={{ fontFamily:v3.sans, fontSize:11, fontWeight:600, color:v3.dim, marginTop:3 }}>{p.q} · {p.k} kcal</div>
                  </div>
                  <div style={{ display:'flex', gap:7 }}>
                    <V3IconBtn bg={v3.paper} size={32}>−</V3IconBtn>
                    <V3IconBtn bg={v3.paper} size={32}>+</V3IconBtn>
                  </div>
                </div>
              </V3Card>
            ))}
          </div>
        </div>

        <V3Card bg={v3.limeSoft} r={26} pad={18} style={{ marginTop:12 }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
            <div>
              <V3Kick color="rgba(15,20,15,0.5)">Estimated total</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:36, fontWeight:700, letterSpacing:'-0.045em', marginTop:6 }}>{total}<span style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, marginLeft:5 }}>kcal</span></div>
            </div>
            <div style={{ textAlign:'right', fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dim, lineHeight:1.7 }}>
              P 38 g<br/>C 52 g<br/>F 21 g
            </div>
          </div>
          <div style={{ marginTop:14 }}><V3Bar pct={(970+total)/1320} h={9} color={v3.fat}/></div>
          <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:600, color:v3.dim, marginTop:9 }}>
            Puts you at 1,565 of 1,320 kcal — 245 over. Tomorrow’s plan will adjust.
          </div>
        </V3Card>

        <V3Btn full style={{ marginTop:20 }} onClick={() => onNav && onNav('meals')}>Add to today</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Weight log ───────────────────────────────────────────────
window.V3WeightLog = function V3WeightLog({ onNav }) {
  const [w, setW] = React.useState(69.8);
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Wednesday, 22 April" title="Log weight"/>
      <div style={{ padding:'26px 22px 0' }}>
        <V3Card r={32} pad={22}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <V3IconBtn bg={v3.paper} size={50} onClick={() => setW(x => +(x - 0.1).toFixed(1))}>−</V3IconBtn>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:v3.disp, fontSize:62, fontWeight:700, letterSpacing:'-0.05em', lineHeight:1 }}>{w.toFixed(1)}</div>
              <div style={{ fontFamily:v3.sans, fontSize:11.5, fontWeight:700, color:v3.dimmer, marginTop:6 }}>KILOGRAMS</div>
            </div>
            <V3IconBtn bg={v3.lime} size={50} onClick={() => setW(x => +(x + 0.1).toFixed(1))}>+</V3IconBtn>
          </div>
          <div style={{ display:'flex', gap:7, marginTop:18, justifyContent:'center' }}>
            {[-1,-0.5,+0.5,+1].map(d => (
              <V3Chip key={d} bg={v3.paper} size={11.5} pad="9px 13px" style={{ cursor:'pointer' }}>{d > 0 ? `+${d}` : d}</V3Chip>
            ))}
          </div>
        </V3Card>

        <V3Card r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick style={{ marginBottom:4 }}>Context</V3Kick>
          <V3Row label="Last entry" value="70.1 kg · 4 days ago"/>
          <V3Row label="Change" value="−0.3 kg" color={v3.limeDeep}/>
          <V3Row label="7-day trend" value="−0.42 kg / week" color={v3.limeDeep}/>
          <V3Row label="Goal" value="68.0 kg" last/>
        </V3Card>

        <V3Card r={26} pad={18} style={{ marginTop:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <V3Kick>Body fat</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginTop:5 }}>Optional</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <V3IconBtn bg={v3.paper} size={36}>−</V3IconBtn>
              <span style={{ fontFamily:v3.disp, fontSize:24, fontWeight:700, letterSpacing:'-0.04em' }}>18.2<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim }}>%</span></span>
              <V3IconBtn bg={v3.paper} size={36}>+</V3IconBtn>
            </div>
          </div>
        </V3Card>

        <V3Btn full style={{ marginTop:20 }} onClick={() => onNav && onNav('profile')}>Save entry</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Customise plan ───────────────────────────────────────────
window.V3Customise = function V3Customise({ onNav }) {
  const [meals, setMeals] = React.useState(4);
  const [kcal, setKcal] = React.useState(1320);
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.cream}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Plan settings" title="Customise plan"/>
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap:10 }}>
        <V3Card r={26} pad={18}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <V3Kick>Daily calories</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:34, fontWeight:700, letterSpacing:'-0.045em', marginTop:7 }}>{kcal.toLocaleString()}<span style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginLeft:5 }}>kcal</span></div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <V3IconBtn bg={v3.paper} size={40} onClick={() => setKcal(k => k - 50)}>−</V3IconBtn>
              <V3IconBtn bg={v3.lime} size={40} onClick={() => setKcal(k => k + 50)}>+</V3IconBtn>
            </div>
          </div>
          <div style={{ marginTop:16 }}><V3Bar pct={(kcal-1000)/1500} h={9}/></div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:v3.sans, fontSize:10.5, fontWeight:600, color:v3.dimmer }}>
            <span>1,000</span><span>Maintenance 2,180</span><span>2,500</span>
          </div>
        </V3Card>

        <V3Card r={26} pad={18}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <V3Kick>Meals per day</V3Kick>
              <div style={{ fontFamily:v3.sans, fontSize:12, fontWeight:600, color:v3.dim, marginTop:5 }}>Includes snacks</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <V3IconBtn bg={v3.paper} size={38} onClick={() => setMeals(m => Math.max(2, m - 1))}>−</V3IconBtn>
              <span style={{ fontFamily:v3.disp, fontSize:28, fontWeight:700, letterSpacing:'-0.04em', minWidth:26, textAlign:'center' }}>{meals}</span>
              <V3IconBtn bg={v3.lime} size={38} onClick={() => setMeals(m => Math.min(6, m + 1))}>+</V3IconBtn>
            </div>
          </div>
        </V3Card>

        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:14 }}>Macro split</V3Kick>
          <div style={{ display:'flex', height:14, borderRadius:999, overflow:'hidden' }}>
            <div style={{ width:'50%', background:v3.protein }}/><div style={{ width:'20%', background:v3.carbs }}/><div style={{ width:'30%', background:v3.fat }}/>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
            <V3Chip bg="rgba(111,185,59,0.16)" size={11}>Protein 50% · 165 g</V3Chip>
            <V3Chip bg="rgba(242,185,59,0.18)" size={11}>Carbs 20% · 60 g</V3Chip>
            <V3Chip bg="rgba(255,138,107,0.18)" size={11}>Fat 30% · 45 g</V3Chip>
          </div>
        </V3Card>

        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:14 }}>Custom instructions</V3Kick>
          <div style={{ background:v3.paper, borderRadius:18, padding:'14px 16px', fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.dim, lineHeight:1.6 }}>
            “Make dinners lighter. A soup every day. No brinjal. Keep lunches portable.”
          </div>
          <div style={{ display:'flex', gap:7, marginTop:12, flexWrap:'wrap' }}>
            {['Lighter dinners','Soup daily','More South Indian','Under 30 min'].map((c, i) => <V3Chip key={i} bg={v3.card} size={11} style={{ border:`1px solid ${v3.line}` }}>{c}</V3Chip>)}
          </div>
        </V3Card>

        <V3Card r={26} pad={18}>
          <V3Kick style={{ marginBottom:4 }}>Other</V3Kick>
          <V3Row label="Cuisines" value="Indian, Mediterranean" chevron/>
          <V3Row label="Fasting window" value="16:8" chevron/>
          <V3Row label="Recipe language" value="English" chevron/>
          <V3Row label="Cooking for" value="4 people" chevron last/>
        </V3Card>

        <V3Btn kind="dark" full onClick={() => onNav && onNav('profile')}>Save changes</V3Btn>
        <V3Btn kind="ghost" full small onClick={() => onNav && onNav('regenConfirm')} style={{ marginBottom:4 }}>Save and regenerate the plan</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Meal prep ────────────────────────────────────────────────
window.V3MealPrep = function V3MealPrep({ onNav }) {
  const steps = [
    { t:'Boil and shred 1.2 kg chicken', m:'25 min', done:true },
    { t:'Roast the week’s vegetables in two trays', m:'30 min', done:true },
    { t:'Cook 800 g dal, portion into 6 boxes', m:'20 min', done:false },
    { t:'Mix and jar the tandoori marinade', m:'8 min', done:false },
    { t:'Chop salad base, store on paper towel', m:'12 min', done:false },
    { t:'Portion snacks: chana, makhana, nuts', m:'10 min', done:false },
  ];
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('tips')} kick="Featured guide" title="Sunday batch protocol"
        right={<V3Chip bg={v3.limeSoft} size={11}>90 min</V3Chip>}/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg={v3.lime} r={30} pad={20}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
            <div>
              <V3Kick color="rgba(15,20,15,0.5)">Time saved this week</V3Kick>
              <div style={{ fontFamily:v3.disp, fontSize:42, fontWeight:700, letterSpacing:'-0.05em', marginTop:6 }}>5 h 10</div>
            </div>
            <V3Chip bg={v3.ink} color={v3.lime} size={10.5}>2 of 6 done</V3Chip>
          </div>
          <div style={{ marginTop:16 }}><V3Bar pct={2/6} h={9} color={v3.ink} track="rgba(15,20,15,0.16)" striped/></div>
        </V3Card>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>The protocol</V3Kick>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {steps.map((s, i) => (
              <V3Card key={i} r={22} pad={15} bg={s.done ? v3.card : v3.card} border={s.done ? 'transparent' : v3.line}>
                <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                  <V3Check on={s.done} size={24}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700, color: s.done ? v3.dimmer : v3.text, textDecoration: s.done ? 'line-through' : 'none' }}>{s.t}</div>
                  </div>
                  <V3Chip bg={v3.paper} size={10}>{s.m}</V3Chip>
                </div>
              </V3Card>
            ))}
          </div>
        </div>

        <V3Card bg={v3.cream} r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick color={v3.panelDim}>Storage</V3Kick>
          <div style={{ marginTop:10 }}>
            <V3Row label="Fridge · cooked protein" value="3 days"/>
            <V3Row label="Fridge · cut salad" value="2 days"/>
            <V3Row label="Freezer · dal portions" value="4 weeks" last/>
          </div>
        </V3Card>

        <V3Btn full style={{ marginTop:20 }} onClick={() => onNav && onNav('tips')}>Start the timer</V3Btn>
      </div>
    </V3Scaffold>
  );
};

// ── Regenerate · confirm ─────────────────────────────────────
window.V3RegenConfirm = function V3RegenConfirm({ onNav }) {
  const [start, setStart] = React.useState('Tomorrow');
  return (
    <V3Scaffold nav={false} onNav={onNav}>
      <V3TopBar onBack={() => onNav && onNav('profile')} kick="Week 03 · 14-day plan" title="Regenerate plan"/>
      <div style={{ padding:'22px 22px 0' }}>
        <V3Card bg="rgba(229,72,77,0.10)" r={26} pad={18}>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ width:26, height:26, borderRadius:999, background:v3.warn, color:'#fff', display:'grid', placeItems:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>!</div>
            <div>
              <div style={{ fontFamily:v3.sans, fontSize:13.5, fontWeight:700 }}>This replaces the rest of week 03</div>
              <div style={{ fontFamily:v3.sans, fontSize:12.5, fontWeight:500, color:v3.dim, marginTop:6, lineHeight:1.55 }}>
                Meals you have already logged stay. Unlogged meals, the recipes and the shopping list are rebuilt.
              </div>
            </div>
          </div>
        </V3Card>

        <div style={{ marginTop:20 }}>
          <V3Kick style={{ marginBottom:12 }}>Start the new plan</V3Kick>
          <div style={{ display:'flex', gap:8 }}>
            {['Today','Tomorrow','Next Monday'].map(o => (
              <button key={o} onClick={() => setStart(o)} style={{
                flex:1, border:'none', cursor:'pointer', borderRadius:999, padding:'13px 0',
                background: start === o ? v3.ink : v3.card, color: start === o ? v3.lime : v3.dim,
                fontFamily:v3.sans, fontSize:12.5, fontWeight:700,
              }}>{o}</button>
            ))}
          </div>
        </div>

        <V3Card r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick style={{ marginBottom:4 }}>The new plan will use</V3Kick>
          <V3Row label="Calories" value="1,320 kcal"/>
          <V3Row label="Meals per day" value="4"/>
          <V3Row label="Diet" value="Non-veg · no brinjal"/>
          <V3Row label="Length" value="14 days"/>
          <V3Row label="Cooking for" value="4 people" last/>
        </V3Card>

        <V3Card bg={v3.cream} r={26} pad={18} style={{ marginTop:12 }}>
          <V3Kick color={v3.panelDim}>Kept from the old plan</V3Kick>
          <div style={{ display:'flex', gap:7, marginTop:12, flexWrap:'wrap' }}>
            {['3 logged meals','Weight history','Water log','Liked recipes'].map((c, i) => <V3Chip key={i} bg={v3.card} size={11}>✓ {c}</V3Chip>)}
          </div>
        </V3Card>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:20 }}>
          <V3Btn full onClick={() => onNav && onNav('regenProgress')}>Regenerate now</V3Btn>
          <V3Btn kind="ghost" full small onClick={() => onNav && onNav('profile')}>Keep my current plan</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};

// ── Regenerate · progress ────────────────────────────────────
window.V3RegenProgress = function V3RegenProgress({ onNav }) {
  return (
    <V3Scaffold nav={false} onNav={onNav} bg={v3.ink} dark>
      <div style={{ padding:'0 22px', display:'flex', flexDirection:'column', minHeight:790 }}>
        <div style={{ paddingTop:26, display:'flex', alignItems:'baseline', gap:4 }}>
          <span style={{ fontFamily:v3.disp, fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color:v3.onDark }}>Plan Your Plate</span>
          <span style={{ fontFamily:v3.sans, fontSize:8.5, fontWeight:800, color:v3.lime }}>AI</span>
        </div>
        <div style={{ marginTop:58, display:'grid', placeItems:'center' }}>
          <V3Ring pct={0.34} size={186} thick={16} color={v3.lime} track="rgba(246,247,243,0.10)" dashRemainder>
            <div>
              <div style={{ fontFamily:v3.disp, fontSize:42, fontWeight:700, letterSpacing:'-0.05em', color:v3.onDark, lineHeight:1 }}>34<span style={{ fontSize:19 }}>%</span></div>
              <div style={{ fontFamily:v3.sans, fontSize:10.5, fontWeight:700, color:v3.onDarkDim, marginTop:6 }}>Day 5 of 14</div>
            </div>
          </V3Ring>
        </div>
        <div style={{ marginTop:36 }}>
          <V3H size={32} color={v3.onDark}>Rebuilding<br/>your week</V3H>
          <div style={{ fontFamily:v3.sans, fontSize:13, fontWeight:500, color:v3.onDarkDim, marginTop:12, lineHeight:1.6 }}>
            Keep the app open. This takes about 20 seconds.
          </div>
        </div>
        <div style={{ marginTop:24, display:'flex', flexDirection:'column', gap:9 }}>
          {[
            { t:'Day 1–4 · written', done:true }, { t:'Day 5 · balancing macros', now:true },
            { t:'Day 6–14 · queued' }, { t:'Shopping list · pending' },
          ].map((l, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background: l.now ? 'rgba(198,242,78,0.10)' : 'transparent', borderRadius:16, padding:'11px 13px' }}>
              <div style={{ width:22, height:22, borderRadius:999, flexShrink:0, display:'grid', placeItems:'center', background: l.done ? v3.lime : 'transparent', border: l.done ? 'none' : `1.5px solid ${l.now ? v3.lime : v3.lineDark}`, color:v3.ink, fontSize:11, fontWeight:800 }}>{l.done ? '✓' : ''}</div>
              <span style={{ fontFamily:v3.sans, fontSize:13, fontWeight:600, color: l.done ? v3.onDarkDim : l.now ? v3.lime : v3.onDarkDimmer }}>{l.t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:'auto', paddingTop:34, paddingBottom:28, display:'flex', flexDirection:'column', gap:10 }}>
          <V3Btn full onClick={() => onNav && onNav('meals')}>Open the new plan</V3Btn>
          <V3Btn kind="onDark" full small onClick={() => onNav && onNav('profile')}>Cancel</V3Btn>
        </div>
      </div>
    </V3Scaffold>
  );
};
