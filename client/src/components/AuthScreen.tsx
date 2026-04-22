import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { apiUrl } from '../lib/api';

type AuthMode = 'login' | 'signup';
type Strength = 'weak' | 'good' | 'strong';

const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;
const RESERVED = new Set(['admin', 'root', 'system', 'support', 'help', 'dietplan', 'api', 'null', 'undefined']);

function getPasswordStrength(password: string): Strength {
  let score = 0;
  if (password.length >= 6) score++;
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
  if (/\s/.test(username)) return 'Username cannot contain spaces';
  if (username.length < 3 || username.length > 20) return 'Username must be 3–20 characters';
  if (!USERNAME_REGEX.test(username)) return 'Only letters, numbers and _ allowed';
  if (RESERVED.has(username.toLowerCase())) return 'This username is not available';
  return null;
}

function validatePassword(password: string, username: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 72) return 'Password is too long';
  if (/^\d+$/.test(password)) return 'Password cannot be all numbers';
  if (username && password.toLowerCase() === username.toLowerCase()) return 'Password cannot be your username';
  return null;
}

interface Errors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export function AuthScreen() {
  const { login, signup } = useAuth();

  // Default mode: signup for first-visit, login if returning user
  const [mode, setMode] = useState<AuthMode>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('lastAuthTab') : null;
      if (stored === 'login' || stored === 'signup') return stored as AuthMode;
    } catch {
      // localStorage unavailable (iOS private mode quota = 0) — default to signup
    }
    return 'signup';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBurst, setSuccessBurst] = useState(false);

  const confirmTouchedRef = useRef(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastCheckedRef = useRef<string>('');

  // Persist last used tab (guarded — localStorage.setItem throws in iOS private mode)
  useEffect(() => {
    try {
      localStorage.setItem('lastAuthTab', mode);
    } catch {
      // Silently ignore — not critical
    }
  }, [mode]);

  // Clear fields + errors when switching mode
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

  // Debounced username availability check (signup only)
  const checkUsername = useCallback(async (value: string) => {
    if (mode !== 'signup') return;
    if (value.length < 3) {
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    const formatError = validateUsernameFormat(value);
    if (formatError) {
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    setUsernameChecking(true);
    try {
      const res = await axios.get('/api/auth/check-username', { params: { username: value } });
      if (lastCheckedRef.current === value) {
        setUsernameAvailable(!!res.data.available);
      }
    } catch {
      if (lastCheckedRef.current === value) {
        setUsernameAvailable(null);
      }
    } finally {
      if (lastCheckedRef.current === value) {
        setUsernameChecking(false);
      }
    }
  }, [mode]);

  // Username onChange handler — validate format, schedule availability check
  const handleUsernameChange = (value: string) => {
    setUsername(value);

    if (mode === 'signup') {
      // Live format validation
      if (value.length === 0) {
        setErrors(e => ({ ...e, username: undefined }));
        setUsernameAvailable(null);
      } else {
        const err = validateUsernameFormat(value);
        setErrors(e => ({ ...e, username: err || undefined }));
      }

      // Debounced availability check
      lastCheckedRef.current = value;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        checkUsername(value);
      }, 500);
    } else {
      // Login mode — no format validation
      setErrors(e => ({ ...e, username: undefined }));
    }
  };

  // Password onChange
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (mode === 'signup' && value.length > 0) {
      const err = validatePassword(value, username);
      setErrors(e => ({ ...e, password: err || undefined }));
      // Re-validate confirm if it was touched
      if (confirmTouchedRef.current && confirmPassword) {
        setErrors(e => ({
          ...e,
          password: err || undefined,
          confirmPassword: value !== confirmPassword ? 'Passwords do not match' : undefined
        }));
      }
    } else {
      setErrors(e => ({ ...e, password: undefined }));
    }
  };

  // Confirm password onChange
  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    confirmTouchedRef.current = true;
    if (value.length > 0 && value !== password) {
      setErrors(e => ({ ...e, confirmPassword: 'Passwords do not match' }));
    } else {
      setErrors(e => ({ ...e, confirmPassword: undefined }));
    }
  };

  const passwordStrength: Strength | null = mode === 'signup' && password.length > 0
    ? getPasswordStrength(password)
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === 'login') {
      if (!username.trim() || !password) {
        setErrors({ general: 'Please enter your username and password' });
        return;
      }
      setIsSubmitting(true);
      try {
        await login(username.trim(), password);
      } catch (err: any) {
        setErrors({ general: err?.response?.data?.error || 'Invalid username or password' });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Signup mode — full validation
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
      // Focus first errored field
      if (newErrors.username) usernameInputRef.current?.focus();
      else if (newErrors.password) passwordInputRef.current?.focus();
      else if (newErrors.confirmPassword) confirmInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(username, password, confirmPassword);
      setSuccessBurst(true);
      // After brief success state, useAuth will trigger the onboarding redirect via user state change
      setTimeout(() => {
        setSuccessBurst(false);
      }, 800);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.error === 'username_taken') {
        setErrors({ username: 'This username is already taken' });
        usernameInputRef.current?.focus();
      } else if (data?.error === 'validation_error' && data?.field) {
        setErrors({ [data.field]: data.message } as Errors);
      } else if (data?.error === 'rate_limit') {
        setErrors({ general: data.message });
      } else {
        setErrors({ general: data?.message || 'Something went wrong. Please try again.' });
      }
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/google/check'), { credentials: 'include' });
      const data = await res.json();
      if (data.configured) {
        window.location.href = apiUrl('/api/auth/google');
      } else {
        setErrors({ general: 'Google Sign-In is not configured. Please use credentials to sign in.' });
      }
    } catch {
      setErrors({ general: 'Google Sign-In is not available. Please use credentials to sign in.' });
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="min-h-app bg-dark flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent-fill rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🍽️</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight">Diet Plan</h1>
          <p className="font-display text-accent text-xl font-semibold">& Tracker</p>
          <p className="text-secondary text-sm mt-2 font-sans">Your AI-powered nutrition companion</p>
        </div>

        {/* Tab toggle */}
        <div className="relative bg-white/[0.04] rounded-xl p-1 mb-6 flex">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 rounded-lg font-sans text-sm font-semibold transition-colors relative z-10 ${
              mode === 'login' ? 'text-primary' : 'text-dimmed'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2.5 rounded-lg font-sans text-sm font-semibold transition-colors relative z-10 ${
              mode === 'signup' ? 'text-primary' : 'text-dimmed'
            }`}
          >
            Sign Up
          </button>
          {/* Sliding indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-white/[0.08] transition-transform duration-300 ease-out"
            style={{
              width: 'calc(50% - 4px)',
              left: '4px',
              transform: mode === 'login' ? 'translateX(0)' : 'translateX(100%)'
            }}
          />
          {/* Accent underline */}
          <div
            className="absolute bottom-0 h-0.5 bg-accent rounded-full transition-transform duration-300 ease-out"
            style={{
              width: 'calc(50% - 8px)',
              left: '8px',
              transform: mode === 'login' ? 'translateX(0)' : 'translateX(calc(100% + 16px))'
            }}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5 font-sans">Username</label>
            <div className="relative">
              <input
                ref={usernameInputRef}
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className={`w-full bg-surface border-[1.5px] text-primary rounded-xl px-4 py-3 pr-10 font-sans text-base focus:outline-none focus:ring-1 placeholder-dimmed transition-colors ${
                  errors.username
                    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-border focus:border-accent focus:ring-accent/30'
                }`}
                placeholder="yourname"
                autoComplete={isSignup ? 'username' : 'username'}
                autoCapitalize="none"
                spellCheck={false}
                required
              />
              {/* Availability indicator */}
              {isSignup && username.length >= 3 && !errors.username && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameChecking ? (
                    <span className="inline-block w-4 h-4 border-2 border-dimmed border-t-transparent rounded-full animate-spin" />
                  ) : usernameAvailable === true ? (
                    <span className="text-success text-lg leading-none">✓</span>
                  ) : usernameAvailable === false ? (
                    <span className="text-red-500 text-lg leading-none">✗</span>
                  ) : null}
                </div>
              )}
            </div>
            {errors.username && (
              <p className="text-red-500 text-xs mt-1 font-sans flex items-center gap-1 animate-[fadeIn_200ms_ease]">
                <span>⚠</span>{errors.username}
              </p>
            )}
            {isSignup && !errors.username && username.length >= 3 && usernameAvailable === false && (
              <p className="text-red-500 text-xs mt-1 font-sans flex items-center gap-1 animate-[fadeIn_200ms_ease]">
                <span>⚠</span>Already taken
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5 font-sans">Password</label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className={`w-full bg-surface border-[1.5px] text-primary rounded-xl px-4 py-3 pr-11 font-sans text-base focus:outline-none focus:ring-1 placeholder-dimmed transition-colors ${
                  errors.password
                    ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-border focus:border-accent focus:ring-accent/30'
                }`}
                placeholder="••••••••"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary text-base transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-xs mt-1 font-sans flex items-center gap-1 animate-[fadeIn_200ms_ease]">
                <span>⚠</span>{errors.password}
              </p>
            )}
            {/* Password strength bar (signup only) */}
            {isSignup && passwordStrength && !errors.password && (
              <div className="mt-1.5">
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'good' ? '66%' : '100%',
                      backgroundColor: passwordStrength === 'weak' ? '#DC2626' : passwordStrength === 'good' ? '#E8845A' : '#4CAF82'
                    }}
                  />
                </div>
                <p className="text-[10px] font-sans mt-1 capitalize" style={{
                  color: passwordStrength === 'weak' ? '#DC2626' : passwordStrength === 'good' ? '#E8845A' : '#4CAF82'
                }}>
                  {passwordStrength}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password (signup only) */}
          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5 font-sans">Confirm Password</label>
              <div className="relative">
                <input
                  ref={confirmInputRef}
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => handleConfirmChange(e.target.value)}
                  className={`w-full bg-surface border-[1.5px] text-primary rounded-xl px-4 py-3 pr-11 font-sans text-base focus:outline-none focus:ring-1 placeholder-dimmed transition-colors ${
                    errors.confirmPassword
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                      : 'border-border focus:border-accent focus:ring-accent/30'
                  }`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary text-base transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
                {/* Match checkmark */}
                {confirmPassword.length > 0 && password === confirmPassword && !errors.confirmPassword && (
                  <span className="absolute right-11 top-1/2 -translate-y-1/2 text-success text-base leading-none">✓</span>
                )}
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1 font-sans flex items-center gap-1 animate-[fadeIn_200ms_ease]">
                  <span>⚠</span>{errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* General error banner */}
          {errors.general && (
            <div className="bg-red-900/30 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl font-sans animate-[fadeIn_200ms_ease]">
              {errors.general}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || successBurst}
            className="w-full bg-accent hover:bg-accent/90 active:scale-95 text-white font-semibold py-3.5 rounded-[14px] font-sans text-base transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {successBurst ? (
              <>
                <span className="text-lg">✓</span>Account created!
              </>
            ) : isSubmitting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isSignup ? 'Creating account...' : 'Signing in...'}
              </>
            ) : isSignup ? (
              <>Create Account →</>
            ) : (
              <>Login →</>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-dimmed text-xs font-sans uppercase">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-surface hover:bg-elevated text-primary font-medium py-3.5 rounded-xl font-sans text-base transition-all active:scale-95 border border-border"
        >
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>

        <p className="text-center text-dimmed text-xs mt-8 font-sans">AI-powered nutrition planning</p>
      </div>
    </div>
  );
}
