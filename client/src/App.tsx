import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import { useAuth } from './hooks/useAuth';
import { useAppStore } from './store/appStore';
import { usePlan } from './hooks/usePlan';
import { storeToken } from './lib/auth';
import { AuthScreen } from './components/AuthScreen';
import { Onboarding } from './components/Onboarding';
import { AppBar } from './components/AppBar';
import { BottomNav } from './components/BottomNav';
import { IOSInstallBanner } from './components/IOSInstallBanner';
import { Toast, ToastHandle } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TabId } from './types';

// Lazy-load each tab so the initial JS bundle is small enough for the SW to
// precache and for iOS Safari to parse quickly on first visit.
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
      <div className="min-h-app bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-2xl">🍽️</span>
          </div>
          <p className="text-secondary text-sm font-sans">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary fallback={
        <div className="min-h-app bg-dark flex items-center justify-center px-5">
          <div className="text-center">
            <p className="text-primary text-base font-sans font-semibold mb-2">Something went wrong</p>
            <p className="text-secondary text-sm font-sans mb-4">Please reload the page</p>
            <button onClick={() => window.location.reload()} className="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold font-sans">
              Reload
            </button>
          </div>
        </div>
      }>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  // Show onboarding if user hasn't completed it
  if (!user.onboardingDone) {
    return (
      <Onboarding
        onComplete={async () => {
          await refreshUser();
        }}
        userName={user.name || user.username}
      />
    );
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-app bg-dark">
      <div className="max-w-app mx-auto flex flex-col h-app relative bg-dark">
        <ErrorBoundary>
          <AppBar title="Diet Plan & Tracker" />
        </ErrorBoundary>

        {/* PWA install banner */}
        {showInstallBanner && (
          <div className="bg-accent text-white px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📱</span>
              <p className="text-sm font-sans font-medium">Add to Home Screen</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleInstall} className="text-xs bg-white text-accent font-semibold px-3 py-1.5 rounded-lg">Install</button>
              <button onClick={() => setShowInstallBanner(false)} className="text-white/70 text-lg leading-none">&times;</button>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col pb-16">
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
