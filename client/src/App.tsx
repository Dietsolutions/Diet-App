import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import { useAuth } from './hooks/useAuth';
import { useAppStore } from './store/appStore';
import { usePlan } from './hooks/usePlan';
import { storeToken } from './lib/auth';
import { AuthScreen } from './components/AuthScreen';
import { AppBar } from './components/AppBar';
import { BottomNav } from './components/BottomNav';
import { IOSInstallBanner } from './components/IOSInstallBanner';
import { Toast, ToastHandle } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TabId } from './types';
import { s2 } from './theme/tokens';

// ── Lazy-load all heavy screens ──────────────────────────────────────────────
// Onboarding is lazy because it imports country-state-city (7.7 MB city.json).
// Loading it eagerly bundled that data into the main chunk and triggered
// RangeError: Maximum call stack size exceeded on iOS Safari 18 during the
// JS engine's expression-tree evaluation of the inlined JSON literal.
// Lazy-loading means country-state-city is only fetched for new users who
// haven't completed onboarding — existing users never pay this cost.
const Onboarding  = lazy(() => import('./components/Onboarding').then(m => ({ default: m.Onboarding })));
const MealsTab    = lazy(() => import('./components/MealsTab').then(m => ({ default: m.MealsTab })));
const TrackerTab  = lazy(() => import('./components/TrackerTab').then(m => ({ default: m.TrackerTab })));
const ShoppingTab = lazy(() => import('./components/ShoppingTab').then(m => ({ default: m.ShoppingTab })));
const TipsTab     = lazy(() => import('./components/TipsTab').then(m => ({ default: m.TipsTab })));
const ProfileTab  = lazy(() => import('./components/ProfileTab').then(m => ({ default: m.ProfileTab })));

/** Tab-level loading fallback — just an empty dark surface so there's no flash */
function TabFallback() {
  return <div className="flex-1 bg-dark" />;
}

/** Detect iOS Safari */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function App() {
  const { user, isLoading, refreshUser } = useAuth();
  const { activeTab, setActiveTab, profile, setProfile } = useAppStore();
  const toastRef = useRef<ToastHandle>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Load plan data when user is logged in and onboarded
  usePlan();

  // ── iOS Safari PWA: read ?_at= token from URL (Google OAuth redirect fallback) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const at = params.get('_at');
    if (at) {
      storeToken(at);
      // Remove token from URL so it's not visible / logged in server referer headers
      params.delete('_at');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  // ── Fetch profile once at startup (needed by MacroBand, MacroAchievementCard) ──
  useEffect(() => {
    if (!user?.onboardingDone || profile) return;
    axios.get('/api/profile', { withCredentials: true })
      .then(res => {
        if (res.data.profile) setProfile(res.data.profile);
      })
      .catch(() => { /* non-critical — ProfileTab will retry on mount */ });
  }, [user?.onboardingDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // beforeinstallprompt never fires on iOS Safari — iOS uses IOSInstallBanner instead
    if (isIOS()) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    // @ts-ignore
    await installPrompt.prompt();
    setShowInstallBanner(false);
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', background: s2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44,
            background: s2.accentFill,
            border: `1px solid ${s2.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <span style={{ fontSize: 22 }}>🍽️</span>
          </div>
          <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.2em', color: s2.textDimmer }}>LOADING…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary fallback={
        <div style={{ minHeight: '100dvh', background: s2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: s2.sans, fontSize: 16, color: s2.text, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginBottom: 20 }}>Please reload the page</div>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '11px 24px', background: s2.accent, border: 'none', fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.18em', color: s2.bg, cursor: 'pointer' }}
            >
              RELOAD
            </button>
          </div>
        </div>
      }>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  // Show onboarding if user hasn't completed it.
  // Onboarding is lazy (see top of file) so country-state-city loads only here.
  if (!user.onboardingDone) {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100dvh', background: s2.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.2em', color: s2.textDimmer }}>LOADING…</div>
        </div>
      }>
        <Onboarding
          onComplete={async () => {
            await refreshUser();
          }}
          userName={user.name || user.username}
        />
      </Suspense>
    );
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  return (
    <div style={{ background: s2.bg, minHeight: '100dvh' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100dvh', position: 'relative', background: s2.bg }}>
        {/* Offline banner */}
        {!isOnline && (
          <div style={{
            background: '#B33',
            padding: '6px 20px',
            textAlign: 'center',
            fontFamily: s2.sans,
            fontSize: 12,
            color: '#fff',
            fontWeight: 500,
          }}>
            No internet connection — some features may be unavailable
          </div>
        )}

        {/* Safe-area spacer (AppBar renders this) */}
        <ErrorBoundary>
          <AppBar title="Diet Plan & Tracker" />
        </ErrorBoundary>

        {/* PWA install banner */}
        {showInstallBanner && (
          <div style={{
            background: s2.accent,
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📱</span>
              <span style={{ fontFamily: s2.sans, fontSize: 13, color: s2.bg, fontWeight: 500 }}>Add to Home Screen</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={handleInstall}
                style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', background: s2.bg, border: 'none', color: s2.accent, padding: '5px 10px', cursor: 'pointer' }}
              >
                INSTALL
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(12,9,7,0.7)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: 64 }}>
          <ErrorBoundary>
            <Suspense fallback={<TabFallback />}>
              {activeTab === 'meals' && <MealsTab />}
              {activeTab === 'tracker' && <TrackerTab />}
              {activeTab === 'shopping' && <ShoppingTab />}
              {activeTab === 'tips' && <TipsTab />}
              {activeTab === 'profile' && <ProfileTab />}
            </Suspense>
          </ErrorBoundary>
        </main>

        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Toast ref={toastRef} />
        <IOSInstallBanner />
      </div>
    </div>
  );
}
