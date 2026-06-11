// AuthScreen — Strain v2 visual. All auth logic, validation, debounce, and Google OAuth preserved.

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { apiUrl } from '../lib/api';
import { isNative, platform, signInWithApple } from '../lib/capacitor';
import { identifyUser } from '../lib/analytics';
import { useAuthStore } from '../store/authStore';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';
import { validateUsername as sharedValidateUsername, validatePassword as sharedValidatePassword } from '@shared/validation';

type AuthMode = 'login' | 'signup';
type Strength = 'weak' | 'good' | 'strong';


function getPasswordStrength(password: string): Strength {
  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'good';
  return 'strong';
}

function validateUsernameFormat(username: string): string | null {
  const result = sharedValidateUsername(username);
  return result.valid ? null : (result.message ?? null);
}

function validatePassword(password: string, username: string): string | null {
  const result = sharedValidatePassword(password, username);
  return result.valid ? null : (result.message ?? null);
}

interface Errors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

// ── Field component ────────────────────────────────────────────────────────
function Field({
  label, inputRef, type, value, onChange, placeholder, autoComplete, autoCapitalize,
  spellCheck, error, rightSlot,
}: {
  label: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  error?: string;
  rightSlot?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <HairLabel style={{ marginBottom: 8 }}>{label}</HairLabel>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          spellCheck={spellCheck}
          required
          style={{
            width: '100%',
            background: s2.surface,
            border: `1px solid ${error ? '#FF3E3E' : focused ? s2.accent : s2.lineStrong}`,
            padding: rightSlot ? '13px 44px 13px 14px' : '13px 14px',
            fontFamily: s2.sans,
            fontSize: 15,
            color: s2.text,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 150ms',
            WebkitAppearance: 'none',
          }}
        />
        {rightSlot && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {rightSlot}
          </div>
        )}
      </div>
      {error && (
        <div style={{ fontFamily: s2.mono, fontSize: 9, letterSpacing: '0.15em', color: '#FF3E3E', marginTop: 6 }}>
          ⚠ {error.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── AuthScreen ─────────────────────────────────────────────────────────────
export function AuthScreen() {
  const { login, signup } = useAuth();
  const { setUser } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('lastAuthTab') : null;
      if (stored === 'login' || stored === 'signup') return stored as AuthMode;
    } catch {}
    return 'signup';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Google OAuth error handling from redirect ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      const messages: Record<string, string> = {
        google_auth_failed: 'Google Sign-In failed. Please try again or use credentials to sign in.',
        google_token_failed: 'Google Sign-In could not be completed. Please try again.',
        google_no_email: 'Google account has no email address linked.',
        google_auth_error: 'An error occurred during Google Sign-In. Please try again.',
      };
      setErrors({ general: messages[error] || 'Sign-In failed. Please try again.' });
      window.history.replaceState(null, '', window.location.pathname);
      setMode('login');
    }
  }, []);

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBurst, setSuccessBurst] = useState(false);

  // ── Forgot-password modal state ─────────────────────────────────────────
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const confirmTouchedRef = useRef(false);
  const usernameInputRef  = useRef<HTMLInputElement>(null);
  const passwordInputRef  = useRef<HTMLInputElement>(null);
  const confirmInputRef   = useRef<HTMLInputElement>(null);
  const debounceRef       = useRef<number | null>(null);
  const lastCheckedRef    = useRef<string>('');

  useEffect(() => {
    try { localStorage.setItem('lastAuthTab', mode); } catch {}
  }, [mode]);

  const switchMode = (newMode: AuthMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setUsernameAvailable(null);
    setUsernameChecking(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    confirmTouchedRef.current = false;
  };

  const checkUsername = useCallback(async (value: string) => {
    if (mode !== 'signup') return;
    if (value.length < 3) { setUsernameAvailable(null); setUsernameChecking(false); return; }
    const formatError = validateUsernameFormat(value);
    if (formatError) { setUsernameAvailable(null); setUsernameChecking(false); return; }
    setUsernameChecking(true);
    try {
      const res = await axios.get('/api/auth/check-username', { params: { username: value } });
      if (lastCheckedRef.current === value) setUsernameAvailable(!!res.data.available);
    } catch {
      if (lastCheckedRef.current === value) setUsernameAvailable(null);
    } finally {
      if (lastCheckedRef.current === value) setUsernameChecking(false);
    }
  }, [mode]);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (mode === 'signup') {
      if (value.length === 0) { setErrors(e => ({ ...e, username: undefined })); setUsernameAvailable(null); }
      else { setUsernameAvailable(null); const err = validateUsernameFormat(value); setErrors(e => ({ ...e, username: err || undefined })); }
      lastCheckedRef.current = value;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => checkUsername(value), 500);
    } else {
      setErrors(e => ({ ...e, username: undefined }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (mode === 'signup' && value.length > 0) {
      const err = validatePassword(value, username);
      if (confirmTouchedRef.current && confirmPassword) {
        setErrors(e => ({ ...e, password: err || undefined, confirmPassword: value !== confirmPassword ? 'Passwords do not match' : undefined }));
      } else {
        setErrors(e => ({ ...e, password: err || undefined }));
      }
    } else {
      setErrors(e => ({ ...e, password: undefined }));
    }
  };

  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    confirmTouchedRef.current = true;
    setErrors(e => ({ ...e, confirmPassword: value.length > 0 && value !== password ? 'Passwords do not match' : undefined }));
  };

  const passwordStrength: Strength | null = mode === 'signup' && password.length > 0 ? getPasswordStrength(password) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === 'login') {
      if (!username.trim() || !password) { setErrors({ general: 'Please enter your username and password' }); return; }
      setIsSubmitting(true);
      try { await login(username.trim(), password); }
      catch (err: any) {
        const data = err?.response?.data;
        if (data?.error === 'database_unavailable') setErrors({ general: data.message || 'Database is waking up. Please wait a moment and try again.' });
        else setErrors({ general: data?.message || 'Invalid username or password' });
      }
      finally { setIsSubmitting(false); }
      return;
    }

    const newErrors: Errors = {};
    const usernameErr = validateUsernameFormat(username);
    if (usernameErr) newErrors.username = usernameErr;
    else if (usernameAvailable === false) newErrors.username = 'This username is already taken';
    const passwordErr = validatePassword(password, username);
    if (passwordErr) newErrors.password = passwordErr;
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.username) usernameInputRef.current?.focus();
      else if (newErrors.password) passwordInputRef.current?.focus();
      else if (newErrors.confirmPassword) confirmInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(username, password, confirmPassword);
      setSuccessBurst(true);
      setTimeout(() => setSuccessBurst(false), 800);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.error === 'username_taken') {
        setErrors({ username: 'This username is already taken' });
        usernameInputRef.current?.focus();
      } else if (data?.error === 'validation_error' && data?.field) {
        setErrors({ [data.field]: data.message } as Errors);
      } else if (data?.error === 'rate_limit') {
        setErrors({ general: data.message });
      } else if (data?.error === 'database_unavailable') {
        setErrors({ general: data.message || 'Database is waking up. Please wait a moment and try again.' });
      } else {
        setErrors({ general: data?.message || 'Something went wrong. Please try again.' });
      }
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res  = await fetch(apiUrl('/api/auth/google/check'), { credentials: 'include' });
      const data = await res.json();
      if (data.configured) window.location.href = apiUrl('/api/auth/google');
      else setErrors({ general: 'Google Sign-In is not configured. Please use credentials to sign in.' });
    } catch {
      setErrors({ general: 'Google Sign-In is not available. Please use credentials to sign in.' });
    }
  };

  const handleAppleLogin = async () => {
    if (!isNative || platform() !== 'ios') {
      setErrors({ general: 'Sign in with Apple is only available on the iOS app. Use credentials or Google Sign-In here.' });
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = await signInWithApple();
      if (!payload.identityToken) throw new Error('No identity token received from Apple');
      const res = await axios.post('/api/auth/apple/callback', {
        identityToken: payload.identityToken,
        fullName: payload.fullName,
        email: payload.email,
      }, { withCredentials: true });
      setUser(res.data.user);
      identifyUser(res.data.user.id);
      setSuccessBurst(true);
      setTimeout(() => setSuccessBurst(false), 800);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Apple Sign-In failed.';
      setErrors({ general: msg });
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    const email = forgotEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotSubmitting(true);
    try {
      await axios.post('/api/auth/forgot-password', { email }, { withCredentials: true });
      setForgotSent(true);
    } catch (err: any) {
      // Server returns { success: true } for both known and unknown emails
      // to avoid leaking which accounts exist. We surface a generic message
      // even on network errors to be safe.
      setForgotSent(true);
      if (err?.response?.data?.error && err.response.data.error !== 'rate_limit') {
        // Only swallow non-rate-limit errors silently. Rate-limit shows
        // a clear message.
        void err;
      } else if (err?.response?.data?.error === 'rate_limit') {
        setForgotError('Too many reset requests. Please try again in an hour.');
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  const closeForgot = useCallback(() => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotError(null);
    setForgotSent(false);
  }, []);

  const isSignup = mode === 'signup';

  // Strength colours
  const strengthColor = passwordStrength === 'strong' ? '#4CAF82' : passwordStrength === 'good' ? s2.accentSoft : '#FF3E3E';

  // Username availability indicator
  const UsernameIndicator = isSignup && username.length >= 3 && !errors.username ? (
    usernameChecking ? (
      <div style={{ width: 14, height: 14, border: `2px solid ${s2.textDimmer}`, borderTopColor: s2.accent, borderRadius: '50%' }} />
    ) : usernameAvailable === true ? (
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: '#4CAF82' }}>✓</span>
    ) : usernameAvailable === false ? (
      <span style={{ fontFamily: s2.mono, fontSize: 11, color: '#FF3E3E' }}>✗</span>
    ) : null
  ) : null;

  const EyeBtn = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
    >
      {show ? '🙈' : '👁'}
    </button>
  );

  return (
    <div style={{
      minHeight: '100dvh',
      background: s2.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      color: s2.text,
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>

        {/* ── Logo / header ─────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Square logo mark */}
          <div style={{
            width: 52,
            height: 52,
            background: s2.accentFill,
            border: `1px solid ${s2.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <span style={{ fontSize: 26 }}>🍽️</span>
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', color: s2.text }}>
            Diet Plan
          </div>
          <div style={{ fontFamily: s2.mono, fontSize: 10, letterSpacing: '0.2em', color: s2.accent, marginTop: 3 }}>
            & TRACKER
          </div>
          <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, marginTop: 8 }}>
            AI-powered nutrition companion
          </div>
        </div>

        {/* ── Mode toggle ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', marginBottom: 24, border: `1px solid ${s2.lineStrong}`, position: 'relative' }}>
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: '11px 0',
                background: mode === m ? s2.surface : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${mode === m ? s2.accent : 'transparent'}`,
                fontFamily: s2.mono,
                fontSize: 10,
                letterSpacing: '0.18em',
                color: mode === m ? s2.accent : s2.textDimmer,
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 150ms',
              }}
            >
              {m === 'login' ? 'LOGIN' : 'SIGN UP'}
            </button>
          ))}
        </div>

        {/* ── Form ──────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Username */}
          <Field
            label="USERNAME"
            inputRef={usernameInputRef}
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="yourname"
            autoComplete={isSignup ? 'username' : 'username'}
            autoCapitalize="none"
            spellCheck={false}
            error={errors.username || (isSignup && !errors.username && username.length >= 3 && usernameAvailable === false ? 'Already taken' : undefined)}
            rightSlot={UsernameIndicator ?? undefined}
          />

          {/* Password */}
          <Field
            label="PASSWORD"
            inputRef={passwordInputRef}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={handlePasswordChange}
            placeholder="••••••••"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            error={errors.password}
            rightSlot={<EyeBtn show={showPassword} onToggle={() => setShowPassword(s => !s)} />}
          />
          {/* Password strength bar */}
          {isSignup && passwordStrength && !errors.password && (
            <div style={{ marginTop: -10 }}>
              <div style={{ height: 2, background: s2.line, position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'good' ? '66%' : '100%',
                  background: strengthColor,
                  transition: 'width 250ms',
                }} />
              </div>
              <HairLabel color={strengthColor} style={{ marginTop: 4, fontSize: 8 }}>
                {passwordStrength.toUpperCase()}
              </HairLabel>
            </div>
          )}

          {/* Confirm password (signup only) */}
          {isSignup && (
            <Field
              label="CONFIRM PASSWORD"
              inputRef={confirmInputRef}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={handleConfirmChange}
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword}
              rightSlot={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {confirmPassword.length > 0 && password === confirmPassword && !errors.confirmPassword && (
                    <span style={{ fontFamily: s2.mono, fontSize: 11, color: '#4CAF82' }}>✓</span>
                  )}
                  <EyeBtn show={showConfirmPassword} onToggle={() => setShowConfirmPassword(s => !s)} />
                </div>
              }
            />
          )}

          {/* General error */}
          {errors.general && (
            <div style={{
              border: `1px solid rgba(255,62,62,0.5)`,
              background: 'rgba(255,62,62,0.08)',
              padding: '10px 12px',
            }}>
              <div style={{ fontFamily: s2.sans, fontSize: 13, color: '#FF3E3E' }}>{errors.general}</div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            aria-label={isSignup ? 'Create Account' : 'Log In'}
            disabled={isSubmitting || successBurst}
            style={{
              width: '100%',
              padding: '14px 0',
              background: successBurst ? '#4CAF82' : s2.accent,
              border: 'none',
              fontFamily: s2.mono,
              fontSize: 10,
              letterSpacing: '0.2em',
              color: s2.bg,
              fontWeight: 600,
              cursor: isSubmitting || successBurst ? 'default' : 'pointer',
              opacity: isSubmitting ? 0.75 : 1,
              transition: 'background 200ms',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            {successBurst ? (
              '✓ ACCOUNT CREATED'
            ) : isSubmitting ? (
              <>
                <div style={{ width: 12, height: 12, border: `1.5px solid ${s2.bg}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
                {isSignup ? 'CREATING...' : 'SIGNING IN...'}
              </>
            ) : isSignup ? 'CREATE ACCOUNT →' : 'LOGIN →'}
          </button>

          {/* Forgot password (login only) */}
          {!isSignup && (
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: 'none', border: 'none',
                  fontFamily: s2.sans, fontSize: 12, color: s2.textDim,
                  cursor: 'pointer', padding: 0,
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: s2.line }} />
          <HairLabel>OR</HairLabel>
          <div style={{ flex: 1, height: 1, background: s2.line }} />
        </div>

        {/* ── Social buttons row ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            aria-label="Sign in with Google"
            onClick={handleGoogleLogin}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 0',
              background: s2.surface,
              border: `1px solid ${s2.lineStrong}`,
              fontFamily: s2.sans,
              fontSize: 13,
              color: s2.text,
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            aria-label="Sign in with Apple"
            onClick={handleAppleLogin}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 0',
              background: '#000',
              border: '1px solid #333',
              fontFamily: s2.sans,
              fontSize: 13,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Apple
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <HairLabel>AI-POWERED NUTRITION PLANNING</HairLabel>
        </div>

        <div style={{
          marginTop: 20, padding: '12px 14px',
          border: `1px solid ${s2.line}`,
          fontSize: 11, lineHeight: 1.5, color: s2.textDimmer,
          fontFamily: s2.sans, textAlign: 'center',
        }}>
          <strong style={{ color: s2.textDim }}>Medical Disclaimer:</strong>{' '}
          This app provides AI-generated meal plans for informational purposes only.
          It is not a substitute for professional medical advice, diagnosis, or treatment.
          Always consult a qualified healthcare provider before starting any diet or nutrition program.
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14, paddingBottom: 8 }}>
          <a
            href={apiUrl('/privacy')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}
          >
            Privacy Policy
          </a>
          <span style={{ color: s2.line }}>|</span>
          <a
            href={apiUrl('/terms')}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: s2.sans, fontSize: 11, color: s2.textDimmer }}
          >
            Terms of Service
          </a>
        </div>
      </div>

      {/* ── Forgot-password modal ────────────────────────────────────────── */}
      {showForgot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeForgot(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 380,
            background: s2.surface, border: `1px solid ${s2.line}`,
            borderRadius: 16, padding: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            {forgotSent ? (
              <>
                <h2 id="forgot-title" style={{ fontFamily: s2.sans, fontSize: 22, color: s2.text, margin: '0 0 12px' }}>
                  Check your email
                </h2>
                <p style={{ fontFamily: s2.sans, fontSize: 14, color: s2.textDim, lineHeight: 1.5, margin: '0 0 20px' }}>
                  If an account exists for <strong style={{ color: s2.text }}>{forgotEmail}</strong>,
                  we've sent a password-reset link. The link expires in 1 hour.
                </p>
                <button
                  type="button"
                  onClick={closeForgot}
                  style={{
                    width: '100%', padding: '12px 0',
                    background: s2.bg, color: s2.text,
                    border: `1px solid ${s2.line}`,
                    borderRadius: 8, cursor: 'pointer',
                    fontFamily: s2.sans, fontSize: 14, fontWeight: 600,
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <h2 id="forgot-title" style={{ fontFamily: s2.sans, fontSize: 22, color: s2.text, margin: '0 0 8px' }}>
                  Reset password
                </h2>
                <p style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, lineHeight: 1.5, margin: '0 0 20px' }}>
                  Enter the email on your account and we'll send you a reset link.
                </p>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: s2.bg, color: s2.text,
                    border: `1px solid ${forgotError ? '#c33' : s2.line}`,
                    borderRadius: 8, outline: 'none',
                    fontFamily: s2.sans, fontSize: 14,
                    boxSizing: 'border-box',
                    marginBottom: forgotError ? 6 : 16,
                  }}
                />
                {forgotError && (
                  <p style={{ fontFamily: s2.sans, fontSize: 12, color: '#c33', margin: '0 0 12px' }}>
                    {forgotError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={closeForgot}
                    style={{
                      flex: 1, padding: '12px 0',
                      background: 'transparent', color: s2.textDim,
                      border: `1px solid ${s2.line}`,
                      borderRadius: 8, cursor: 'pointer',
                      fontFamily: s2.sans, fontSize: 14, fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    style={{
                      flex: 2, padding: '12px 0',
                      background: forgotSubmitting ? s2.line : s2.text,
                      color: s2.bg,
                      border: 'none',
                      borderRadius: 8, cursor: forgotSubmitting ? 'wait' : 'pointer',
                      fontFamily: s2.sans, fontSize: 14, fontWeight: 600,
                      opacity: forgotSubmitting ? 0.6 : 1,
                    }}
                  >
                    {forgotSubmitting ? 'SENDING…' : 'SEND RESET LINK'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
