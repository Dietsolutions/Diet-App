import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { identifyUser, resetUser } from '../lib/analytics';
import { setBearerToken } from '../lib/api';

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const controller = new AbortController();
    axios.get('/api/auth/me', { withCredentials: true, signal: controller.signal })
      .then((res) => setUser(res.data.user))
      .catch((err) => {
        if (!axios.isCancel(err)) setUser(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await axios.post('/api/auth/login', { username, password }, { withCredentials: true });
    // Native: the auth cookie won't persist (cross-origin WebView), so keep the
    // returned JWT as a Bearer token. Harmless on web (cookie still primary).
    if (res.data.token) setBearerToken(res.data.token);
    setUser(res.data.user);
    // Identify user in PostHog — no PII, only internal ID
    identifyUser(res.data.user.id);
    return res.data.user;
  };

  const signup = async (username: string, password: string, confirmPassword: string) => {
    const res = await axios.post(
      '/api/auth/signup',
      { username, password, confirmPassword },
      { withCredentials: true }
    );
    // Native: persist the JWT as a Bearer token (cookie won't survive in WebView).
    if (res.data.token) setBearerToken(res.data.token);
    setUser(res.data.user);
    // New user — identify so their onboarding funnel is tracked from the start
    identifyUser(res.data.user.id);
    return res.data.user;
  };

  /** Authenticate via a Bearer token (e.g., from deep-link OAuth return). */
  const authWithToken = async (token: string) => {
    setBearerToken(token);
    setLoading(true);
    try {
      const res = await axios.get('/api/auth/me');
      setUser(res.data.user);
      identifyUser(res.data.user.id);
    } catch {
      setBearerToken(null);
      // fall through — user remains unauthenticated
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(false);
    setBearerToken(null);
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch {
      // best-effort — still clear local state
    }
    resetUser();
    setUser(null);
  };

  const refreshUser = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/auth/me', { withCredentials: true });
      setUser(res.data.user);
    } catch {
      // silent — keep existing user state
    } finally {
      setLoading(false);
    }
  };

  return { user, isLoading, login, signup, authWithToken, logout, refreshUser };
}
