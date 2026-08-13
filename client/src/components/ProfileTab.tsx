// ProfileTab — Strain v2 visual. All logic, hooks, API calls and sub-components preserved.

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { apiUrl, getBearerToken, streamSSE } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { useWeightStore } from '../store/weightStore';
import { useUnitsStore } from '../store/unitsStore';
import { MealPlanCustomiser } from './MealPlanCustomiser';
import { PlanReviewScreen } from './PlanReviewScreen';
import { WeightStatsHeader } from './weight/WeightStatsHeader';
import { GoalProjectionCard } from './weight/GoalProjectionCard';
import { WeightProgressChart } from './weight/WeightProgressChart';
import { WeightLogModal } from './weight/WeightLogModal';
import { WeightLogList } from './weight/WeightLogList';
import { ErrorBoundary } from './ErrorBoundary';
import { NotificationSettings } from './NotificationSettings';
import { s2 } from '../theme/tokens';
import { HairLabel, Card, Btn } from './ui';
import { track, trackPage } from '../lib/analytics';
import { notifyNewPlanReady } from '../lib/notifications';

const APP_VERSION = '1.0.0';
const APP_STORE_URL = 'https://apps.apple.com/app/id6747787745';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dietplan.tracker';

// ── Plan history item type ──────────────────────────────────────────────────
interface PlanHistoryItem {
  id: string;
  generatedAt: string;
  planDuration: number;
  weekStartDate: string;
  isActive: boolean;
  reviewConfirmed: boolean;
  weekSummary: { avgCalories?: number; avgProtein?: number };
}

// ── ProfileTab ─────────────────────────────────────────────────────────────
export function ProfileTab() {
  const { user, logout, refreshUser } = useAuth();
  const { profile, setProfile, setActiveTab } = useAppStore();
  const { unit, setUnit, toDisplay } = useUnitsStore();
  const [regenerating, setRegenerating] = useState(false);
  const [regenStep, setRegenStep] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showPlanReview, setShowPlanReview] = useState(false);
  const [reviewMealPlanId, setReviewMealPlanId] = useState<string>('active');
  const [error, setError] = useState('');
  const [mealInstructions, setMealInstructions] = useState('');
  const [planDuration, setPlanDuration] = useState<7 | 14>(7);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [genUsage, setGenUsage] = useState<{ used: number; limit: number; remaining: number; resetsOn: string } | null>(null);
  const instructionsRef = useRef('');
  const { fetchLogs, fetchProjection } = useWeightStore();

  // Account deletion state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const deletePasswordRef = useRef<HTMLInputElement>(null);

  // Analytics opt-in/opt-out (default false — explicit consent required by App Store / Play Store rules)
  const [analyticsOptedIn, setAnalyticsOptedIn] = useState(() => {
    const stored = localStorage.getItem('analytics_opted_in');
    return stored !== null ? stored === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('analytics_opted_in', String(analyticsOptedIn));
  }, [analyticsOptedIn]);

  useEffect(() => {
    trackPage('body_tab');
    axios.get('/api/profile', { withCredentials: true })
      .then(res => {
        if (res.data.profile) {
          setProfile(res.data.profile);
          const saved = res.data.profile.mealPlanCustomInstructions || '';
          setMealInstructions(saved);
          instructionsRef.current = saved;
          if (res.data.profile.planDuration === 14) setPlanDuration(14);
          else setPlanDuration(7);
        }
      })
      .catch(() => {});
    fetchLogs();
    fetchProjection();
    // Fetch plan history — non-critical, ignore errors
    axios.get('/api/plan/history', { withCredentials: true })
      .then(res => { if (res.data.plans) setPlanHistory(res.data.plans); })
      .catch(() => {});
    // Fetch generation usage — non-critical
    axios.get('/api/plan/generation-usage', { withCredentials: true })
      .then(res => setGenUsage(res.data))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInstructionsChange = (text: string) => {
    setMealInstructions(text);
    instructionsRef.current = text;
  };

  const handlePlanDurationChange = async (duration: 7 | 14) => {
    setPlanDuration(duration);
    try {
      await axios.patch('/api/profile/plan-duration', { planDuration: duration }, { withCredentials: true });
    } catch {}
  };

  const handleRegenerateClick = () => setShowConfirm(true);

  const handleRegenerate = async () => {
    setShowConfirm(false);
    setRegenerating(true);
    setError('');
    track('plan_regeneration_started', {
      plan_duration:                planDuration,
      has_custom_instructions:      mealInstructions.trim().length > 0,
      custom_instructions_length:   mealInstructions.trim().length,
      generations_used_this_month:  genUsage?.used ?? 0,
    });
    try {
      setRegenStep('Generating your new meal plan...');
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl('/api/ai/generate-meal-plan'));
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.withCredentials = true;
        // Native (Capacitor) has no cross-origin auth cookie — attach the Bearer
        // token like the axios interceptor does, or this request is unauthenticated (401).
        { const _bt = getBearerToken(); if (_bt) xhr.setRequestHeader('Authorization', `Bearer ${_bt}`); }
        xhr.timeout = 300000; // 5 min — matches Vercel maxDuration; 180s was too short for worst-case CN pipeline
        let processed = 0;
        let settled = false;
        const parseSSE = () => {
          const text = xhr.responseText.substring(processed);
          processed = xhr.responseText.length;
          const blocks = text.split('\n\n');
          for (const block of blocks) {
            const eventMatch = block.match(/^event: (\w+)/);
            const dataMatch  = block.match(/^data: (.+)$/m);
            if (!eventMatch || !dataMatch) continue;
            try {
              const parsed = JSON.parse(dataMatch[1]);
              if (eventMatch[1] === 'progress' && !settled) setRegenStep(parsed.step);
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
              try { reject(new Error(JSON.parse(xhr.responseText).error || 'Failed')); }
              catch { reject(new Error('Failed to regenerate')); }
            } else { reject(new Error('No response received')); }
          }
        };
        xhr.onerror  = () => { if (!settled) reject(new Error('Network error')); };
        xhr.ontimeout = () => { if (!settled) reject(new Error('Request timed out')); };
        xhr.send('{}');
      });
      if (!result?.success) throw new Error('Failed');

      // Phase 2 — macro validation in a clean invocation (CN ~28/28). Non-fatal.
      if (result?.needsValidation && result?.mealPlanId) {
        try {
          setRegenStep('Validating meal macros...');
          await streamSSE('/api/ai/validate-plan', { mealPlanId: result.mealPlanId }, setRegenStep);
        } catch { /* raw plan still usable with Claude estimates */ }
      }

      setRegenStep('Done!');
      setRegenerating(false);
      // Refresh plan history + usage in background after regeneration
      axios.get('/api/plan/history', { withCredentials: true })
        .then(res => { if (res.data.plans) setPlanHistory(res.data.plans); })
        .catch(() => {});
      axios.get('/api/plan/generation-usage', { withCredentials: true })
        .then(res => setGenUsage(res.data))
        .catch(() => {});
      // Clear custom instructions only on success — not in finally (must not clear on failure)
      setMealInstructions('');
      instructionsRef.current = '';
      // Show plan review screen instead of the old success screen
      setReviewMealPlanId(result?.mealPlanId || 'active');
      setShowPlanReview(true);
      void notifyNewPlanReady();
    } catch (err: any) {
      setError(err?.message || 'Failed to regenerate');
      setRegenerating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { setDeleteError('Enter your password'); deletePasswordRef.current?.focus(); return; }
    setDeleteError('');
    setDeleteDeleting(true);
    try {
      const res = await axios.delete('/api/auth/delete-account', { data: { password: deletePassword }, withCredentials: true });
      if (res.data.success) logout();
      else setDeleteError(res.data.error || 'Failed to delete account');
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || 'Network error');
    } finally {
      setDeleteDeleting(false);
    }
  };

  // ── Share & rate helpers ───────────────────────────────────────────────
  const handleShare = async () => {
    const shareData = {
      title: 'Plan Your Plate',
      text: 'AI-powered meal planning that actually works 🥗 Check it out!',
      url: APP_STORE_URL,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        track('app_shared', { method: 'native_share' });
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        track('app_shared', { method: 'clipboard' });
      }
    } catch { /* user cancelled */ }
  };

  const handleRate = () => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const url = isAndroid ? PLAY_STORE_URL : APP_STORE_URL;
    window.open(url, '_blank', 'noopener');
    track('rate_app_tapped', { platform: isAndroid ? 'android' : 'ios' });
  };

  // ── Plan review screen — shown after re-generation ────────────────────
  if (showPlanReview) {
    return (
      <PlanReviewScreen
        mealPlanId={reviewMealPlanId}
        onComplete={async () => {
          await refreshUser();
          setShowPlanReview(false);
          setActiveTab('meals');
        }}
      />
    );
  }

  // ── Regenerating screen ────────────────────────────────────────────────
  if (regenerating) {
    return (
      <div style={{ background: s2.bg, minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 280, width: '100%' }}>
          <HairLabel style={{ marginBottom: 16 }}>REGENERATING</HairLabel>
          <div style={{ fontFamily: s2.sans, fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text, marginBottom: 12 }}>
            Building your plan
          </div>
          <div style={{ fontFamily: s2.mono, fontSize: 11, color: s2.accent, letterSpacing: '0.1em', marginBottom: 24, minHeight: 18 }}>
            {regenStep}
          </div>
          {/* Shimmer bar */}
          <div style={{ height: 2, background: s2.line, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: '-60%', height: '100%', width: '60%',
              background: `linear-gradient(90deg, transparent, ${s2.accentFill}, transparent)`,
              animation: 'shimmer 1.4s infinite',
            }} />
          </div>
          {error && (
            <div style={{ marginTop: 20, borderRadius: 18, border: `1px solid ${s2.warn}`, padding: 14, background: 'rgba(229,72,77,0.08)' }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.warn }}>{error}</div>
              <button
                onClick={() => setRegenerating(false)}
                style={{ background: 'transparent', border: 'none', fontFamily: s2.mono, fontSize: 9, color: s2.accent, cursor: 'pointer', letterSpacing: '0.15em', marginTop: 8 }}
              >
                BACK
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const initials = (user?.name || user?.username || 'U').substring(0, 2).toUpperCase();
  const hasInstructions = mealInstructions.trim().length > 0;

  return (
    <div style={{ background: s2.bg, minHeight: '100%', color: s2.text, paddingBottom: 90 }}>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0' }}>
        <HairLabel>YOUR BODY</HairLabel>
        <div style={{ fontFamily: s2.disp, fontSize: 32, fontWeight: 700, letterSpacing: '-0.042em', marginTop: 6, lineHeight: 1.02 }}>
          Profile
        </div>
      </div>

      <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Success banner */}
        {showBanner && (
          <div style={{
            background: s2.accentFill,
            borderRadius: s2.rMd,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <HairLabel color={s2.ink}>PLAN UPDATED WITH YOUR CHANGES</HairLabel>
            <button
              onClick={() => setShowBanner(false)}
              style={{ background: 'transparent', border: 'none', color: s2.textDim, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
        )}

        <HairLabel style={{ marginTop: 8 }}>YOU</HairLabel>
        {/* ── User card ──────────────────────────────────────────────────── */}
        <Card padding={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {user?.avatar ? (
              <img src={user.avatar} alt="" style={{ width: 50, height: 50, borderRadius: s2.rPill, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 50,
                height: 50,
                borderRadius: s2.rPill,
                background: s2.accentFill,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontFamily: s2.sans,
                fontSize: 16,
                fontWeight: 600,
                color: s2.accent,
              }}>
                {initials}
              </div>
            )}
            <div>
              <div style={{ fontFamily: s2.sans, fontSize: 16, fontWeight: 500, color: s2.text }}>
                {user?.name || user?.username}
              </div>
              <HairLabel style={{ marginTop: 3 }}>{user?.email || `@${user?.username}`}</HairLabel>
            </div>
          </div>
        </Card>

        {/* ── Body stats ─────────────────────────────────────────────────── */}
        {profile && (
          <>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <HairLabel>BODY STATS</HairLabel>
                {/* Units toggle */}
                {/* Pill segmented control: sunken track, dark active pill with
                    lime label (ref: V3Profile). Was two square bordered buttons. */}
                <div style={{
                  display: 'flex', gap: 5,
                  background: 'rgba(15,20,15,0.06)',
                  borderRadius: s2.rPill, padding: 3,
                }}>
                  {(['kg', 'lbs'] as const).map((u) => (
                    <button key={u} onClick={() => setUnit(u)} style={{
                      border: 'none', cursor: 'pointer',
                      borderRadius: s2.rPill, padding: '5px 13px',
                      background: unit === u ? s2.ink : 'transparent',
                      color: unit === u ? s2.accentFill : s2.textDim,
                      fontFamily: s2.sans, fontSize: 9.5, fontWeight: 800,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>{u}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                <StatCard label="CURRENT" value={`${toDisplay(profile.weightKg)}`} unit={unit} />
                <StatCard label="TARGET" value={`${toDisplay(profile.targetWeightKg)}`} unit={unit} accent />
                <StatCard label="BMI" value={`${profile.bmi}`} unit="" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                <DataPair label="GOAL" value={profile.primaryGoal.replace(/_/g, ' ')} />
                <DataPair label="INTENSITY" value={profile.dietIntensity} />
              </div>
              <div style={{ marginTop: 10 }}>
                <GoalProjectionCard />
              </div>
            </div>

            {/* ── Weight tracking ──────────────────────────────────────────── */}
            <WeightStatsHeader />
            <ErrorBoundary>
              <WeightProgressChart />
            </ErrorBoundary>
            <WeightLogList />

            {/* ── Daily nutrition targets ──────────────────────────────────── */}
            <div>
              <HairLabel style={{ marginBottom: 8 }}>DAILY TARGETS</HairLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                <NutrientCard label="KCAL" value={Math.round(profile.targetCalories)} color={s2.text} />
                <NutrientCard label="PRO" value={`${Math.round(profile.proteinTarget)}g`} color={s2.protein} />
                <NutrientCard label="CARB" value={`${Math.round(profile.carbTarget)}g`} color={s2.carbs} />
                <NutrientCard label="FAT" value={`${Math.round(profile.fatTarget)}g`} color={s2.fat} />
                <NutrientCard label="FBRE" value={`${Math.round(profile.fibreTarget)}g`} color={s2.fibre} />
              </div>
            </div>

            {/* ── Preferences ─────────────────────────────────────────────── */}
            <Card padding={14}>
              <HairLabel style={{ marginBottom: 10 }}>PREFERENCES</HairLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PrefsRow label="DIET" value={profile.mealPreference?.replace(/_/g, ' ')} />
                <PrefsRow label="CUISINES" value={(profile.cuisinePreferences || []).join(', ')} />
                <PrefsRow label="MEALS/DAY" value={String(profile.mealsPerDay)} />
                <PrefsRow label="ACTIVITY" value={profile.activityLevel?.replace(/_/g, ' ')} />
              </div>
            </Card>
          </>
        )}

        <HairLabel style={{ marginTop: 8 }}>YOUR PLAN</HairLabel>
        {/* ── Plan duration ──────────────────────────────────────────────── */}
        <div>
          <HairLabel style={{ marginBottom: 8 }}>PLAN DURATION</HairLabel>
          <HairLabel color={s2.textDimmer} style={{ marginBottom: 10, fontSize: 8 }}>
            CHANGES TAKE EFFECT ON NEXT REGENERATION
          </HairLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([7, 14] as const).map(d => {
              const active = planDuration === d;
              return (
                <button
                  key={d}
                  onClick={() => handlePlanDurationChange(d)}
                  style={{
                    borderRadius: 20,
                    padding: '15px 14px',
                    border: 'none',
                    background: active ? s2.accentFill : s2.surface,
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                  }}
                >
                  {/* Dark chip riding the top edge, lime label (ref: V3Profile).
                      Was a lime-on-lime chip flush inside the border. */}
                  {d === 14 && (
                    <div style={{
                      position: 'absolute',
                      top: -8,
                      right: 10,
                      background: s2.ink,
                      borderRadius: s2.rPill,
                      fontFamily: s2.sans,
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      color: s2.accentFill,
                      padding: '3px 8px',
                      textTransform: 'uppercase',
                    }}>
                      REC
                    </div>
                  )}
                  <div style={{ fontFamily: s2.sans, fontSize: 15, fontWeight: 700, color: s2.ink, marginBottom: 3 }}>
                    {d}-Day Plan
                  </div>
                  <HairLabel color={active ? 'rgba(15,20,15,0.5)' : s2.textDimmer}>
                    {d === 7 ? 'ONE WEEK' : 'MAX VARIETY'}
                  </HairLabel>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Plan History ─────────────────────────────────────────────────── */}
        {planHistory.length > 1 && (
          <div>
            <HairLabel style={{ marginBottom: 8 }}>PLAN HISTORY</HairLabel>
            <HairLabel color={s2.textDimmer} style={{ marginBottom: 10, fontSize: 8 }}>
              YOUR TRACKING DATA IS PRESERVED ACROSS ALL PLANS
            </HairLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {planHistory.map((plan, idx) => (
                <PlanHistoryRow key={plan.id} plan={plan} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* ── Meal Plan Customiser ────────────────────────────────────────── */}
        {/* Generation usage indicator */}
        {genUsage && (
          <div>
            <div style={{
              borderRadius: 18,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 14px',
              background: s2.surface,
              marginBottom: 8,
            }}>
              <HairLabel>PLAN REGENERATIONS THIS MONTH</HairLabel>
              <span style={{
                fontFamily: s2.mono, fontSize: 11, fontWeight: 600,
                color: genUsage.remaining === 0 ? s2.warn
                     : genUsage.remaining === 1 ? '#F0B429'
                     : s2.accent,
              }}>
                {genUsage.used} / {genUsage.limit} USED
              </span>
            </div>
            {genUsage.remaining === 0 && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 18,
                background: 'rgba(229,72,77,0.07)',
                border: `1px solid rgba(229,72,77,0.25)`,
                marginBottom: 8,
                fontFamily: s2.sans, fontSize: 12,
                color: s2.warn, textAlign: 'center',
              }}>
                Monthly limit reached. Resets on {genUsage.resetsOn}.
              </div>
            )}
          </div>
        )}
        <MealPlanCustomiser
          initialValue={mealInstructions}
          onInstructionsChange={handleInstructionsChange}
          onRegenerate={genUsage?.remaining === 0
          ? () => { track('plan_regeneration_limit_hit', { generations_used: genUsage!.used, limit: genUsage!.limit }); }
          : handleRegenerateClick}
          isRegenerating={regenerating}
          disabled={genUsage?.remaining === 0}
        />

        {/* ── Logout ─────────────────────────────────────────────────────── */}
        <button
          onClick={logout}
          style={{
            width: '100%',
            background: 'transparent',
            borderRadius: s2.rPill,
            border: `1px solid rgba(229,72,77,0.3)`,
            padding: '13px 0',
            fontFamily: s2.mono,
            fontSize: 10,
            letterSpacing: '0.2em',
            color: s2.warn,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          LOGOUT
        </button>

        <div style={{ height: 12 }} />

        {/* ── Delete Account ──────────────────────────────────────────────── */}
        {deleteConfirm ? (
          <div style={{
            borderRadius: 18, border: `1px solid rgba(229,72,77,0.3)`, padding: 14,
            fontFamily: s2.sans, fontSize: 13, color: s2.text,
          }}>
            <div style={{ marginBottom: 10, lineHeight: 1.4 }}>
              This permanently deletes all your data including meal plans, logs, and profile.
              This cannot be undone.
            </div>
            <input
              ref={deletePasswordRef}
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              style={{
                borderRadius: s2.rMd,
                width: '100%', padding: '10px 12px', marginBottom: 10,
                background: s2.bg, border: `1px solid ${s2.line}`,
                fontFamily: s2.sans, fontSize: 13, color: s2.text,
                outline: 'none',
              }}
            />
            {deleteError && (
              <div style={{ color: s2.warn, fontSize: 12, marginBottom: 8 }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDeleteAccount} disabled={deleteDeleting} style={{
                flex: 1, padding: '10px 0', borderRadius: s2.rPill, background: s2.warn, border: 'none',
                fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.2em', color: '#fff',
                cursor: 'pointer', opacity: deleteDeleting ? 0.6 : 1,
              }}>
                {deleteDeleting ? 'DELETING...' : 'DELETE MY ACCOUNT'}
              </button>
              <button onClick={() => { setDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }} style={{
                borderRadius: s2.rMd,
                flex: 1, padding: '10px 0', background: 'transparent', border: `1px solid ${s2.line}`,
                fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.2em', color: s2.textDim,
                cursor: 'pointer',
              }}>
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            style={{
              borderRadius: s2.rMd,
              width: '100%',
              background: 'transparent',
              border: `1px solid ${s2.line}`,
              padding: '13px 0',
              fontFamily: s2.mono,
              fontSize: 10,
              letterSpacing: '0.2em',
              color: s2.textDim,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            DELETE ACCOUNT
          </button>
        )}

        <div style={{ height: 12 }} />

        <HairLabel style={{ marginTop: 8 }}>APP</HairLabel>
        {/* ── Notifications ───────────────────────────────────────────────── */}
        <div>
          <HairLabel style={{ marginBottom: 8 }}>NOTIFICATIONS</HairLabel>
          <NotificationSettings />
        </div>

        <div style={{ height: 4 }} />

        {/* ── Rate & Share ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={handleRate} style={{
            borderRadius: s2.rMd,
            padding: '13px 0', border: `1px solid ${s2.lineStrong}`,
            background: s2.surface, cursor: 'pointer', fontFamily: s2.mono,
            fontSize: 9, letterSpacing: '0.15em', color: s2.text,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            RATE THE APP
          </button>
          <button onClick={handleShare} style={{
            borderRadius: s2.rMd,
            padding: '13px 0', border: `1px solid ${s2.lineStrong}`,
            background: s2.surface, cursor: 'pointer', fontFamily: s2.mono,
            fontSize: 9, letterSpacing: '0.15em', color: s2.text,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 18 }}>🔗</span>
            TELL A FRIEND
          </button>
        </div>

        <div style={{ height: 4 }} />

        {/* ── Analytics toggle ────────────────────────────────────────────── */}
        <div style={{
          borderRadius: s2.rMd,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: `1px solid ${s2.line}`,
        }}>
          <div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.text }}>Usage Analytics</div>
            <div style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer, marginTop: 2 }}>
              Anonymous usage data to improve the app
            </div>
          </div>
          <button
            onClick={() => setAnalyticsOptedIn(!analyticsOptedIn)}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none',
              background: analyticsOptedIn ? s2.accentFill : s2.line,
              cursor: 'pointer', position: 'relative', transition: 'background 200ms',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: analyticsOptedIn ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 200ms',
            }} />
          </button>
        </div>

        <HairLabel style={{ marginTop: 8 }}>ABOUT & LEGAL</HairLabel>
        {/* ── AI & Medical Disclaimer ─────────────────────────────────────── */}
        <div style={{
          marginBottom: 12, padding: '13px 14px',
          borderRadius: 18,
          border: `1px solid ${s2.line}`,
          background: s2.butter + '2E',
          fontFamily: s2.sans, fontSize: 11, lineHeight: 1.55, color: s2.textDimmer,
        }}>
          <strong style={{ color: s2.accent }}>AI Disclaimer:</strong> Meal plans are
          AI-generated and for informational purposes only. Not a substitute for
          professional medical advice. Consult a healthcare provider before starting
          any diet program.
        </div>

        <div style={{ height: 12 }} />

        {/* ── Legal links ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <a
            href={apiUrl('/privacy')}
            target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}
          >
            Privacy Policy
          </a>
          <span style={{ color: s2.line }}>|</span>
          <a
            href={apiUrl('/terms')}
            target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}
          >
            Terms of Service
          </a>
        </div>

        {/* ── App version ─────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', paddingBottom: 4 }}>
          <div style={{ fontFamily: s2.mono, fontSize: 10, color: s2.textDimmer, letterSpacing: '0.1em' }}>
            PLANYOURPLATE v{APP_VERSION}
          </div>
        </div>

        <div style={{ height: 16 }} />
      </div>

      {/* ── Confirm regen dialog ────────────────────────────────────────── */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 20,
        }}>
          <div style={{
            borderRadius: s2.rMd,
            background: s2.surface,
            border: `1px solid ${s2.lineStrong}`,
            padding: 24,
            maxWidth: 340,
            width: '100%',
          }}>
            {hasInstructions ? (
              <>
                <HairLabel style={{ marginBottom: 10 }}>REGENERATE WITH CHANGES</HairLabel>
                <div style={{ fontFamily: s2.sans, fontSize: 15, color: s2.text, marginBottom: 10 }}>
                  Apply your custom instructions?
                </div>
                <div style={{
 borderRadius: s2.rMd, border: `1px solid ${s2.line}`, background: s2.surface2, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{mealInstructions.trim()}"
                  </div>
                </div>
                <HairLabel color={s2.textDimmer} style={{ marginBottom: 20, fontSize: 8 }}>
                  YOUR TRACKING HISTORY WILL BE PRESERVED
                </HairLabel>
              </>
            ) : (
              <>
                <HairLabel style={{ marginBottom: 10 }}>REGENERATE PLAN</HairLabel>
                <div style={{ fontFamily: s2.sans, fontSize: 15, color: s2.text, marginBottom: 6 }}>
                  Create a new {planDuration}-day plan?
                </div>
                <HairLabel color={s2.textDimmer} style={{ marginBottom: 20, fontSize: 8 }}>
                  YOUR TRACKING HISTORY WILL BE PRESERVED
                </HairLabel>
              </>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={() => setShowConfirm(false)} style={{ flex: 1 }}>CANCEL</Btn>
              <Btn primary onClick={handleRegenerate} style={{ flex: 1 }}>
                {hasInstructions ? 'YES, REGEN' : 'REGENERATE'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Weight Log Modal (portal) */}
      <WeightLogModal />
    </div>
  );
}

// ── Local sub-components ────────────────────────────────────────────────────
function StatCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    /* Borderless, r=20, and the target tile is a lime *block* with ink text —
       the reference fills the card rather than just tinting the number. */
    <div style={{
      borderRadius: 20,
      background: accent ? s2.accentFill : s2.surface,
      padding: '13px 11px',
    }}>
      <HairLabel color={accent ? 'rgba(15,20,15,0.5)' : undefined}>{label}</HairLabel>
      <div style={{
        fontFamily: s2.disp,
        fontSize: 23,
        fontWeight: 700,
        color: s2.ink,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        marginTop: 7,
      }}>
        {value}<span style={{ fontSize: 11, color: accent ? 'rgba(15,20,15,0.5)' : s2.textDimmer }}>{unit}</span>
      </div>
    </div>
  );
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      borderRadius: 18, background: s2.surface, padding: '13px 13px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    }}>
      <HairLabel>{label}</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 12, fontWeight: 700, color: s2.text, textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

function NutrientCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    /* Was a square bordered box; the reference is a soft tinted tile (r=16). */
    <div style={{ borderRadius: 16, background: `${color}14`, padding: '11px 4px', textAlign: 'center' }}>
      <div style={{ fontFamily: s2.sans, fontSize: 12, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <HairLabel style={{ fontSize: 7.5, marginTop: 5 }}>{label}</HairLabel>
    </div>
  );
}

function PrefsRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 6, borderBottom: `1px solid ${s2.line}` }}>
      <HairLabel>{label}</HairLabel>
      <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.text, textTransform: 'capitalize', textAlign: 'right', maxWidth: '55%' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function PlanHistoryRow({ plan, index }: { plan: PlanHistoryItem; index: number }) {
  const date = new Date(plan.generatedAt);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const avgCal = plan.weekSummary?.avgCalories;
  const isActive = plan.isActive;

  return (
    <div style={{
      borderRadius: 18,
      background: isActive ? s2.accentWash : s2.surface,
      padding: '13px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HairLabel color={isActive ? s2.accent : s2.textDim}>
            {plan.planDuration}-DAY PLAN
          </HairLabel>
          {isActive && (
            <span style={{
              fontFamily: s2.sans,
              fontSize: 7.5,
              fontWeight: 800,
              borderRadius: s2.rPill,
              letterSpacing: '0.12em',
              background: s2.accentFill,
              color: s2.ink,
              padding: '1px 5px',
            }}>ACTIVE</span>
          )}
          {index === 0 && !isActive && (
            <span style={{
              borderRadius: s2.rMd,
              fontFamily: s2.mono,
              fontSize: 7,
              letterSpacing: '0.12em',
              border: `1px solid ${s2.line}`,
              color: s2.textDim,
              padding: '1px 5px',
            }}>PREVIOUS</span>
          )}
        </div>
        <div style={{ fontFamily: s2.mono, fontSize: 10, color: isActive ? s2.text : s2.textDim, letterSpacing: '0.04em' }}>
          {dateStr}
        </div>
      </div>
      {avgCal ? (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 14, color: isActive ? s2.accent : s2.textDim, letterSpacing: '-0.01em' }}>
            {Math.round(avgCal)}
          </div>
          <HairLabel style={{ fontSize: 7 }}>KCAL/DAY</HairLabel>
        </div>
      ) : null}
    </div>
  );
}
