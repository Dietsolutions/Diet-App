import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { apiUrl } from '../lib/api';
import { OnboardingData } from '../types';
import { Country, City } from 'country-state-city';
import { COUNTRIES, COUNTRY_CODES, ALLERGENS, ALLERGEN_ICONS, INGREDIENT_CATEGORIES, INGREDIENT_ICONS, CUISINE_OPTIONS, CUISINE_REGIONS, KITCHEN_EQUIPMENT, EQUIPMENT_ICONS, HEALTH_CONDITIONS } from '../data/onboarding';
import { s2 } from '../theme/tokens';

const INITIAL: OnboardingData = {
  name: '', age: 25, gender: 'male', country: 'India', city: '',
  countryCode: 'IN',
  weightKg: 70, heightCm: 170, targetWeightKg: 65,
  mealPreference: 'non_vegetarian', cuisinePreferences: ['South Indian'], mealsPerDay: 4, eatingWindow: 'standard',
  eatingWindowHours: 8, fastingWindowHours: 16, eatingStartTime: '07:00', eatingEndTime: '15:00',
  allergies: [], allergyOther: '',
  preferredIngredients: [],
  avoidIngredients: [], avoidOther: '', avoidNone: false,
  primaryGoal: 'lose_weight', dietIntensity: 'moderate', activityLevel: 'lightly_active',
  healthConditions: [], wakeUpTime: '07:00', sleepTime: '23:00',
  cookingStyle: 'home', kitchenEquipment: ['Stovetop'],
  weeklyBudget: null, budgetCurrency: 'INR', waterIntakeGoal: 8,
  planDuration: 7,
};

interface Props {
  onComplete: () => void;
  userName?: string | null;
}

export function Onboarding({ onComplete, userName }: Props) {
  const { refreshUser, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({ ...INITIAL, name: userName || '' });
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const totalSteps = 7;
  const update = (partial: Partial<OnboardingData>) => setData(d => ({ ...d, ...partial }));
  const toggleArr = (field: keyof OnboardingData, val: string) => {
    const arr = (data[field] as string[]) || [];
    update({ [field]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] } as any);
  };
  const toggleArrMax = (field: keyof OnboardingData, val: string, max: number) => {
    const arr = (data[field] as string[]) || [];
    if (arr.includes(val)) update({ [field]: arr.filter(v => v !== val) } as any);
    else if (arr.length < max) update({ [field]: [...arr, val] } as any);
  };

  const canNext = () => {
    switch (step) {
      case 1: return data.name.trim() && data.age >= 10 && data.age <= 100 && data.country && data.city.trim();
      case 2: return data.weightKg > 0 && data.heightCm > 0 && data.targetWeightKg > 0;
      case 3: return data.mealPreference && data.cuisinePreferences.length > 0;
      case 4: return true;
      case 5: return data.preferredIngredients.length >= 5;
      case 6: return data.avoidIngredients.length > 0 || data.avoidNone === true;
      case 7: return data.primaryGoal && data.dietIntensity && data.activityLevel;
      default: return true;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      setGenStep('Saving your profile...');
      await axios.post('/api/profile', data, { withCredentials: true });

      setGenStep('Generating your personalised meal plan...');

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl('/api/ai/generate-meal-plan'));
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.withCredentials = true;
        xhr.timeout = 180000;

        let processed = 0;
        let settled = false;
        const parseSSE = () => {
          const text = xhr.responseText.substring(processed);
          processed = xhr.responseText.length;
          const blocks = text.split('\n\n');
          for (const block of blocks) {
            const eventMatch = block.match(/^event: (\w+)/);
            const dataMatch = block.match(/^data: (.+)$/m);
            if (!eventMatch || !dataMatch) continue;
            try {
              const parsed = JSON.parse(dataMatch[1]);
              if (eventMatch[1] === 'progress') setGenStep(parsed.step);
              else if (eventMatch[1] === 'done' && !settled) { settled = true; resolve(parsed); }
              else if (eventMatch[1] === 'error' && !settled) { settled = true; reject(new Error(parsed.error)); }
            } catch {}
          }
        };
        xhr.onprogress = parseSSE;
        xhr.onload = () => {
          parseSSE();
          if (!settled) {
            if (xhr.status >= 400) {
              try { reject(new Error(JSON.parse(xhr.responseText).error || 'Generation failed')); }
              catch { reject(new Error('Generation failed')); }
            } else { reject(new Error('No response received')); }
          }
        };
        xhr.onerror = () => { if (!settled) reject(new Error('Network error')); };
        xhr.ontimeout = () => { if (!settled) reject(new Error('Request timed out')); };
        xhr.send('{}');
      });

      if (!result?.success) throw new Error('Generation failed');

      setGenStep('Done!');
      await refreshUser();
      onComplete();
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate meal plan';
      setError(msg);
      setGenerating(false);
    }
  };

  const handleSkip = async () => {
    setGenerating(true);
    setError('');
    try {
      setGenStep('Saving your profile...');
      await axios.post('/api/profile', data, { withCredentials: true });
      // Profile POST marks onboardingDone=true on the server — no extra call needed.
      await refreshUser();
      onComplete();
    } catch {
      setError('Failed to save profile.');
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div style={{ minHeight: '100dvh', background: s2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 300, width: '100%' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.textDimmer, textTransform: 'uppercase', marginBottom: 20 }}>
            AI-GENERATING YOUR PLAN
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text, marginBottom: 12, lineHeight: 1.2 }}>
            Building your plan
          </div>
          <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent, letterSpacing: '0.1em', marginBottom: 28, minHeight: 18 }}>
            {genStep}
          </div>
          <div style={{ height: 2, background: s2.line, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: '-60%', height: '100%', width: '60%',
              background: `linear-gradient(90deg, transparent, ${s2.accent}, transparent)`,
              animation: 'shimmer 1.4s infinite',
            }} />
          </div>
          {error && (
            <div style={{ marginTop: 24, border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '12px 14px' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: '#FF3E3E', marginBottom: 8 }}>{error}</div>
              <button
                onClick={() => { setGenerating(false); setShowSummary(true); }}
                style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.accent, cursor: 'pointer' }}
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text, paddingBottom: 40 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em', color: s2.textDimmer, textTransform: 'uppercase', marginBottom: 10 }}>
            REVIEW PROFILE
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 26, fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 20, lineHeight: 1 }}>
            Confirm & Generate
          </div>

          <SummaryCard label="PERSONAL" items={[`${data.name}, ${data.age}y, ${data.gender}`, `${data.city}, ${data.country}`]} onEdit={() => { setShowSummary(false); setStep(1); }} />
          <SummaryCard label="BODY" items={[`${data.weightKg}kg → ${data.targetWeightKg}kg`, `Height: ${data.heightCm}cm`]} onEdit={() => { setShowSummary(false); setStep(2); }} />
          <SummaryCard label="DIET" items={[data.mealPreference, `${data.mealsPerDay} meals/day`, data.cuisinePreferences.join(', ')]} onEdit={() => { setShowSummary(false); setStep(3); }} />
          <SummaryCard label="ALLERGIES" items={[data.allergies.length > 0 ? data.allergies.join(', ') : 'None']} onEdit={() => { setShowSummary(false); setStep(4); }} />
          <SummaryCard label="GOAL" items={[data.primaryGoal, `Intensity: ${data.dietIntensity}`, data.activityLevel]} onEdit={() => { setShowSummary(false); setStep(7); }} />

          {error && (
            <div style={{ border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: '#FF3E3E' }}>{error}</div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            style={{
              width: '100%', padding: '15px 0', background: s2.accent, border: 'none',
              fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.2em', color: s2.bg,
              cursor: 'pointer', marginBottom: 10, textTransform: 'uppercase',
            }}
          >
            GENERATE MY MEAL PLAN ✨
          </button>
          <button
            onClick={handleSkip}
            style={{
              width: '100%', padding: '13px 0', background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em',
              color: s2.textDim, cursor: 'pointer', marginBottom: 20, textTransform: 'uppercase',
            }}
          >
            SKIP — USE DEFAULT PLAN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

        {/* Progress bar area */}
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.18em', color: s2.textDimmer, textTransform: 'uppercase' }}>
              STEP {step} OF {totalSteps}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.accent, cursor: 'pointer' }}
                >
                  ← BACK
                </button>
              )}
              <button
                onClick={logout}
                style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.12em', color: s2.textDimmer, cursor: 'pointer' }}
              >
                LOGOUT
              </button>
            </div>
          </div>
          {/* 2px flat progress bar */}
          <div style={{ height: 2, background: s2.line }}>
            <div style={{ height: '100%', width: `${(step / totalSteps) * 100}%`, background: s2.accent, transition: 'width 200ms' }} />
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 20px 100px', overflowY: 'auto' }}>
          {step === 1 && <StepPersonal data={data} update={update} />}
          {step === 2 && <StepBody data={data} update={update} />}
          {step === 3 && <StepDiet data={data} update={update} toggleArr={toggleArrMax} />}
          {step === 4 && <StepAllergies data={data} toggleArr={toggleArr} update={update} />}
          {step === 5 && <StepPreferred data={data} toggleArr={toggleArr} />}
          {step === 6 && <StepAvoid data={data} toggleArr={toggleArr} update={update} />}
          {step === 7 && <StepGoals data={data} update={update} toggleArr={toggleArr} />}
        </div>

        {/* Fixed bottom CTA */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          borderTop: `1px solid ${s2.line}`,
          padding: '12px 20px max(16px, env(safe-area-inset-bottom, 0px))',
          background: 'rgba(12,9,7,0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 20,
        }}>
          <div>
            <button
              onClick={() => step === totalSteps ? setShowSummary(true) : setStep(s => s + 1)}
              disabled={!canNext()}
              style={{
                width: '100%',
                padding: '14px 0',
                background: canNext() ? s2.accent : s2.surface,
                border: `1px solid ${canNext() ? s2.accent : s2.line}`,
                fontFamily: s2.mono,
                fontSize: 10,
                letterSpacing: '0.2em',
                color: canNext() ? s2.bg : s2.textDimmer,
                cursor: canNext() ? 'pointer' : 'default',
                textTransform: 'uppercase',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {step === totalSteps ? 'REVIEW & GENERATE' : 'CONTINUE →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, items, onEdit }: { label: string; items: string[]; onEdit: () => void }) {
  return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.18em', color: s2.textDimmer, textTransform: 'uppercase' }}>{label}</div>
        <button
          onClick={onEdit}
          style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.accent, cursor: 'pointer' }}
        >
          EDIT
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: i > 0 ? 4 : 0 }}>{item}</div>
      ))}
    </div>
  );
}

function StepPersonal({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [cityManual, setCityManual] = useState(false);
  const [ageStr, setAgeStr] = useState(data.age > 0 ? String(data.age) : '');

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Get cities for selected country using country-state-city
  const countryIso = data.countryCode || COUNTRY_CODES[data.country] || '';
  const allCities = countryIso ? (City.getCitiesOfCountry(countryIso) || []) : [];
  const filteredCities = citySearch.length >= 1
    ? allCities.filter(c => c.name.toLowerCase().startsWith(citySearch.toLowerCase())).slice(0, 8)
    : allCities.slice(0, 8);

  const handleCountrySelect = (name: string) => {
    const iso = COUNTRY_CODES[name] || '';
    update({ country: name, countryCode: iso, city: '', cityManual: undefined } as any);
    setCountrySearch('');
    setCitySearch('');
    setCityManual(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-primary">Personal Details</h2>
      <Field label="Name" value={data.name} onChange={v => update({ name: v })} placeholder="Your name" />

      {/* Age — string state to avoid stuck-zero */}
      <div>
        <label className="block text-sm font-medium text-primary mb-1.5 font-sans">Age</label>
        <input
          type="text"
          inputMode="numeric"
          value={ageStr}
          placeholder="e.g. 28"
          onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            setAgeStr(val);
            const n = parseInt(val, 10);
            if (!isNaN(n)) update({ age: n });
          }}
          onBlur={() => {
            const n = parseInt(ageStr, 10);
            if (isNaN(n) || n < 10 || n > 100) { setAgeStr(''); update({ age: 0 }); }
            else setAgeStr(String(n));
          }}
          className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary placeholder-dimmed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary mb-1.5 font-sans">Gender</label>
        <div className="grid grid-cols-4 gap-2">
          {['male', 'female', 'other', 'prefer_not_to_say'].map(g => (
            <button key={g} onClick={() => update({ gender: g })}
              className={`py-2 rounded-xl text-sm font-sans font-medium transition-all ${
                data.gender === g ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
              {g === 'prefer_not_to_say' ? 'Skip' : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Country with search */}
      <div>
        <label className="block text-sm font-medium text-primary mb-1.5 font-sans">Country</label>
        <input
          type="text"
          value={countrySearch !== '' ? countrySearch : data.country}
          onChange={e => { setCountrySearch(e.target.value); }}
          onFocus={() => setCountrySearch(data.country)}
          className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          placeholder="Search country..."
        />
        {countrySearch && filteredCountries.length > 0 && (
          <div className="bg-surface border border-border rounded-xl mt-1 max-h-40 overflow-y-auto">
            {filteredCountries.slice(0, 8).map(c => (
              <button key={c} onClick={() => handleCountrySelect(c)}
                className="w-full text-left px-4 py-2 text-sm font-sans text-primary hover:bg-elevated">{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* City — linked to country */}
      <div>
        <label className="block text-sm font-medium text-primary mb-1.5 font-sans">City</label>
        {cityManual || allCities.length === 0 ? (
          <>
            <input
              type="text"
              value={data.city}
              onChange={e => update({ city: e.target.value })}
              disabled={!data.country}
              className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary placeholder-dimmed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
              placeholder={data.country ? 'Type your city' : 'Select a country first'}
            />
            {allCities.length > 0 && (
              <button onClick={() => setCityManual(false)} className="text-accent text-xs font-sans mt-1 underline underline-offset-2">
                ← Search from list
              </button>
            )}
          </>
        ) : (
          <>
            <input
              type="text"
              value={citySearch !== '' ? citySearch : data.city}
              onChange={e => { setCitySearch(e.target.value); }}
              onFocus={() => setCitySearch(data.city)}
              disabled={!data.country}
              className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary placeholder-dimmed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
              placeholder={data.country ? 'Search city...' : 'Select a country first'}
            />
            {citySearch && filteredCities.length > 0 && (
              <div className="bg-surface border border-border rounded-xl mt-1 max-h-40 overflow-y-auto">
                {filteredCities.map(c => (
                  <button key={c.name + c.stateCode} onClick={() => { update({ city: c.name }); setCitySearch(''); }}
                    className="w-full text-left px-4 py-2 text-sm font-sans text-primary hover:bg-elevated">{c.name}</button>
                ))}
              </div>
            )}
            <button onClick={() => setCityManual(true)} className="text-dimmed text-xs font-sans mt-1 underline underline-offset-2">
              City not listed? Type it manually
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StepBody({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  const [weightStr, setWeightStr] = useState(data.weightKg > 0 ? String(data.weightKg) : '');
  const [heightStr, setHeightStr] = useState(data.heightCm > 0 ? String(data.heightCm) : '');
  const [targetStr, setTargetStr] = useState(data.targetWeightKg > 0 ? String(data.targetWeightKg) : '');

  const bmiVal = data.weightKg > 0 && data.heightCm > 0
    ? (data.weightKg / ((data.heightCm / 100) ** 2)).toFixed(1)
    : null;
  const weightDiff = data.weightKg > 0 && data.targetWeightKg > 0
    ? (data.weightKg - data.targetWeightKg).toFixed(1)
    : null;

  function makeNumHandler(
    setter: (s: string) => void,
    updater: (n: number) => void,
    allowDecimal = true
  ) {
    return {
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
        if (pattern.test(val)) { setter(val); const n = parseFloat(val); if (!isNaN(n) && n > 0) updater(n); }
      },
      onBlur: (val: string, setter: (s: string) => void, updater: (n: number) => void) => {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) { setter(String(n)); updater(n); }
        else { setter(''); updater(0); }
      }
    };
  }

  const wh = makeNumHandler(setWeightStr, v => update({ weightKg: v }));
  const hh = makeNumHandler(setHeightStr, v => update({ heightCm: v }));
  const th = makeNumHandler(setTargetStr, v => update({ targetWeightKg: v }));

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-primary">Body Stats</h2>

      {(['Current Weight (kg)', 'Height (cm)', 'Target Weight (kg)'] as const).map((label, i) => {
        const [str, setter, handler, updater] = [
          [weightStr, setWeightStr, wh, (v: number) => update({ weightKg: v })],
          [heightStr, setHeightStr, hh, (v: number) => update({ heightCm: v })],
          [targetStr, setTargetStr, th, (v: number) => update({ targetWeightKg: v })],
        ][i] as [string, (s: string) => void, ReturnType<typeof makeNumHandler>, (n: number) => void];

        return (
          <div key={label}>
            <label className="block text-sm font-medium text-primary mb-1.5 font-sans">{label}</label>
            <input
              type="text"
              inputMode="decimal"
              value={str}
              placeholder={i === 1 ? 'e.g. 170' : 'e.g. 70'}
              onChange={handler.onChange}
              onBlur={() => handler.onBlur(str, setter, updater)}
              className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary placeholder-dimmed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>
        );
      })}

      {bmiVal && weightDiff && (
        <div className="bg-accent-fill rounded-xl p-4 border border-accent/20">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-sans text-primary font-medium">BMI</span>
            <span className="text-sm font-mono font-bold text-accent">{bmiVal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-sans text-primary font-medium">{parseFloat(weightDiff) > 0 ? 'To lose' : 'To gain'}</span>
            <span className="text-sm font-mono font-bold text-accent">{Math.abs(parseFloat(weightDiff))} kg</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StepDiet({ data, update, toggleArr }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void; toggleArr: (f: keyof OnboardingData, v: string, max: number) => void }) {
  const [cuisineSearch, setCuisineSearch] = useState('');
  const [eatingHoursStr, setEatingHoursStr] = useState(
    String(data.eatingWindowHours ?? 8)
  );

  const isIF = data.eatingWindow === 'intermittent_fasting';
  const eatingHours = parseInt(eatingHoursStr, 10) || 8;
  const fastingHours = 24 - eatingHours;

  // Calculate end time from start + eatingHours
  function calcEndTime(start: string, hours: number): string {
    const [h, m] = start.split(':').map(Number);
    const endH = (h + hours) % 24;
    return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const handleEatingHoursChange = (val: string) => {
    if (!/^\d*$/.test(val)) return;
    setEatingHoursStr(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 4 && n <= 20) {
      const endTime = calcEndTime(data.eatingStartTime || '07:00', n);
      update({ eatingWindowHours: n, fastingWindowHours: 24 - n, eatingEndTime: endTime });
    }
  };

  const handleStartTimeChange = (start: string) => {
    const endTime = calcEndTime(start, eatingHours);
    update({ eatingStartTime: start, eatingEndTime: endTime });
  };

  const regions = CUISINE_REGIONS;
  const filteredOptions = cuisineSearch
    ? CUISINE_OPTIONS.filter(c => c.label.toLowerCase().includes(cuisineSearch.toLowerCase()))
    : CUISINE_OPTIONS;

  // Group by region
  const grouped: Record<string, typeof CUISINE_OPTIONS[number][]> = {};
  filteredOptions.forEach(c => {
    if (!grouped[c.region]) grouped[c.region] = [];
    grouped[c.region].push(c);
  });
  const visibleRegions = cuisineSearch
    ? Object.keys(grouped)
    : regions.filter(r => grouped[r]?.length > 0);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-primary">Diet Preferences</h2>

      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Meal Preference</label>
        <div className="flex flex-wrap gap-2">
          {['vegetarian', 'non_vegetarian', 'vegan', 'eggetarian', 'pescatarian'].map(p => (
            <button key={p} onClick={() => update({ mealPreference: p })}
              className={`px-4 py-2 rounded-3xl text-sm font-sans font-medium transition-all ${
                data.mealPreference === p ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
              {p.replace('_', '-').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine — grouped + searchable */}
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">
          Cuisine Preference <span className="text-secondary">(up to 3)</span>
        </label>
        {data.cuisinePreferences.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {data.cuisinePreferences.map(c => (
              <span key={c} className="bg-accent text-white text-xs px-3 py-1 rounded-full font-sans font-medium flex items-center gap-1">
                {c}
                <button onClick={() => toggleArr('cuisinePreferences', c, 3)} className="text-white/70 hover:text-white ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={cuisineSearch}
          onChange={e => setCuisineSearch(e.target.value)}
          placeholder="Search cuisines..."
          className="w-full border-[1.5px] border-border rounded-xl px-4 py-2.5 font-sans text-sm bg-surface text-primary placeholder-dimmed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 mb-2"
        />
        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
          {visibleRegions.map(region => (
            <div key={region}>
              <p className="text-[10px] font-sans font-bold text-dimmed uppercase tracking-wider mb-1 px-1">{region}</p>
              <div className="flex flex-wrap gap-1.5">
                {(grouped[region] || []).map(c => {
                  const sel = data.cuisinePreferences.includes(c.value);
                  const maxed = !sel && data.cuisinePreferences.length >= 3;
                  return (
                    <button
                      key={c.value}
                      onClick={() => !maxed && toggleArr('cuisinePreferences', c.value, 3)}
                      disabled={maxed}
                      className={`px-3 py-1.5 rounded-3xl text-xs font-sans font-medium transition-all ${
                        sel ? 'bg-accent text-white' : maxed ? 'bg-surface border border-border text-dimmed opacity-50 cursor-not-allowed' : 'bg-surface border border-border text-secondary'}`}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Meals per day</label>
        <div className="flex gap-2">
          {[3, 4, 5].map(n => (
            <button key={n} onClick={() => update({ mealsPerDay: n })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-sans font-medium transition-all ${
                data.mealsPerDay === n ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Eating Window — Standard / IF */}
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Eating Window &amp; Fasting Schedule</label>
        <div className="space-y-2">
          {/* Standard */}
          <button
            onClick={() => update({ eatingWindow: 'standard', eatingWindowHours: undefined, fastingWindowHours: undefined, eatingStartTime: undefined, eatingEndTime: undefined })}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-sans font-medium transition-all ${
              !isIF ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}
          >
            Standard — No fasting window (eat any time)
          </button>

          {/* Intermittent Fasting */}
          <button
            onClick={() => {
              const start = data.eatingStartTime || '07:00';
              const hours = data.eatingWindowHours || 8;
              update({
                eatingWindow: 'intermittent_fasting',
                eatingWindowHours: hours,
                fastingWindowHours: 24 - hours,
                eatingStartTime: start,
                eatingEndTime: calcEndTime(start, hours),
              });
            }}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-sans font-medium transition-all ${
              isIF ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}
          >
            Intermittent Fasting — Custom windows
          </button>
        </div>

        {/* IF detail panel */}
        {isIF && (
          <div className="mt-2 bg-elevated rounded-xl p-4 border border-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1 font-sans">Eating Window (hours)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={eatingHoursStr}
                  onChange={e => handleEatingHoursChange(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(eatingHoursStr, 10);
                    if (isNaN(n) || n < 4) { setEatingHoursStr('8'); update({ eatingWindowHours: 8, fastingWindowHours: 16 }); }
                    else if (n > 20) { setEatingHoursStr('20'); update({ eatingWindowHours: 20, fastingWindowHours: 4 }); }
                  }}
                  className="w-full border-[1.5px] border-border rounded-xl px-3 py-2 font-mono text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1 font-sans">Fasting Window (hours)</label>
                <div className="w-full border-[1.5px] border-border/50 rounded-xl px-3 py-2 font-mono text-sm bg-surface/50 text-dimmed">
                  {isNaN(fastingHours) ? '–' : fastingHours}
                </div>
              </div>
            </div>
            {(parseInt(eatingHoursStr, 10) < 4 || parseInt(eatingHoursStr, 10) > 20) && eatingHoursStr !== '' && (
              <p className="text-xs text-red-400 font-sans">Eating window must be between 4 and 20 hours</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1 font-sans">Eating start time</label>
                <input
                  type="time"
                  value={data.eatingStartTime || '07:00'}
                  onChange={e => handleStartTimeChange(e.target.value)}
                  className="w-full border-[1.5px] border-border rounded-xl px-3 py-2 font-sans text-sm bg-surface text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1 font-sans">Eating end time</label>
                <div className="w-full border-[1.5px] border-border/50 rounded-xl px-3 py-2 font-mono text-sm bg-surface/50 text-dimmed">
                  {data.eatingEndTime || '–'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepAllergies({ data, toggleArr, update }: { data: OnboardingData; toggleArr: (f: keyof OnboardingData, v: string) => void; update: (p: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-primary">Allergies & Intolerances</h2>
      <p className="text-sm text-secondary font-sans">Tap to select any that apply</p>
      <div className="grid grid-cols-3 gap-2.5">
        {ALLERGENS.map(a => {
          const selected = data.allergies.includes(a);
          return (
            <button key={a} onClick={() => toggleArr('allergies', a)}
              className={`relative flex flex-col items-center justify-center rounded-2xl py-4 px-2 transition-all active:scale-97 ${
                selected ? 'bg-red-500/20 border-[1.5px] border-red-500/50' : 'bg-surface border-[1.5px] border-border'}`}>
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">✓</span>
                </div>
              )}
              <span className="text-2xl mb-1.5">{ALLERGEN_ICONS[a] || '⚠️'}</span>
              <span className={`text-xs font-sans font-medium text-center leading-tight ${selected ? 'text-red-400' : 'text-secondary'}`}>{a}</span>
            </button>
          );
        })}
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1.5 font-sans">Any other allergies?</label>
        <input type="text" value={data.allergyOther} onChange={e => update({ allergyOther: e.target.value })}
          className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          placeholder="E.g. citrus, certain spices..." />
      </div>
    </div>
  );
}

function StepPreferred({ data, toggleArr }: { data: OnboardingData; toggleArr: (f: keyof OnboardingData, v: string) => void }) {
  const count = data.preferredIngredients.length;
  const met = count >= 5;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">Choose your staples</h2>
        <p className="text-sm text-secondary font-sans mt-1">Tap ingredients you love. At least 5 required.</p>
      </div>
      <div className={`rounded-xl px-3 py-2.5 text-xs font-sans font-medium border ${
        met
          ? 'bg-success-fill border-success/20 text-success'
          : 'bg-accent-fill border-accent/20 text-accent'
      }`}>
        {met
          ? `${count} selected ✓ — great variety for your plan`
          : `Select at least 5 ingredients (${count}/5 selected)`}
      </div>
      {INGREDIENT_CATEGORIES.map(cat => (
        <div key={cat.name}>
          <label className="block text-sm font-semibold text-secondary uppercase tracking-wide mb-2.5 font-sans">{cat.name}</label>
          <div className="grid grid-cols-3 gap-2.5">
            {cat.items.map(item => {
              const selected = data.preferredIngredients.includes(item);
              return (
                <button key={item} onClick={() => toggleArr('preferredIngredients', item)}
                  className={`relative flex flex-col items-center justify-center rounded-2xl py-4 px-2 transition-all active:scale-97 ${
                    selected ? 'bg-success/15 border-[1.5px] border-success/40' : 'bg-surface border-[1.5px] border-border'}`}>
                  {selected && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-success rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">✓</span>
                    </div>
                  )}
                  <span className="text-2xl mb-1.5">{INGREDIENT_ICONS[item] || '🍽️'}</span>
                  <span className={`text-xs font-sans font-medium text-center leading-tight ${selected ? 'text-success' : 'text-secondary'}`}>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepAvoid({ data, toggleArr, update }: { data: OnboardingData; toggleArr: (f: keyof OnboardingData, v: string) => void; update: (p: Partial<OnboardingData>) => void }) {
  const hasSelections = data.avoidIngredients.filter(v => v !== '__none__').length > 0;
  const optedOut = data.avoidNone === true;

  const handleToggle = (item: string) => {
    // Clear opt-out when user selects an ingredient
    if (optedOut) update({ avoidNone: false, avoidIngredients: [] });
    toggleArr('avoidIngredients', item);
  };

  const handleOptOut = () => {
    update({ avoidIngredients: ['__none__'], avoidNone: true });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">Ingredients to Avoid</h2>
        <p className="text-sm text-secondary font-sans mt-1">Select at least one, or confirm you have none.</p>
      </div>

      {optedOut && (
        <div className="bg-success-fill border border-success/20 rounded-xl px-3 py-2.5 text-xs text-success font-sans font-medium">
          ✓ No ingredients to avoid — we'll include everything
        </div>
      )}

      {INGREDIENT_CATEGORIES.map(cat => (
        <div key={cat.name}>
          <label className="block text-sm font-semibold text-secondary uppercase tracking-wide mb-2.5 font-sans">{cat.name}</label>
          <div className="grid grid-cols-3 gap-2.5">
            {cat.items.map(item => {
              const isAllergen = data.allergies.some(a => item.toLowerCase().includes(a.toLowerCase()));
              const selected = data.avoidIngredients.includes(item);
              return (
                <button key={item} onClick={() => !isAllergen && handleToggle(item)}
                  disabled={isAllergen || optedOut}
                  className={`relative flex flex-col items-center justify-center rounded-2xl py-4 px-2 transition-all active:scale-97 ${
                    isAllergen ? 'bg-red-500/10 border-[1.5px] border-red-500/30 cursor-not-allowed opacity-50' :
                    optedOut ? 'bg-surface border-[1.5px] border-border opacity-40 cursor-not-allowed' :
                    selected ? 'bg-red-500/15 border-[1.5px] border-red-500/40' : 'bg-surface border-[1.5px] border-border'}`}>
                  {selected && !isAllergen && !optedOut && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">✓</span>
                    </div>
                  )}
                  {isAllergen && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-red-500/60 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px]">⚠</span>
                    </div>
                  )}
                  <span className="text-2xl mb-1.5">{INGREDIENT_ICONS[item] || '🍽️'}</span>
                  <span className={`text-xs font-sans font-medium text-center leading-tight ${
                    isAllergen ? 'text-red-400/60' : selected && !optedOut ? 'text-red-400' : 'text-secondary'}`}>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!hasSelections && (
        <button
          onClick={handleOptOut}
          className={`w-full py-3 rounded-[14px] font-sans text-sm font-medium border transition-all ${
            optedOut
              ? 'bg-success-fill border-success/30 text-success'
              : 'bg-surface border-border text-secondary hover:bg-elevated'
          }`}
        >
          {optedOut ? '✓ I have no ingredients to avoid' : 'I have no ingredients to avoid — continue'}
        </button>
      )}

      <div>
        <label className="block text-sm font-medium text-primary mb-1.5 font-sans">Any other ingredients to avoid?</label>
        <input type="text" value={data.avoidOther} onChange={e => update({ avoidOther: e.target.value })}
          className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
          placeholder="E.g. bitter gourd, liver..." />
      </div>
    </div>
  );
}

function StepGoals({ data, update, toggleArr }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void; toggleArr: (f: keyof OnboardingData, v: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-primary">Goals & Lifestyle</h2>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Primary Goal</label>
        <div className="space-y-2">
          {[
            { val: 'lose_weight', label: 'Lose Weight' },
            { val: 'maintain', label: 'Maintain Weight' },
            { val: 'gain_muscle', label: 'Gain Muscle' },
            { val: 'improve_fitness', label: 'Improve Fitness' },
            { val: 'manage_health', label: 'Manage Health Condition' }
          ].map(g => (
            <button key={g.val} onClick={() => update({ primaryGoal: g.val })}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-sans font-medium transition-all ${
                data.primaryGoal === g.val ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Plan Duration</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { val: 7, label: '7-Day Plan', desc: 'One week of meals' },
            { val: 14, label: '14-Day Plan', desc: 'Maximum variety', badge: '⭐ Recommended' },
          ].map(o => (
            <button key={o.val} onClick={() => update({ planDuration: o.val })}
              className={`relative text-left px-4 py-3 rounded-xl text-sm font-sans transition-all ${
                data.planDuration === o.val ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
              {o.badge && (
                <span className="absolute -top-2 right-2 bg-accent text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{o.badge}</span>
              )}
              <span className="font-semibold block">{o.label}</span>
              <span className={`text-xs mt-0.5 block ${data.planDuration === o.val ? 'text-secondary' : 'text-dimmed'}`}>{o.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Diet Intensity</label>
        {[
          { val: 'low', emoji: '🟢', label: 'Low', desc: 'Mild deficit (~300 kcal). Gradual, sustainable.' },
          { val: 'moderate', emoji: '🟡', label: 'Moderate', desc: 'Standard deficit (~500 kcal). Steady 0.5kg/week. Recommended.' },
          { val: 'high', emoji: '🔴', label: 'High', desc: 'Aggressive deficit (~750 kcal). Fast results, requires discipline.' }
        ].map(i => (
          <button key={i.val} onClick={() => update({ dietIntensity: i.val })}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-sans mb-2 transition-all ${
              data.dietIntensity === i.val ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
            <span className="font-medium">{i.emoji} {i.label}</span>
            <p className={`text-xs mt-0.5 ${data.dietIntensity === i.val ? 'text-secondary' : 'text-dimmed'}`}>{i.desc}</p>
          </button>
        ))}
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Activity Level</label>
        {[
          { val: 'sedentary', label: 'Sedentary (desk job)' },
          { val: 'lightly_active', label: 'Lightly Active (1–2 workouts/week)' },
          { val: 'moderately_active', label: 'Moderately Active (3–4 workouts/week)' },
          { val: 'very_active', label: 'Very Active (5+ workouts/week)' }
        ].map(a => (
          <button key={a.val} onClick={() => update({ activityLevel: a.val })}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-sans font-medium mb-2 transition-all ${
              data.activityLevel === a.val ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
            {a.label}
          </button>
        ))}
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Health Conditions</label>
        <div className="flex flex-wrap gap-2">
          {HEALTH_CONDITIONS.map(h => (
            <button key={h} onClick={() => {
              if (h === 'None') update({ healthConditions: ['None'] });
              else { const arr = data.healthConditions.filter(x => x !== 'None'); toggleArr('healthConditions', h); }
            }}
              className={`px-4 py-2 rounded-3xl text-sm font-sans font-medium transition-all ${
                data.healthConditions.includes(h) ? 'bg-accent text-white' : 'bg-surface border border-border text-secondary'}`}>
              {h}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-primary mb-1 font-sans">Wake Up</label>
          <input type="time" value={data.wakeUpTime} onChange={e => update({ wakeUpTime: e.target.value })}
            className="w-full border-[1.5px] border-border rounded-xl px-3 py-2.5 font-sans text-sm bg-surface text-primary focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-primary mb-1 font-sans">Sleep</label>
          <input type="time" value={data.sleepTime} onChange={e => update({ sleepTime: e.target.value })}
            className="w-full border-[1.5px] border-border rounded-xl px-3 py-2.5 font-sans text-sm bg-surface text-primary focus:outline-none focus:border-accent" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Cooking Style</label>
        <div className="flex gap-2">
          {[{ val: 'home', label: 'Home' }, { val: 'mix', label: 'Mix' }, { val: 'outside', label: 'Mostly Outside' }].map(c => (
            <button key={c.val} onClick={() => update({ cookingStyle: c.val })}
              className={`flex-1 py-2.5 rounded-xl text-sm font-sans font-medium transition-all ${
                data.cookingStyle === c.val ? 'bg-elevated text-primary border border-accent/40' : 'bg-surface border border-border text-secondary'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-2 font-sans">Kitchen Equipment</label>
        <div className="grid grid-cols-3 gap-2.5">
          {KITCHEN_EQUIPMENT.map(e => {
            const selected = data.kitchenEquipment.includes(e);
            return (
              <button key={e} onClick={() => toggleArr('kitchenEquipment', e)}
                className={`relative flex flex-col items-center justify-center rounded-2xl py-4 px-2 transition-all active:scale-97 ${
                  selected ? 'bg-success/15 border-[1.5px] border-success/40' : 'bg-surface border-[1.5px] border-border'}`}>
                {selected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-success rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">✓</span>
                  </div>
                )}
                <span className="text-2xl mb-1.5">{EQUIPMENT_ICONS[e] || '🔧'}</span>
                <span className={`text-xs font-sans font-medium text-center leading-tight ${selected ? 'text-success' : 'text-secondary'}`}>{e}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-primary mb-1 font-sans">Water Intake Goal (glasses/day)</label>
        <input type="range" min={4} max={16} value={data.waterIntakeGoal}
          onChange={e => update({ waterIntakeGoal: parseInt(e.target.value) })}
          className="w-full accent-accent" />
        <span className="text-sm font-mono text-accent font-bold">{data.waterIntakeGoal} glasses</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary mb-1.5 font-sans">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary placeholder-dimmed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary mb-1.5 font-sans">{label}</label>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full border-[1.5px] border-border rounded-xl px-4 py-3 font-sans text-base bg-surface text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30" />
    </div>
  );
}
