import { useEffect, useState, FormEvent } from 'react';
import axios from 'axios';
import { s2 } from '../theme/tokens';

type CheckResult = { valid: true } | { valid: false; reason?: 'expired' | 'already_used' };

export function ResetPasswordScreen() {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [checkState, setCheckState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [invalidReason, setInvalidReason] = useState<'expired' | 'already_used' | 'unknown'>('unknown');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (!t) {
      setCheckState('invalid');
      return;
    }
    axios
      .get<CheckResult>('/api/auth/check-reset-token', { params: { token: t }, withCredentials: true })
      .then((res) => {
        if (res.data?.valid) {
          setCheckState('valid');
        } else {
          setCheckState('invalid');
          const reason = (res.data as any)?.reason;
          if (reason === 'expired' || reason === 'already_used') {
            setInvalidReason(reason);
          } else {
            setInvalidReason('unknown');
          }
        }
      })
      .catch(() => {
        setCheckState('invalid');
        setInvalidReason('unknown');
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/auth/reset-password', { token, password }, { withCredentials: true });
      setDone(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setError('Too many reset attempts. Please try again in an hour.');
      } else if (status === 400) {
        setError('This reset link is no longer valid.');
        setCheckState('invalid');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: s2.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
        fontFamily: s2.sans,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: s2.surface,
          border: `1px solid ${s2.line}`,
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {checkState === 'loading' && (
          <>
            <h1 style={{ fontFamily: s2.sans, fontSize: 22, color: s2.text, margin: '0 0 8px' }}>
              Verifying link…
            </h1>
            <p style={{ fontSize: 13, color: s2.textDim, margin: 0 }}>One moment.</p>
          </>
        )}

        {checkState === 'invalid' && (
          <>
            <h1 style={{ fontFamily: s2.sans, fontSize: 22, color: s2.text, margin: '0 0 8px' }}>
              Reset link invalid
            </h1>
            <p style={{ fontSize: 13, color: s2.textDim, lineHeight: 1.5, margin: '0 0 20px' }}>
              {invalidReason === 'expired' && 'This password-reset link has expired. Please request a new one.'}
              {invalidReason === 'already_used' && 'This password-reset link has already been used.'}
              {invalidReason === 'unknown' && 'This password-reset link is invalid or has been removed.'}
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              style={{
                width: '100%', padding: '12px 0',
                background: s2.text, color: s2.bg,
                border: 'none', borderRadius: 8,
                cursor: 'pointer', fontFamily: s2.sans, fontSize: 14, fontWeight: 600,
              }}
            >
              Back to sign in
            </button>
          </>
        )}

        {checkState === 'valid' && done && (
          <>
            <h1 style={{ fontFamily: s2.sans, fontSize: 22, color: s2.text, margin: '0 0 8px' }}>
              Password updated
            </h1>
            <p style={{ fontSize: 13, color: s2.textDim, lineHeight: 1.5, margin: '0 0 20px' }}>
              Your password has been reset. You can now sign in with your new password.
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              style={{
                width: '100%', padding: '12px 0',
                background: s2.text, color: s2.bg,
                border: 'none', borderRadius: 8,
                cursor: 'pointer', fontFamily: s2.sans, fontSize: 14, fontWeight: 600,
              }}
            >
              Sign in
            </button>
          </>
        )}

        {checkState === 'valid' && !done && (
          <form onSubmit={handleSubmit}>
            <h1 style={{ fontFamily: s2.sans, fontSize: 22, color: s2.text, margin: '0 0 8px' }}>
              Set a new password
            </h1>
            <p style={{ fontSize: 13, color: s2.textDim, lineHeight: 1.5, margin: '0 0 20px' }}>
              Enter a new password for your account.
            </p>
            <input
              type="password"
              autoComplete="new-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              style={{
                width: '100%', padding: '12px 14px', marginBottom: 12,
                background: s2.bg, color: s2.text,
                border: `1px solid ${s2.line}`,
                borderRadius: 8, outline: 'none',
                fontFamily: s2.sans, fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              style={{
                width: '100%', padding: '12px 14px', marginBottom: error ? 6 : 16,
                background: s2.bg, color: s2.text,
                border: `1px solid ${error ? '#c33' : s2.line}`,
                borderRadius: 8, outline: 'none',
                fontFamily: s2.sans, fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <p style={{ fontSize: 12, color: '#c33', margin: '0 0 12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px 0',
                background: submitting ? s2.line : s2.text,
                color: s2.bg,
                border: 'none', borderRadius: 8,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: s2.sans, fontSize: 14, fontWeight: 600,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'UPDATING…' : 'UPDATE PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
