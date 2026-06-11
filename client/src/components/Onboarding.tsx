// Onboarding — Strain v2 visual redesign. All data collection, hooks, and API calls preserved.

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { apiUrl } from '../lib/api';
import { OnboardingData } from '../types';
import { COUNTRIES, COUNTRY_CODES, ALLERGENS, ALLERGEN_ICONS, INGREDIENT_CATEGORIES, INGREDIENT_ICONS, CUISINE_OPTIONS, CUISINE_REGIONS, KITCHEN_EQUIPMENT, EQUIPMENT_ICONS, HEALTH_CONDITIONS } from '../data/onboarding';
import { s2 } from '../theme/tokens';
import { PlanReviewScreen } from './PlanReviewScreen';
import { track } from '../lib/analytics';

// `country-state-city` is ~7.7 MB. Dynamic-import the parts we need so the
// Onboarding chunk stays under the PWA 4 MB precache limit. The actual Country/City
// functions are loaded on demand when the user opens the country/city dropdowns.
const getCitiesOfCountry = async (iso: string) => {
  const mod = await import(/* webpackChunkName: "country-state-city" */ 'country-state-city');
  return mod.City.getCitiesOfCountry(iso) || [];
};

const INITIAL: OnboardingData = {
  name: '', age: 25, gender: 'male', country: 'India', city: '',
  countryCode: 'IN',
  weightKg: 70, heightCm: 170, targetWeightKg: 0,
  mealPreference: 'non_vegetarian', cuisinePreferences: ['South Indian'], mealsPerDay: 4, eatingWindow: 'standard',
  eatingWindowHours: 8, fastingWindowHours: 16, eatingStartTime: '07:00', eatingEndTime: '15:00',
  allergies: [], allergyOther: '',
  preferredIngredients: [],
  avoidIngredients: [], avoidOther: '', avoidNone: false,
  primaryGoal: 'eat_healthy', dietIntensity: '', activityLevel: 'lightly_active',
  healthConditions: [], wakeUpTime: '07:00', sleepTime: '23:00',
  cookingStyle: 'home', kitchenEquipment: ['Stovetop'],
  weeklyBudget: null, budgetCurrency: 'INR', waterIntakeGoal: 8,
  planDuration: 7,
  // Group A — TDEE inputs
  trainingType: 'none', trainingDaysPerWeek: 3, trainingDurationMins: 45,
  cardioSessionsPerWeek: 0, dailySteps: 5000, occupationType: 'desk_job', insulinSensitivity: 'average',
  // Group B — meal plan context (Claude prompt only)
  sleepQuality: 'average', stressLevel: 'medium', recoveryCapacity: 'average',
  hungerLevel: 'medium', energyLevel: 'moderate',
};

// Generating checklist steps
const GEN_CHECKLIST = [
  { label: 'READING YOUR PROFILE',      match: 'Saving your profile' },
  { label: 'APPLYING PREFERENCES',      match: 'Applying' },
  { label: 'GENERATING YOUR MENU',      match: 'Generating' },
  { label: 'WRITING MEALS',             match: 'Writing meals' },
  { label: 'SAVING MEAL PLAN',          match: 'Saving meal' },
];

function getGenIdx(step: string): number {
  for (let i = GEN_CHECKLIST.length - 1; i >= 0; i--) {
    if (step.toLowerCase().includes(GEN_CHECKLIST[i].match.toLowerCase())) return i;
  }
  if (step === 'Done!') return GEN_CHECKLIST.length;
  return 0;
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function HairLabel({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.22em',
      color: color || s2.textDimmer, textTransform: 'uppercase', fontWeight: 500,
      ...style,
    }}>
      {children}
    </div>
  );
}

function BackBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'transparent',
      border: `1px solid ${s2.lineStrong}`,
      width: 36, height: 36,
      color: disabled ? s2.textDimmer : s2.text,
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="11" height="11" viewBox="0 0 11 11">
        <path d="M7 1 L2 5.5 L7 10" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    </button>
  );
}

// Underline text input (name-style)
function UnderlineInput({ value, onChange, placeholder, fontSize = 28 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; fontSize?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        display: 'block', width: '100%',
        background: 'transparent', border: 'none',
        borderBottom: `1px solid ${s2.accent}`,
        fontFamily: s2.sans, fontSize, fontWeight: 300,
        color: s2.text, letterSpacing: '-0.02em',
        padding: '8px 0', outline: 'none',
      }}
    />
  );
}

// S2 bordered selection button
function SelBtn({ on, onClick, children, style }: {
  on: boolean; onClick: () => void; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} style={{
      background: on ? s2.accentFill : 'transparent',
      border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
      color: on ? s2.accent : s2.text,
      fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
      cursor: 'pointer', textTransform: 'uppercase',
      ...style,
    }}>
      {children}
    </button>
  );
}

// ── Props / interfaces ─────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
  userName?: string | null;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function Onboarding({ onComplete, userName }: Props) {
  const { refreshUser, logout } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({ ...INITIAL, name: userName || '' });
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [showPlanReview, setShowPlanReview] = useState(false);
  const [reviewMealPlanId, setReviewMealPlanId] = useState<string>('active');
  const [onboardingCustomInstructions, setOnboardingCustomInstructions] = useState('');

  const totalSteps = 8;
  const genStartRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  // Fire once on mount
  useEffect(() => { track('onboarding_started'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      case 2: return data.weightKg > 0 && data.heightCm > 0; // targetWeightKg is optional
      case 3: return data.mealPreference && data.cuisinePreferences.length > 0;
      case 4: return true;
      case 5: return data.preferredIngredients.length >= 5;
      case 6: return data.avoidIngredients.length > 0 || data.avoidNone === true;
      case 7: {
        const needsIntensity = ['lose_weight', 'gain_muscle'].includes(data.primaryGoal);
        return !!(data.primaryGoal && data.activityLevel && (!needsIntensity || data.dietIntensity));
      }
      case 8: return true;
      default: return true;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    genStartRef.current = Date.now();
    track('meal_plan_generation_started', {
      plan_duration:   data.planDuration,
      meals_per_day:   data.mealsPerDay,
      is_first_plan:   true,
    });
    if (onboardingCustomInstructions.trim()) {
      track('onboarding_custom_instructions_added', {
        character_count: onboardingCustomInstructions.trim().length,
      });
    }
    try {
      setGenStep('Saving your profile...');
      // Sanitise optional fields: 0/empty string → null so the server accepts them
      const profilePayload = {
        ...data,
        targetWeightKg: data.targetWeightKg > 0 ? data.targetWeightKg : null,
        dietIntensity:  data.dietIntensity || null,
      };
      await axios.post('/api/profile', profilePayload, { withCredentials: true });
      // Save custom instructions so the generate endpoint picks them up from the profile
      if (onboardingCustomInstructions.trim()) {
        await axios.patch('/api/profile/meal-instructions',
          { instructions: onboardingCustomInstructions.trim() },
          { withCredentials: true },
        );
      }
      setGenStep('Generating your personalised meal plan...');

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl('/api/ai/generate-meal-plan'));
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.withCredentials = true;
        xhr.timeout = 300000; // 5 min — matches Vercel maxDuration; 180s was too short for worst-case CN pipeline
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
      track('meal_plan_generation_completed', {
        plan_duration:    data.planDuration,
        duration_seconds: Math.round((Date.now() - genStartRef.current) / 1000),
        is_first_plan:    true,
      });
      // onboardingDone is NOT set yet — confirm-review sets it.
      // Don't call refreshUser here; the plan review screen handles that via onComplete.
      setReviewMealPlanId(result?.mealPlanId || 'active');
      setGenerating(false);
      setShowPlanReview(true);
    } catch (err: any) {
      track('meal_plan_generation_failed', { error: err?.message ?? 'unknown' });
      setError(err?.message || 'Failed to generate meal plan');
      setGenerating(false);
    }
  };

  const handleSkip = async () => {
    setGenerating(true);
    setError('');
    try {
      setGenStep('Saving your profile...');
      const skipPayload = {
        ...data,
        targetWeightKg: data.targetWeightKg > 0 ? data.targetWeightKg : null,
        dietIntensity:  data.dietIntensity || null,
      };
      await axios.post('/api/profile', skipPayload, { withCredentials: true });
      await refreshUser();
      onComplete();
    } catch {
      setError('Failed to save profile.');
      setGenerating(false);
    }
  };

  // Show plan review screen after generation — onComplete will refreshUser + exit onboarding
  if (showPlanReview) {
    return (
      <PlanReviewScreen
        mealPlanId={reviewMealPlanId}
        onComplete={async () => {
          track('onboarding_completed', { is_first_plan: true });
          await refreshUser(); // now onboardingDone=true — App.tsx exits Onboarding
          onComplete();
        }}
      />
    );
  }

  // ── Generating screen (OB5 style) ──────────────────────────────────────────
  if (generating) {
    const activeIdx = getGenIdx(genStep);
    const pct = Math.round((activeIdx / GEN_CHECKLIST.length) * 100);

    return (
      <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 28px 0', textAlign: 'center' }}>
          <HairLabel color={s2.accent}>AI · BUILDING YOUR PROTOCOL</HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 36, fontWeight: 300, letterSpacing: '-0.035em', marginTop: 18, lineHeight: 1.1 }}>
            Welcome,<br />{data.name || 'Friend'}.
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 72, fontWeight: 200, color: s2.accent, letterSpacing: '-0.04em', marginTop: 40, lineHeight: 1 }}>
            {pct}<span style={{ fontSize: 18, color: s2.textDim }}>%</span>
          </div>
        </div>

        <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 20px 0' }}>
          {GEN_CHECKLIST.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 0',
                borderBottom: i === GEN_CHECKLIST.length - 1 ? 'none' : `1px solid ${s2.line}`,
              }}>
                {/* 16×16 square checkbox */}
                <div style={{
                  width: 16, height: 16, flexShrink: 0,
                  border: `1px solid ${done || active ? s2.accent : s2.lineStrong}`,
                  background: done ? s2.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M1.5 5 L4 7.5 L8.5 2.5" stroke="#0C0907" strokeWidth="1.8" fill="none" strokeLinecap="square" />
                    </svg>
                  )}
                  {active && <div style={{ width: 6, height: 6, background: s2.accent }} />}
                </div>
                <div style={{
                  flex: 1, fontFamily: s2.mono, fontSize: 11, letterSpacing: '0.18em', fontWeight: 500,
                  color: done ? s2.text : active ? s2.accent : s2.textDimmer,
                }}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ maxWidth: 480, margin: '24px auto 0', padding: '0 20px' }}>
            <div style={{ border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '12px 14px' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.warn, marginBottom: 8 }}>{error}</div>
              <button
                onClick={() => { setGenerating(false); setShowSummary(true); }}
                style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.accent, cursor: 'pointer' }}
              >
                TRY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Summary screen ──────────────────────────────────────────────────────────
  if (showSummary) {
    return (
      <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text, paddingBottom: 120 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 0' }}>
          <HairLabel>REVIEW PROFILE</HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 30, fontWeight: 300, letterSpacing: '-0.025em', marginTop: 8, lineHeight: 1 }}>
            Confirm & Generate
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SummaryCard label="PERSONAL" items={[`${data.name}, ${data.age}y, ${data.gender}`, `${data.city}, ${data.country}`]} onEdit={() => { setShowSummary(false); setStep(1); }} />
            <SummaryCard label="BODY" items={[
              data.targetWeightKg > 0 ? `${data.weightKg}kg → ${data.targetWeightKg}kg` : `${data.weightKg}kg`,
              `Height: ${data.heightCm}cm`,
            ]} onEdit={() => { setShowSummary(false); setStep(2); }} />
            <SummaryCard label="DIET" items={[data.mealPreference, `${data.mealsPerDay} meals/day`, data.cuisinePreferences.join(', ')]} onEdit={() => { setShowSummary(false); setStep(3); }} />
            <SummaryCard label="ALLERGIES" items={[data.allergies.length > 0 ? data.allergies.join(', ') : 'None']} onEdit={() => { setShowSummary(false); setStep(4); }} />
            <SummaryCard label="GOAL" items={[
              data.primaryGoal,
              ...(data.dietIntensity ? [`Intensity: ${data.dietIntensity}`] : []),
              data.activityLevel,
            ]} onEdit={() => { setShowSummary(false); setStep(7); }} />
            <SummaryCard label="LIFESTYLE" items={[
              (data.trainingType && data.trainingType !== 'none')
                ? `Training: ${data.trainingType}${data.trainingDaysPerWeek ? `, ${data.trainingDaysPerWeek}×/wk` : ''}`
                : 'No structured training',
              `${((data.dailySteps ?? 5000) / 1000).toFixed(1).replace('.0', '')}k steps/day · ${data.occupationType?.replace('_', ' ') ?? 'desk job'}`,
              `Sleep: ${data.sleepQuality ?? 'average'} · Stress: ${data.stressLevel ?? 'medium'} · Energy: ${data.energyLevel ?? 'moderate'}`,
            ]} onEdit={() => { setShowSummary(false); setStep(8); }} />
          </div>

          {/* ── Custom instructions ── */}
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: s2.textDimmer, fontWeight: 600, marginBottom: 10,
              fontFamily: s2.mono,
            }}>
              ANYTHING ELSE TO KNOW?
              <span style={{
                fontSize: 10, color: s2.textDimmer, fontWeight: 400,
                letterSpacing: 0, marginLeft: 8, textTransform: 'none',
                opacity: 0.6,
              }}>
                optional
              </span>
            </div>
            <textarea
              value={onboardingCustomInstructions}
              onChange={e => setOnboardingCustomInstructions(e.target.value)}
              placeholder="e.g. I don't eat brinjal. No idli please. Prefer eggs at breakfast on weekdays."
              maxLength={500}
              rows={3}
              style={{
                width: '100%',
                background: s2.surface,
                border: `1px solid ${s2.lineStrong}`,
                padding: '12px 14px',
                color: s2.text,
                fontSize: 14,
                fontFamily: s2.sans,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = s2.accent; }}
              onBlur={e  => { e.currentTarget.style.borderColor = s2.lineStrong; }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <div style={{ fontSize: 11, color: s2.textDimmer, lineHeight: 1.5, fontFamily: s2.sans }}>
                This goes directly to the AI when building your plan.
              </div>
              <div style={{ fontSize: 10, color: s2.textDimmer, fontFamily: s2.mono, opacity: 0.6, flexShrink: 0, marginLeft: 8 }}>
                {onboardingCustomInstructions.length} / 500
              </div>
            </div>
          </div>

          {error && (
            <div style={{ border: `1px solid rgba(255,62,62,0.5)`, background: 'rgba(255,62,62,0.08)', padding: '10px 14px', marginTop: 14 }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.warn }}>{error}</div>
            </div>
          )}
        </div>

        {/* Fixed footer */}
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          background: s2.bg, borderTop: `1px solid ${s2.lineStrong}`,
          padding: '12px 20px max(env(safe-area-inset-bottom, 0px), 16px)',
          zIndex: 20,
        }}>
          <button
            onClick={handleGenerate}
            style={{
              width: '100%', padding: '15px 0', background: s2.accent, border: 'none',
              fontFamily: s2.mono, fontSize: 11, letterSpacing: '0.2em', fontWeight: 600,
              color: s2.bg, cursor: 'pointer', textTransform: 'uppercase', marginBottom: 10,
            }}
          >
            GENERATE MY MEAL PLAN →
          </button>
          <button
            onClick={handleSkip}
            style={{
              width: '100%', padding: '13px 0', background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em',
              color: s2.textDim, cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            SKIP — USE DEFAULT PLAN
          </button>
        </div>
      </div>
    );
  }

  // ── Main step screens ───────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: s2.bg, color: s2.text }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>

        {/* ── Chrome: back btn + step counter + progress segments ── */}
        <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackBtn onClick={() => step > 1 ? setStep(s => s - 1) : undefined} disabled={step <= 1} />
          <HairLabel>STEP {String(step).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}</HairLabel>
          <button
            onClick={logout}
            style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.12em', color: s2.textDimmer, cursor: 'pointer', textTransform: 'uppercase' }}
          >
            EXIT
          </button>
        </div>

        {/* Segment progress bar */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 2, background: i < step ? s2.accent : s2.line }} />
            ))}
          </div>
        </div>

        {/* ── Step content ── */}
        <div ref={scrollRef} style={{ flex: 1, padding: '0 20px 100px', overflowY: 'auto' }}>
          {step === 1 && <StepPersonal data={data} update={update} />}
          {step === 2 && <StepBody data={data} update={update} />}
          {step === 3 && <StepDiet data={data} update={update} toggleArr={toggleArrMax} />}
          {step === 4 && <StepAllergies data={data} toggleArr={toggleArr} update={update} />}
          {step === 5 && <StepPreferred data={data} toggleArr={toggleArr} />}
          {step === 6 && <StepAvoid data={data} toggleArr={toggleArr} update={update} />}
          {step === 7 && <StepGoals data={data} update={update} toggleArr={toggleArr} />}
          {step === 8 && <StepLifestyle data={data} update={update} />}
        </div>

        {/* ── Fixed bottom CTA ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          background: s2.bg, borderTop: `1px solid ${s2.lineStrong}`,
          padding: '12px 20px max(env(safe-area-inset-bottom, 0px), 16px)',
          zIndex: 20,
        }}>
          <button
            onClick={() => {
              const STEP_NAMES: Record<number, string> = {
                1: 'personal', 2: 'body', 3: 'diet', 4: 'allergies',
                5: 'preferred_ingredients', 6: 'avoid_ingredients', 7: 'goals', 8: 'lifestyle',
              };
              track('onboarding_step_completed', { step, step_name: STEP_NAMES[step] ?? String(step) });
              if (step === totalSteps) setShowSummary(true); else setStep(s => s + 1);
            }}
            disabled={!canNext()}
            style={{
              width: '100%', padding: '15px 0',
              background: canNext() ? s2.accent : s2.surface,
              border: canNext() ? 'none' : `1px solid ${s2.line}`,
              fontFamily: s2.mono, fontSize: 11, letterSpacing: '0.2em', fontWeight: 600,
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
  );
}

// ── SummaryCard ────────────────────────────────────────────────────────────────
function SummaryCard({ label, items, onEdit }: { label: string; items: string[]; onEdit: () => void }) {
  return (
    <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <HairLabel>{label}</HairLabel>
        <button onClick={onEdit} style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: s2.accent, cursor: 'pointer' }}>
          EDIT
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: i > 0 ? 4 : 0 }}>{item}</div>
      ))}
    </div>
  );
}

// ── Step 1 · Personal ─────────────────────────────────────────────────────────
function StepPersonal({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [cityManual, setCityManual] = useState(false);
  const [ageStr, setAgeStr] = useState(data.age > 0 ? String(data.age) : '');
  const [allCities, setAllCities] = useState<{ name: string; stateCode?: string }[]>([]);

  // Load cities on demand — `country-state-city` is dynamically imported to keep the
  // Onboarding chunk under the PWA 4 MB precache limit.
  const countryIso = data.countryCode || COUNTRY_CODES[data.country] || '';
  useEffect(() => {
    if (!countryIso) { setAllCities([]); return; }
    let cancelled = false;
    setAllCities([]);
    getCitiesOfCountry(countryIso).then((cities: { name: string; stateCode?: string }[]) => {
      if (!cancelled) setAllCities(cities);
    }).catch(() => { if (!cancelled) setAllCities([]); });
    return () => { cancelled = true; };
  }, [countryIso]);

  const filteredCountries = COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));
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
    <div style={{ paddingTop: 30 }}>
      <HairLabel>WELCOME</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 36 }}>
        What should<br />we call you?
      </div>

      {/* Name */}
      <div style={{ marginBottom: 30 }}>
        <HairLabel style={{ marginBottom: 8 }}>NAME</HairLabel>
        <UnderlineInput
          value={data.name}
          onChange={v => update({ name: v })}
          placeholder="Your name"
        />
      </div>

      {/* Gender */}
      <div style={{ marginBottom: 28 }}>
        <HairLabel style={{ marginBottom: 10 }}>SEX (FOR ENERGY CALCULATIONS)</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { val: 'male',   label: 'MALE' },
            { val: 'female', label: 'FEMALE' },
            { val: 'other',  label: 'OTHER' },
            { val: 'prefer_not_to_say', label: 'SKIP' },
          ].map(g => (
            <SelBtn key={g.val} on={data.gender === g.val} onClick={() => update({ gender: g.val })}
              style={{ padding: '16px 8px', width: '100%' }}>
              {g.label}
            </SelBtn>
          ))}
        </div>
      </div>

      {/* Age */}
      <div style={{ marginBottom: 28 }}>
        <HairLabel style={{ marginBottom: 10 }}>AGE</HairLabel>
        <div style={{ textAlign: 'center' }}>
          <input
            type="text" inputMode="numeric"
            value={ageStr}
            placeholder="28"
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
            style={{
              fontFamily: s2.sans, fontSize: 72, fontWeight: 200,
              color: s2.accent, letterSpacing: '-0.04em', lineHeight: 1,
              background: 'transparent', border: 'none', outline: 'none',
              textAlign: 'center', width: '100%', padding: 0,
            }}
          />
          <HairLabel style={{ marginTop: 4 }}>YEARS</HairLabel>
        </div>
      </div>

      {/* Country */}
      <div style={{ marginBottom: 20 }}>
        <HairLabel style={{ marginBottom: 8 }}>COUNTRY</HairLabel>
        <input
          type="text"
          value={countrySearch !== '' ? countrySearch : data.country}
          onChange={e => setCountrySearch(e.target.value)}
          onFocus={() => setCountrySearch(data.country)}
          placeholder="Search country..."
          style={inputStyle}
        />
        {countrySearch && filteredCountries.length > 0 && (
          <div style={dropdownStyle}>
            {filteredCountries.slice(0, 8).map(c => (
              <button key={c} onClick={() => handleCountrySelect(c)} style={dropdownItemStyle}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* City */}
      <div style={{ marginBottom: 20 }}>
        <HairLabel style={{ marginBottom: 8 }}>CITY</HairLabel>
        {cityManual || allCities.length === 0 ? (
          <>
            <input
              type="text" value={data.city}
              onChange={e => update({ city: e.target.value })}
              disabled={!data.country}
              placeholder={data.country ? 'Type your city' : 'Select a country first'}
              style={{ ...inputStyle, opacity: !data.country ? 0.4 : 1 }}
            />
            {allCities.length > 0 && (
              <button onClick={() => setCityManual(false)} style={linkBtnStyle}>← Search from list</button>
            )}
          </>
        ) : (
          <>
            <input
              type="text"
              value={citySearch !== '' ? citySearch : data.city}
              onChange={e => setCitySearch(e.target.value)}
              onFocus={() => setCitySearch(data.city)}
              disabled={!data.country}
              placeholder={data.country ? 'Search city...' : 'Select a country first'}
              style={{ ...inputStyle, opacity: !data.country ? 0.4 : 1 }}
            />
            {citySearch && filteredCities.length > 0 && (
              <div style={dropdownStyle}>
                {filteredCities.map(c => (
                  <button key={c.name + c.stateCode} onClick={() => { update({ city: c.name }); setCitySearch(''); }} style={dropdownItemStyle}>{c.name}</button>
                ))}
              </div>
            )}
            <button onClick={() => setCityManual(true)} style={linkBtnStyle}>City not listed? Type it manually</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Unit conversion helpers ────────────────────────────────────────────────────
function lbToKg(lb: number): number  { return Math.round(lb * 0.453592 * 10) / 10; }
function kgToLb(kg: number): number  { return Math.round(kg * 2.20462 * 10) / 10; }
function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}
function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 30.48 + inches * 2.54) * 10) / 10;
}

// Inline unit toggle button style — rounded pill, orange when active
function unitBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding:      '3px 10px',
    borderRadius: '20px',
    border:       `0.5px solid ${active ? '#C4713A' : 'rgba(255,255,255,0.12)'}`,
    background:   active ? 'rgba(196,113,58,0.15)' : 'transparent',
    color:        active ? '#C4713A' : 'rgba(255,255,255,0.35)',
    fontSize:     '11px',
    fontWeight:   active ? 700 : 400,
    cursor:       'pointer',
    fontFamily:   'DM Sans, sans-serif',
  };
}

// ── Step 2 · Body ─────────────────────────────────────────────────────────────
function StepBody({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  // Independent unit states — weight and height are decoupled
  const [weightUnit,  setWeightUnit]  = useState<'kg' | 'lb'>('kg');
  const [heightUnit,  setHeightUnit]  = useState<'cm' | 'ftin'>('cm');

  // Weight display strings (kg + lb kept in sync on toggle)
  const [weightStr,    setWeightStr]    = useState(data.weightKg > 0 ? String(data.weightKg) : '');
  const [weightLbStr,  setWeightLbStr]  = useState('');
  const [targetStr,    setTargetStr]    = useState(data.targetWeightKg > 0 ? String(data.targetWeightKg) : '');
  const [targetLbStr,  setTargetLbStr]  = useState('');

  // Height display strings (cm + ft/in kept in sync on toggle)
  const [heightCmStr,  setHeightCmStr]  = useState(data.heightCm > 0 ? String(data.heightCm) : '');
  const [heightFtStr,  setHeightFtStr]  = useState('');
  const [heightInStr,  setHeightInStr]  = useState('');

  // Switch weight unit: convert whatever is typed, update parent with metric
  function handleWeightUnitChange(unit: 'kg' | 'lb') {
    if (unit === weightUnit) return;
    if (unit === 'lb') {
      const wkg = parseFloat(weightStr);
      if (!isNaN(wkg) && wkg > 0) setWeightLbStr(String(kgToLb(wkg)));
      const tkg = parseFloat(targetStr);
      if (!isNaN(tkg) && tkg > 0) setTargetLbStr(String(kgToLb(tkg)));
    } else {
      // lb → kg: convert display and update parent
      const wlb = parseFloat(weightLbStr);
      if (!isNaN(wlb) && wlb > 0) { const kg = lbToKg(wlb); setWeightStr(String(kg)); update({ weightKg: kg }); }
      const tlb = parseFloat(targetLbStr);
      if (!isNaN(tlb) && tlb > 0) { const kg = lbToKg(tlb); setTargetStr(String(kg)); update({ targetWeightKg: kg }); }
    }
    setWeightUnit(unit);
  }

  // Switch height unit: convert whatever is typed, update parent with metric
  function handleHeightUnitChange(unit: 'cm' | 'ftin') {
    if (unit === heightUnit) return;
    if (unit === 'ftin') {
      const cm = parseFloat(heightCmStr);
      if (!isNaN(cm) && cm > 0) {
        const { ft, inches } = cmToFtIn(cm);
        setHeightFtStr(String(ft));
        setHeightInStr(String(inches));
      }
    } else {
      // ft+in → cm: convert display and update parent
      const ft  = parseFloat(heightFtStr || '0');
      const ins = parseFloat(heightInStr || '0');
      if (ft > 0 || ins > 0) { const cm = ftInToCm(ft, ins); setHeightCmStr(String(cm)); update({ heightCm: cm }); }
    }
    setHeightUnit(unit);
  }

  const bmiVal = data.weightKg > 0 && data.heightCm > 0
    ? (data.weightKg / ((data.heightCm / 100) ** 2)).toFixed(1) : null;
  const weightDiff = data.weightKg > 0 && data.targetWeightKg > 0
    ? (data.weightKg - data.targetWeightKg).toFixed(1) : null;

  // Generic handler factory — validates decimal input, calls updater only for valid non-zero numbers
  function numHandler(setter: (s: string) => void, updater: (n: number) => void) {
    return {
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^\d*\.?\d*$/.test(val)) { setter(val); const n = parseFloat(val); if (!isNaN(n) && n > 0) updater(n); }
      },
      onBlur: (val: string) => {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) { setter(String(n)); updater(n); } else { setter(''); updater(0); }
      }
    };
  }

  // Metric handlers — update parent directly
  const wh   = numHandler(setWeightStr,   v => update({ weightKg: v }));
  const hh   = numHandler(setHeightCmStr, v => update({ heightCm: v }));
  const th   = numHandler(setTargetStr,   v => update({ targetWeightKg: v }));

  // Imperial handlers — convert to metric before updating parent
  const wlbH = numHandler(setWeightLbStr, v => update({ weightKg: lbToKg(v) }));
  const tlbH = numHandler(setTargetLbStr, v => update({ targetWeightKg: lbToKg(v) }));

  const handleFtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setHeightFtStr(val);
      const ft = parseFloat(val || '0'); const ins = parseFloat(heightInStr || '0');
      if (ft > 0 || ins > 0) update({ heightCm: ftInToCm(ft, ins) });
    }
  };
  const handleInChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val) && (val === '' || parseInt(val) <= 11)) {
      setHeightInStr(val);
      const ft = parseFloat(heightFtStr || '0'); const ins = parseFloat(val || '0');
      if (ft > 0 || ins > 0) update({ heightCm: ftInToCm(ft, ins) });
    }
  };

  const numInputStyle: React.CSSProperties = {
    fontFamily: s2.sans, fontSize: 46, fontWeight: 200,
    color: s2.accent, letterSpacing: '-0.03em', lineHeight: 1,
    background: 'transparent', border: 'none', outline: 'none',
    marginTop: 10, padding: 0, width: '100%',
  };

  // Shared label row — field name on left, unit toggle pills on right
  function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <HairLabel>{label}</HairLabel>
        <div style={{ display: 'flex', gap: 4 }}>{children}</div>
      </div>
    );
  }

  const ACTIVITY_OPTIONS = [
    { val: 'sedentary',         label: 'SEDENTARY',  desc: 'Desk job, little exercise' },
    { val: 'lightly_active',    label: 'LIGHT',       desc: 'Light exercise 1–3 days/week' },
    { val: 'moderately_active', label: 'MODERATE',    desc: 'Exercise 3–5 days/week' },
    { val: 'very_active',       label: 'ACTIVE',      desc: 'Hard exercise 6–7 days/week' },
  ];

  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>STATS</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 24 }}>
        Your body<br />today.
      </div>

      {/* ── CURRENT WEIGHT — independent kg / lb toggle ── */}
      <div style={{ border: `1px solid ${s2.line}`, padding: 16, marginBottom: 14 }}>
        <LabelRow label="CURRENT WEIGHT">
          {(['kg', 'lb'] as const).map(u => (
            <button key={u} onClick={() => handleWeightUnitChange(u)} style={unitBtnStyle(weightUnit === u)}>{u}</button>
          ))}
        </LabelRow>
        {weightUnit === 'kg' ? (
          <>
            <input type="text" inputMode="decimal" value={weightStr} placeholder="72"
              onChange={wh.onChange} onBlur={() => wh.onBlur(weightStr)} style={numInputStyle} />
            <HairLabel style={{ marginTop: 4 }}>KG</HairLabel>
          </>
        ) : (
          <>
            <input type="text" inputMode="decimal" value={weightLbStr} placeholder="158"
              onChange={wlbH.onChange} onBlur={() => wlbH.onBlur(weightLbStr)} style={numInputStyle} />
            <HairLabel style={{ marginTop: 4 }}>LB</HairLabel>
          </>
        )}
      </div>

      {/* ── HEIGHT — independent cm / ft & in toggle ── */}
      <div style={{ border: `1px solid ${s2.line}`, padding: 16, marginBottom: 14 }}>
        <LabelRow label="HEIGHT">
          {([['cm', 'cm'], ['ftin', 'ft & in']] as const).map(([val, label]) => (
            <button key={val} onClick={() => handleHeightUnitChange(val)} style={unitBtnStyle(heightUnit === val)}>{label}</button>
          ))}
        </LabelRow>
        {heightUnit === 'cm' ? (
          <>
            <input type="text" inputMode="decimal" value={heightCmStr} placeholder="168"
              onChange={hh.onChange} onBlur={() => hh.onBlur(heightCmStr)} style={numInputStyle} />
            <HairLabel style={{ marginTop: 4 }}>CM</HairLabel>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <input type="text" inputMode="numeric" value={heightFtStr} placeholder="5"
                onChange={handleFtChange} style={{ ...numInputStyle, marginTop: 0 }} />
              <HairLabel style={{ marginTop: 4 }}>FT</HairLabel>
            </div>
            <div style={{ flex: 1 }}>
              <input type="text" inputMode="numeric" value={heightInStr} placeholder="8"
                onChange={handleInChange} style={{ ...numInputStyle, marginTop: 0 }} />
              <HairLabel style={{ marginTop: 4 }}>IN</HairLabel>
            </div>
          </div>
        )}
      </div>

      {/* ── TARGET WEIGHT — optional, shares weightUnit with current weight ── */}
      <div style={{ border: `1px solid ${s2.line}`, padding: 16, marginBottom: 20 }}>
        <LabelRow label="TARGET WEIGHT (OPTIONAL)">
          {(['kg', 'lb'] as const).map(u => (
            <button key={u} onClick={() => handleWeightUnitChange(u)} style={unitBtnStyle(weightUnit === u)}>{u}</button>
          ))}
        </LabelRow>
        {weightUnit === 'kg' ? (
          <>
            <input type="text" inputMode="decimal" value={targetStr} placeholder="65"
              onChange={th.onChange} onBlur={() => th.onBlur(targetStr)} style={numInputStyle} />
            <HairLabel style={{ marginTop: 4 }}>KG</HairLabel>
          </>
        ) : (
          <>
            <input type="text" inputMode="decimal" value={targetLbStr} placeholder="143"
              onChange={tlbH.onChange} onBlur={() => tlbH.onBlur(targetLbStr)} style={numInputStyle} />
            <HairLabel style={{ marginTop: 4 }}>LB</HairLabel>
          </>
        )}
      </div>

      {/* BMI / diff row */}
      {bmiVal && weightDiff && (
        <div style={{ background: s2.accentFill, border: `1px solid ${s2.lineStrong}`, padding: '10px 14px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <HairLabel>BMI</HairLabel>
            <HairLabel color={s2.accent}>{bmiVal}</HairLabel>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <HairLabel>{parseFloat(weightDiff) > 0 ? 'TO LOSE' : 'TO GAIN'}</HairLabel>
            <HairLabel color={s2.accent}>
              {weightUnit === 'lb'
                ? `${Math.abs(Math.round(parseFloat(weightDiff) * 2.20462 * 10) / 10)} LB`
                : `${Math.abs(parseFloat(weightDiff))} KG`}
            </HairLabel>
          </div>
        </div>
      )}

      {/* Activity radio list */}
      <HairLabel style={{ marginBottom: 10 }}>ACTIVITY LEVEL</HairLabel>
      {ACTIVITY_OPTIONS.map((o, i) => (
        <div
          key={o.val}
          onClick={() => update({ activityLevel: o.val })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 0',
            borderBottom: i === ACTIVITY_OPTIONS.length - 1 ? 'none' : `1px solid ${s2.line}`,
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: data.activityLevel === o.val ? s2.accent : s2.text }}>{o.label}</div>
            <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 4 }}>{o.desc}</div>
          </div>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: `1px solid ${data.activityLevel === o.val ? s2.accent : s2.lineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {data.activityLevel === o.val && <div style={{ width: 8, height: 8, background: s2.accent, borderRadius: '50%' }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step 3 · Diet ─────────────────────────────────────────────────────────────
function StepDiet({ data, update, toggleArr }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void; toggleArr: (f: keyof OnboardingData, v: string, max: number) => void }) {
  const [cuisineSearch, setCuisineSearch] = useState('');
  const [eatingHoursStr, setEatingHoursStr] = useState(String(data.eatingWindowHours ?? 8));
  const isIF = data.eatingWindow === 'intermittent_fasting';
  const eatingHours = parseInt(eatingHoursStr, 10) || 8;
  const fastingHours = 24 - eatingHours;

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

  const filteredOptions = cuisineSearch
    ? CUISINE_OPTIONS.filter(c => c.label.toLowerCase().includes(cuisineSearch.toLowerCase()))
    : CUISINE_OPTIONS;
  const grouped: Record<string, typeof CUISINE_OPTIONS[number][]> = {};
  filteredOptions.forEach(c => { if (!grouped[c.region]) grouped[c.region] = []; grouped[c.region].push(c); });
  const visibleRegions = cuisineSearch ? Object.keys(grouped) : CUISINE_REGIONS.filter(r => grouped[r]?.length > 0);

  const DIET_OPTIONS = [
    { val: 'non_vegetarian', label: 'NON-VEG' },
    { val: 'vegetarian',     label: 'VEGETARIAN' },
    { val: 'eggetarian',     label: 'EGGETARIAN' },
    { val: 'vegan',          label: 'VEGAN' },
    { val: 'pescatarian',    label: 'PESCATARIAN' },
  ];

  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>DIET</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 30 }}>
        How do<br />you eat?
      </div>

      {/* Diet style grid */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>STYLE</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {DIET_OPTIONS.map(o => (
            <SelBtn key={o.val} on={data.mealPreference === o.val} onClick={() => update({ mealPreference: o.val })}
              style={{ padding: '14px 8px', width: '100%' }}>
              {o.label}
            </SelBtn>
          ))}
        </div>
      </div>

      {/* Cuisine chips */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>CUISINES (PICK UP TO 3)</HairLabel>
        {data.cuisinePreferences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {data.cuisinePreferences.map(c => (
              <button key={c} onClick={() => toggleArr('cuisinePreferences', c, 3)} style={{
                background: s2.accent, border: 'none', color: s2.bg,
                fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.15em', fontWeight: 600,
                padding: '6px 10px', cursor: 'pointer', textTransform: 'uppercase',
              }}>
                {c} ×
              </button>
            ))}
          </div>
        )}
        <input
          type="text" value={cuisineSearch}
          onChange={e => setCuisineSearch(e.target.value)}
          placeholder="Search cuisines..."
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {visibleRegions.map(region => (
            <div key={region} style={{ marginBottom: 10 }}>
              <HairLabel style={{ marginBottom: 6, paddingLeft: 2 }}>{region}</HairLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(grouped[region] || []).map(c => {
                  const sel = data.cuisinePreferences.includes(c.value);
                  const maxed = !sel && data.cuisinePreferences.length >= 3;
                  return (
                    <button key={c.value}
                      onClick={() => !maxed && toggleArr('cuisinePreferences', c.value, 3)}
                      disabled={maxed}
                      style={{
                        background: sel ? s2.accent : 'transparent',
                        border: `1px solid ${sel ? s2.accent : s2.lineStrong}`,
                        color: sel ? s2.bg : maxed ? s2.textDimmer : s2.text,
                        fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 600,
                        padding: '6px 10px', cursor: maxed ? 'default' : 'pointer',
                        textTransform: 'uppercase', opacity: maxed ? 0.5 : 1,
                      }}
                    >{c.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meals per day */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>MEALS PER DAY</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {[3, 4, 5].map(n => (
            <SelBtn key={n} on={data.mealsPerDay === n} onClick={() => update({ mealsPerDay: n })}
              style={{ padding: '14px 8px', width: '100%', fontSize: 14 }}>
              {n}
            </SelBtn>
          ))}
        </div>
      </div>

      {/* Eating Window */}
      <div style={{ marginBottom: 8 }}>
        <HairLabel style={{ marginBottom: 10 }}>EATING WINDOW</HairLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SelBtn on={!isIF} onClick={() => update({ eatingWindow: 'standard', eatingWindowHours: undefined, fastingWindowHours: undefined, eatingStartTime: undefined, eatingEndTime: undefined })}
            style={{ padding: '14px 16px', textAlign: 'left', width: '100%', fontSize: 10 }}>
            STANDARD — NO FASTING WINDOW
          </SelBtn>
          <SelBtn on={isIF} onClick={() => {
            const start = data.eatingStartTime || '07:00';
            const hours = data.eatingWindowHours || 8;
            update({ eatingWindow: 'intermittent_fasting', eatingWindowHours: hours, fastingWindowHours: 24 - hours, eatingStartTime: start, eatingEndTime: calcEndTime(start, hours) });
          }} style={{ padding: '14px 16px', textAlign: 'left', width: '100%', fontSize: 10 }}>
            INTERMITTENT FASTING — CUSTOM WINDOWS
          </SelBtn>
        </div>

        {isIF && (
          <div style={{ marginTop: 8, border: `1px solid ${s2.line}`, background: s2.surface, padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <HairLabel style={{ marginBottom: 6 }}>EATING WINDOW (HRS)</HairLabel>
                <input type="text" inputMode="numeric" value={eatingHoursStr}
                  onChange={e => handleEatingHoursChange(e.target.value)}
                  onBlur={() => { const n = parseInt(eatingHoursStr, 10); if (isNaN(n) || n < 4) { setEatingHoursStr('8'); update({ eatingWindowHours: 8, fastingWindowHours: 16 }); } else if (n > 20) { setEatingHoursStr('20'); } }}
                  style={inputStyle}
                />
              </div>
              <div>
                <HairLabel style={{ marginBottom: 6 }}>FASTING (HRS)</HairLabel>
                <div style={{ ...inputStyle, color: s2.textDimmer, opacity: 0.6 }}>{isNaN(fastingHours) ? '–' : fastingHours}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <HairLabel style={{ marginBottom: 6 }}>START TIME</HairLabel>
                <input type="time" value={data.eatingStartTime || '07:00'}
                  onChange={e => handleStartTimeChange(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <HairLabel style={{ marginBottom: 6 }}>END TIME</HairLabel>
                <div style={{ ...inputStyle, color: s2.textDimmer, opacity: 0.6 }}>{data.eatingEndTime || '–'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 4 · Allergies ────────────────────────────────────────────────────────
function StepAllergies({ data, toggleArr, update }: { data: OnboardingData; toggleArr: (f: keyof OnboardingData, v: string) => void; update: (p: Partial<OnboardingData>) => void }) {
  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>ALLERGIES</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 8 }}>
        Any intolerances?
      </div>
      <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginBottom: 24, lineHeight: 1.5 }}>
        Tap to select any that apply. These are strictly excluded.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24 }}>
        {ALLERGENS.map(a => {
          const selected = data.allergies.includes(a);
          return (
            <button key={a} onClick={() => toggleArr('allergies', a)} style={{
              position: 'relative',
              background: selected ? 'rgba(255,62,62,0.12)' : s2.surface,
              border: `1px solid ${selected ? 'rgba(255,62,62,0.5)' : s2.line}`,
              padding: '16px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: 'pointer',
            }}>
              {selected && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 14, height: 14,
                  background: s2.warn,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>✓</span>
                </div>
              )}
              <span style={{ fontSize: 22, marginBottom: 6 }}>{ALLERGEN_ICONS[a] || '⚠️'}</span>
              <span style={{ fontFamily: s2.sans, fontSize: 11, color: selected ? s2.warn : s2.textDim, textAlign: 'center', lineHeight: 1.2 }}>{a}</span>
            </button>
          );
        })}
      </div>

      <div>
        <HairLabel style={{ marginBottom: 8 }}>OTHER ALLERGIES</HairLabel>
        <input type="text" value={data.allergyOther} onChange={e => update({ allergyOther: e.target.value })}
          placeholder="E.g. citrus, certain spices..." style={inputStyle} />
      </div>
    </div>
  );
}

// ── Step 5 · Preferred ────────────────────────────────────────────────────────
function StepPreferred({ data, toggleArr }: { data: OnboardingData; toggleArr: (f: keyof OnboardingData, v: string) => void }) {
  const count = data.preferredIngredients.length;
  const met = count >= 5;

  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>STAPLES</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 8 }}>
        Ingredients<br />you love.
      </div>

      <div style={{
        background: met ? 'rgba(124,224,196,0.1)' : s2.accentFill,
        border: `1px solid ${met ? 'rgba(124,224,196,0.3)' : s2.lineStrong}`,
        padding: '8px 12px', marginBottom: 24,
      }}>
        <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.18em', color: met ? '#7CE0C4' : s2.accent }}>
          {met ? `${count} SELECTED ✓ — GREAT VARIETY` : `SELECT AT LEAST 5 INGREDIENTS (${count}/5)`}
        </div>
      </div>

      {INGREDIENT_CATEGORIES.map(cat => (
        <div key={cat.name} style={{ marginBottom: 20 }}>
          <HairLabel style={{ marginBottom: 10 }}>{cat.name}</HairLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {cat.items.map(item => {
              const selected = data.preferredIngredients.includes(item);
              return (
                <button key={item} onClick={() => toggleArr('preferredIngredients', item)} style={{
                  position: 'relative',
                  background: selected ? 'rgba(124,224,196,0.1)' : s2.surface,
                  border: `1px solid ${selected ? 'rgba(124,224,196,0.4)' : s2.line}`,
                  padding: '14px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer',
                }}>
                  {selected && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6, width: 14, height: 14,
                      background: '#7CE0C4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: '#0C0907', fontSize: 8, fontWeight: 700 }}>✓</span>
                    </div>
                  )}
                  <span style={{ fontSize: 22, marginBottom: 6 }}>{INGREDIENT_ICONS[item] || '🍽️'}</span>
                  <span style={{ fontFamily: s2.sans, fontSize: 11, color: selected ? '#7CE0C4' : s2.textDim, textAlign: 'center', lineHeight: 1.2 }}>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step 6 · Avoid ────────────────────────────────────────────────────────────
function StepAvoid({ data, toggleArr, update }: { data: OnboardingData; toggleArr: (f: keyof OnboardingData, v: string) => void; update: (p: Partial<OnboardingData>) => void }) {
  const hasSelections = data.avoidIngredients.filter(v => v !== '__none__').length > 0;
  const optedOut = data.avoidNone === true;

  const handleToggle = (item: string) => {
    if (optedOut) update({ avoidNone: false, avoidIngredients: [] });
    toggleArr('avoidIngredients', item);
  };
  const handleOptOut = () => update({ avoidIngredients: ['__none__'], avoidNone: true });

  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>EXCLUDE</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 8 }}>
        Anything to<br />avoid?
      </div>
      <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginBottom: 24, lineHeight: 1.5 }}>
        Select at least one, or confirm you have none.
      </div>

      {optedOut && (
        <div style={{ background: 'rgba(124,224,196,0.1)', border: '1px solid rgba(124,224,196,0.3)', padding: '8px 12px', marginBottom: 16 }}>
          <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.18em', color: '#7CE0C4' }}>
            ✓ NO INGREDIENTS TO AVOID — EVERYTHING INCLUDED
          </div>
        </div>
      )}

      {INGREDIENT_CATEGORIES.map(cat => (
        <div key={cat.name} style={{ marginBottom: 20 }}>
          <HairLabel style={{ marginBottom: 10 }}>{cat.name}</HairLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {cat.items.map(item => {
              const isAllergen = data.allergies.some(a => item.toLowerCase().includes(a.toLowerCase()));
              const selected = data.avoidIngredients.includes(item);
              return (
                <button key={item} onClick={() => !isAllergen && !optedOut && handleToggle(item)}
                  disabled={isAllergen || optedOut}
                  style={{
                    position: 'relative',
                    background: isAllergen ? 'rgba(255,62,62,0.06)' : selected && !optedOut ? 'rgba(255,62,62,0.1)' : s2.surface,
                    border: `1px solid ${isAllergen ? 'rgba(255,62,62,0.3)' : selected && !optedOut ? 'rgba(255,62,62,0.4)' : s2.line}`,
                    padding: '14px 8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    cursor: isAllergen || optedOut ? 'default' : 'pointer',
                    opacity: optedOut && !isAllergen ? 0.4 : 1,
                  }}>
                  {selected && !isAllergen && !optedOut && (
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, background: s2.warn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>✓</span>
                    </div>
                  )}
                  {isAllergen && (
                    <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, background: 'rgba(255,62,62,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 9 }}>⚠</span>
                    </div>
                  )}
                  <span style={{ fontSize: 22, marginBottom: 6 }}>{INGREDIENT_ICONS[item] || '🍽️'}</span>
                  <span style={{ fontFamily: s2.sans, fontSize: 11, color: isAllergen ? 'rgba(255,62,62,0.5)' : selected && !optedOut ? s2.warn : s2.textDim, textAlign: 'center', lineHeight: 1.2 }}>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!hasSelections && (
        <button onClick={handleOptOut} style={{
          width: '100%', padding: '14px 0',
          background: optedOut ? 'rgba(124,224,196,0.1)' : 'transparent',
          border: `1px solid ${optedOut ? 'rgba(124,224,196,0.3)' : s2.lineStrong}`,
          fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.18em', fontWeight: 600,
          color: optedOut ? '#7CE0C4' : s2.textDim,
          cursor: 'pointer', textTransform: 'uppercase', marginBottom: 16,
        }}>
          {optedOut ? '✓ NO INGREDIENTS TO AVOID' : 'I HAVE NO INGREDIENTS TO AVOID →'}
        </button>
      )}

      <div>
        <HairLabel style={{ marginBottom: 8 }}>OTHER INGREDIENTS TO AVOID</HairLabel>
        <input type="text" value={data.avoidOther} onChange={e => update({ avoidOther: e.target.value })}
          placeholder="E.g. bitter gourd, liver..." style={inputStyle} />
      </div>
    </div>
  );
}

// ── Step 7 · Goals ────────────────────────────────────────────────────────────
function StepGoals({ data, update, toggleArr }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void; toggleArr: (f: keyof OnboardingData, v: string) => void }) {
  const GOALS = [
    { val: 'eat_healthy',    label: 'EAT HEALTHY',   desc: 'Balanced daily nutrition from WHO/RDA — no weight target', generic: true },
    { val: 'lose_weight',    label: 'LOSE FAT',       desc: 'Calorie deficit, protein priority, weekly pace', generic: false },
    { val: 'maintain',       label: 'MAINTAIN',       desc: 'Stay at current weight, body recomposition', generic: false },
    { val: 'gain_muscle',    label: 'GAIN MUSCLE',    desc: 'Small calorie surplus, high protein', generic: false },
    { val: 'improve_fitness',label: 'ATHLETIC PERF',  desc: 'Maintenance + energy for training, higher carbs', generic: false },
    { val: 'manage_health',  label: 'MANAGE HEALTH',  desc: 'Condition-specific macros, moderate protein', generic: false },
  ];
  const INTENSITY = [
    { val: 'low',      label: 'GENTLE',     sub: '0.25 kg/w' },
    { val: 'moderate', label: 'STEADY',     sub: '0.5 kg/w' },
    { val: 'high',     label: 'AGGRESSIVE', sub: '0.75 kg/w' },
  ];

  // Intensity is only meaningful for these two goals
  const needsIntensity = ['lose_weight', 'gain_muscle'].includes(data.primaryGoal);

  function selectGoal(val: string) {
    const isDeficitGoal = ['lose_weight', 'gain_muscle'].includes(val);
    update({
      primaryGoal: val,
      // Clear intensity for goals that don't need it; restore a default for those that do
      dietIntensity: isDeficitGoal ? (data.dietIntensity || 'moderate') : '',
    });
  }

  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>GOAL</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 28 }}>
        What are you<br />building toward?
      </div>

      {/* Goal cards */}
      <div style={{ marginBottom: 24 }}>
        {GOALS.map(g => {
          const on = data.primaryGoal === g.val;
          return (
            <div key={g.val} onClick={() => selectGoal(g.val)} style={{
              padding: 18, marginBottom: 8,
              border: `1px solid ${on ? s2.accent : g.generic ? s2.lineStrong : s2.line}`,
              background: on ? s2.accentFill : g.generic ? s2.surface : 'transparent',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500, color: on ? s2.accent : s2.text, letterSpacing: '-0.01em' }}>{g.label}</div>
                <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 4 }}>{g.desc}</div>
              </div>
              {on && <div style={{ color: s2.accent, fontFamily: s2.mono, fontSize: 16, flexShrink: 0 }}>✓</div>}
            </div>
          );
        })}
      </div>

      {/* Plan length 2-col */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>PLAN LENGTH</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { val: 7,  label: '7-DAY'  },
            { val: 14, label: '14-DAY' },
          ].map(o => {
            const on = data.planDuration === o.val;
            return (
              <div key={o.val} onClick={() => { update({ planDuration: o.val }); track('plan_duration_selected', { duration: o.val }); }} style={{
                border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
                background: on ? s2.accentFill : 'transparent',
                padding: 14, cursor: 'pointer',
              }}>
                <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500, color: on ? s2.accent : s2.text }}>{o.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Intensity 3-col — only for lose_weight and gain_muscle */}
      {needsIntensity && (
        <div style={{ marginBottom: 24 }}>
          <HairLabel style={{ marginBottom: 10 }}>PACE</HairLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {INTENSITY.map(x => {
              const on = data.dietIntensity === x.val;
              return (
                <button key={x.val} onClick={() => update({ dietIntensity: x.val })} style={{
                  background: on ? s2.accentFill : 'transparent',
                  border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
                  color: on ? s2.accent : s2.text,
                  padding: '12px 6px', cursor: 'pointer',
                }}>
                  <div style={{ fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.15em' }}>{x.label}</div>
                  <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDim, marginTop: 4 }}>{x.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Training type ── */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>TRAINING TYPE</HairLabel>
        {[
          { val: 'none',      label: 'NO STRUCTURED TRAINING', desc: 'Walking, light activity only' },
          { val: 'strength',  label: 'STRENGTH / GYM',         desc: 'Weight training, resistance work' },
          { val: 'endurance', label: 'ENDURANCE',               desc: 'Running, cycling, swimming' },
          { val: 'crossfit',  label: 'CROSSFIT / HIIT',         desc: 'High-intensity interval training' },
          { val: 'mixed',     label: 'MIXED',                   desc: 'Combination of strength + cardio' },
        ].map(t => {
          const on = (data.trainingType ?? 'none') === t.val;
          return (
            <div key={t.val} onClick={() => update({ trainingType: t.val })} style={{
              padding: '14px 16px', marginBottom: 6,
              border: `1px solid ${on ? s2.accent : s2.line}`,
              background: on ? s2.accentFill : 'transparent',
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: s2.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: on ? s2.accent : s2.text }}>{t.label}</div>
                <div style={{ fontFamily: s2.sans, fontSize: 12, color: s2.textDim, marginTop: 3 }}>{t.desc}</div>
              </div>
              {on && <div style={{ color: s2.accent, fontFamily: s2.mono, fontSize: 14, flexShrink: 0 }}>✓</div>}
            </div>
          );
        })}
      </div>

      {/* Training details — shown when structured training is selected */}
      {(data.trainingType ?? 'none') !== 'none' && (
        <div style={{ border: `1px solid ${s2.line}`, background: s2.surface, padding: 16, marginBottom: 24 }}>
          {/* Training days per week */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <HairLabel>TRAINING DAYS / WEEK</HairLabel>
              <span style={{ fontFamily: s2.mono, fontSize: 13, color: s2.accent, fontWeight: 600 }}>
                {data.trainingDaysPerWeek ?? 3} DAYS
              </span>
            </div>
            <input type="range" min={1} max={7} value={data.trainingDaysPerWeek ?? 3}
              onChange={e => update({ trainingDaysPerWeek: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: s2.accent } as any} />
          </div>

          {/* Session duration pills */}
          <div style={{ marginBottom: 18 }}>
            <HairLabel style={{ marginBottom: 10 }}>SESSION DURATION</HairLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[30, 45, 60, 90].map(mins => {
                const on = (data.trainingDurationMins ?? 45) === mins;
                return (
                  <button key={mins} onClick={() => update({ trainingDurationMins: mins })} style={{
                    background: on ? s2.accentFill : 'transparent',
                    border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
                    color: on ? s2.accent : s2.text,
                    fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.1em',
                    padding: '10px 4px', cursor: 'pointer',
                  }}>
                    {mins}m
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cardio sessions — only for strength/mixed */}
          {['strength', 'mixed'].includes(data.trainingType ?? '') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <HairLabel>CARDIO SESSIONS / WEEK</HairLabel>
                <span style={{ fontFamily: s2.mono, fontSize: 13, color: s2.accent, fontWeight: 600 }}>
                  {data.cardioSessionsPerWeek ?? 0}
                </span>
              </div>
              <input type="range" min={0} max={7} value={data.cardioSessionsPerWeek ?? 0}
                onChange={e => update({ cardioSessionsPerWeek: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: s2.accent } as any} />
            </div>
          )}
        </div>
      )}

      {/* Occupation type */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>OCCUPATION TYPE</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {[
            { val: 'desk_job',     label: 'DESK JOB',     desc: 'Seated most of the day' },
            { val: 'active_job',   label: 'ACTIVE JOB',   desc: 'On feet frequently' },
            { val: 'manual_labour',label: 'MANUAL WORK',  desc: 'Physical labour' },
          ].map(o => {
            const on = (data.occupationType ?? 'desk_job') === o.val;
            return (
              <button key={o.val} onClick={() => update({ occupationType: o.val })} style={{
                background: on ? s2.accentFill : 'transparent',
                border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
                color: on ? s2.accent : s2.text,
                padding: '14px 6px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontFamily: s2.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{o.label}</span>
                <span style={{ fontFamily: s2.sans, fontSize: 10, color: on ? s2.accent : s2.textDim, textAlign: 'center', lineHeight: 1.3 }}>{o.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Health conditions */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>HEALTH CONDITIONS</HairLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {HEALTH_CONDITIONS.map(h => {
            const on = data.healthConditions.includes(h);
            return (
              <button key={h} onClick={() => {
                if (h === 'None') update({ healthConditions: ['None'] });
                else { toggleArr('healthConditions', h); }
              }} style={{
                background: on ? s2.accent : 'transparent',
                border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
                color: on ? s2.bg : s2.text,
                fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 600,
                padding: '7px 12px', cursor: 'pointer', textTransform: 'uppercase',
              }}>
                {h}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wake / sleep */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'WAKE UP', val: data.wakeUpTime, key: 'wakeUpTime' },
          { label: 'SLEEP', val: data.sleepTime, key: 'sleepTime' },
        ].map(t => (
          <div key={t.key}>
            <HairLabel style={{ marginBottom: 6 }}>{t.label}</HairLabel>
            <input type="time" value={t.val} onChange={e => update({ [t.key]: e.target.value } as any)}
              style={{ ...inputStyle, colorScheme: 'dark' }} />
          </div>
        ))}
      </div>

      {/* Cooking style */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>COOKING STYLE</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {[{ val: 'home', label: 'HOME' }, { val: 'mix', label: 'MIX' }, { val: 'outside', label: 'OUTSIDE' }].map(c => (
            <SelBtn key={c.val} on={data.cookingStyle === c.val} onClick={() => update({ cookingStyle: c.val })}
              style={{ padding: '14px 8px', width: '100%', fontSize: 10 }}>
              {c.label}
            </SelBtn>
          ))}
        </div>
      </div>

      {/* Kitchen equipment */}
      <div style={{ marginBottom: 24 }}>
        <HairLabel style={{ marginBottom: 10 }}>KITCHEN EQUIPMENT</HairLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {KITCHEN_EQUIPMENT.map(e => {
            const selected = data.kitchenEquipment.includes(e);
            return (
              <button key={e} onClick={() => toggleArr('kitchenEquipment', e)} style={{
                position: 'relative',
                background: selected ? 'rgba(124,224,196,0.1)' : s2.surface,
                border: `1px solid ${selected ? 'rgba(124,224,196,0.4)' : s2.line}`,
                padding: '14px 8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
              }}>
                {selected && (
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, background: '#7CE0C4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#0C0907', fontSize: 8, fontWeight: 700 }}>✓</span>
                  </div>
                )}
                <span style={{ fontSize: 22, marginBottom: 6 }}>{EQUIPMENT_ICONS[e] || '🔧'}</span>
                <span style={{ fontFamily: s2.sans, fontSize: 11, color: selected ? '#7CE0C4' : s2.textDim, textAlign: 'center', lineHeight: 1.2 }}>{e}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Water intake */}
      <div style={{ marginBottom: 8 }}>
        <HairLabel style={{ marginBottom: 10 }}>WATER INTAKE GOAL</HairLabel>
        <input type="range" min={4} max={16} value={data.waterIntakeGoal}
          onChange={e => update({ waterIntakeGoal: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: s2.accent } as any} />
        <div style={{ fontFamily: s2.mono, fontSize: 13, color: s2.accent, marginTop: 6, fontWeight: 500 }}>
          {data.waterIntakeGoal} GLASSES / DAY
        </div>

        {/* Live unit conversion */}
        {data.waterIntakeGoal > 0 && (
          <>
            <div style={{
              display: 'flex', gap: 12, marginTop: 10,
              padding: '10px 14px',
              background: s2.surface,
              border: `1px solid ${s2.line}`,
              justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: s2.mono, fontSize: 18, fontWeight: 700, color: s2.text }}>
                  {((data.waterIntakeGoal * 250) / 1000).toFixed(1)} L
                </div>
                <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
                  litres
                </div>
              </div>
              <div style={{ width: 1, background: s2.line, alignSelf: 'stretch' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: s2.mono, fontSize: 18, fontWeight: 700, color: s2.text }}>
                  {((data.waterIntakeGoal * 250) / 3785.41).toFixed(2)} gal
                </div>
                <div style={{ fontFamily: s2.mono, fontSize: 9, color: s2.textDimmer, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>
                  gallons
                </div>
              </div>
            </div>
            <div style={{ fontFamily: s2.sans, fontSize: 10, color: s2.textDimmer, textAlign: 'center', marginTop: 5 }}>
              Based on 1 standard glass = 250 ml
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ThreeWaySelector — reusable Low / Average / High toggle ───────────────────
interface ThreeWayOption { val: string; label: string; sub?: string }
function ThreeWaySelector({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: ThreeWayOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <HairLabel style={{ marginBottom: 10 }}>{label}</HairLabel>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length},1fr)`, gap: 6 }}>
        {options.map(o => {
          const on = value === o.val;
          return (
            <button key={o.val} onClick={() => onChange(o.val)} style={{
              background: on ? s2.accentFill : 'transparent',
              border: `1px solid ${on ? s2.accent : s2.lineStrong}`,
              color: on ? s2.accent : s2.text,
              padding: '12px 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontFamily: s2.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase' }}>{o.label}</span>
              {o.sub && <span style={{ fontFamily: s2.sans, fontSize: 10, color: on ? s2.accent : s2.textDim }}>{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 8 · Lifestyle & Wellbeing ────────────────────────────────────────────
function StepLifestyle({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  const steps = data.dailySteps ?? 5000;

  function stepsLabel(s: number): string {
    if (s < 3000)  return 'Very low — below sedentary';
    if (s < 5000)  return 'Low — sedentary range';
    if (s < 8000)  return 'Moderate — lightly active';
    if (s < 12000) return 'Active — meets daily target';
    return 'Very active — highly mobile';
  }

  return (
    <div style={{ paddingTop: 30 }}>
      <HairLabel>LIFESTYLE</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 34, fontWeight: 300, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.1, marginBottom: 8 }}>
        Daily habits<br />&amp; wellbeing.
      </div>
      <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginBottom: 28, lineHeight: 1.5 }}>
        These fine-tune your calorie target and guide meal composition.
      </div>

      {/* Daily steps slider */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <HairLabel>DAILY STEPS</HairLabel>
          <span style={{ fontFamily: s2.mono, fontSize: 13, color: s2.accent, fontWeight: 600 }}>
            {steps >= 1000 ? `${(steps / 1000).toFixed(1).replace('.0', '')}k` : steps}
          </span>
        </div>
        <input
          type="range" min={1000} max={20000} step={500}
          value={steps}
          onChange={e => update({ dailySteps: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: s2.accent } as any}
        />
        <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDim, marginTop: 6 }}>
          {stepsLabel(steps)}
        </div>
      </div>

      {/* ── Group B — wellbeing selectors (Claude prompt context) ── */}
      <div style={{
        border: `1px solid ${s2.line}`, background: s2.surface,
        padding: '16px 14px', marginBottom: 28,
      }}>
        <HairLabel style={{ marginBottom: 16 }}>WELLBEING — informs meal suggestions, not calorie targets</HairLabel>

        <ThreeWaySelector
          label="SLEEP QUALITY"
          value={data.sleepQuality ?? 'average'}
          options={[
            { val: 'poor',    label: 'POOR',    sub: '< 6 hrs' },
            { val: 'average', label: 'AVERAGE', sub: '6–8 hrs' },
            { val: 'good',    label: 'GOOD',    sub: '8+ hrs' },
          ]}
          onChange={v => update({ sleepQuality: v })}
        />

        <ThreeWaySelector
          label="STRESS LEVEL"
          value={data.stressLevel ?? 'medium'}
          options={[
            { val: 'low',    label: 'LOW' },
            { val: 'medium', label: 'MEDIUM' },
            { val: 'high',   label: 'HIGH' },
          ]}
          onChange={v => update({ stressLevel: v })}
        />

        <ThreeWaySelector
          label="RECOVERY CAPACITY"
          value={data.recoveryCapacity ?? 'average'}
          options={[
            { val: 'poor',      label: 'POOR',      sub: 'Often sore' },
            { val: 'average',   label: 'AVERAGE',   sub: 'Normal' },
            { val: 'excellent', label: 'EXCELLENT',  sub: 'Recovers fast' },
          ]}
          onChange={v => update({ recoveryCapacity: v })}
        />

        <ThreeWaySelector
          label="HUNGER LEVEL"
          value={data.hungerLevel ?? 'medium'}
          options={[
            { val: 'low',    label: 'LOW',    sub: 'Rarely hungry' },
            { val: 'medium', label: 'MEDIUM', sub: 'Normal' },
            { val: 'high',   label: 'HIGH',   sub: 'Often hungry' },
          ]}
          onChange={v => update({ hungerLevel: v })}
        />

        <ThreeWaySelector
          label="ENERGY LEVEL"
          value={data.energyLevel ?? 'moderate'}
          options={[
            { val: 'low',      label: 'LOW',      sub: 'Fatigued' },
            { val: 'moderate', label: 'MODERATE', sub: 'Normal' },
            { val: 'high',     label: 'HIGH',     sub: 'Energised' },
          ]}
          onChange={v => update({ energyLevel: v })}
        />
      </div>

      {/* Insulin sensitivity — TDEE macro redistribution (Group A) */}
      <ThreeWaySelector
        label="INSULIN SENSITIVITY"
        value={data.insulinSensitivity ?? 'average'}
        options={[
          { val: 'poor',    label: 'POOR',    sub: 'Insulin resistant' },
          { val: 'average', label: 'AVERAGE', sub: 'Typical' },
          { val: 'good',    label: 'GOOD',    sub: 'Sensitive' },
        ]}
        onChange={v => update({ insulinSensitivity: v })}
      />
      <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDim, marginTop: -12, marginBottom: 8, lineHeight: 1.5 }}>
        Adjusts carb ↔ fat ratio in your macro targets. When unsure, leave at Average.
      </div>
    </div>
  );
}

// ── Shared style objects ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%',
  background: s2.surface,
  border: `1px solid ${s2.line}`,
  fontFamily: s2.sans, fontSize: 14,
  color: s2.text,
  padding: '11px 12px',
  outline: 'none',
  boxSizing: 'border-box',
};

const dropdownStyle: React.CSSProperties = {
  background: s2.surface,
  border: `1px solid ${s2.lineStrong}`,
  marginTop: 2,
  maxHeight: 160,
  overflowY: 'auto',
  zIndex: 10,
  position: 'relative',
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '10px 12px',
  fontFamily: s2.sans, fontSize: 13, color: s2.text,
  background: 'transparent', border: 'none', cursor: 'pointer',
  borderBottom: `1px solid ${s2.line}`,
};

const linkBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none',
  fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.12em',
  color: s2.accent, cursor: 'pointer', marginTop: 6,
  textTransform: 'uppercase',
};
