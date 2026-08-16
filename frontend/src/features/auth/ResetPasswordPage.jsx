import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../api/auth.js';

// Mirrors the 10-character floor the API enforces, so the button is disabled
// rather than the server rejecting what the form let the user type.
const MIN_LENGTH = 10;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
  });

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !mutation.isPending;

  // A link with no token at all is a broken paste, not an expired link — saying
  // so is more useful than letting them fill the form and fail on submit.
  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Link incomplete</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '8px 0 0', lineHeight: 1.5 }}>
            This reset link is missing its token. It may have been cut short by your email client —
            try copying the whole URL, or request a new link.
          </p>
          <p style={{ marginTop: 18 }}>
            <Link className="text-link" to="/forgot-password">Request a new link</Link>
          </p>
        </div>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Password updated</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '8px 0 0', lineHeight: 1.5 }}>
            You’ve been signed out everywhere else. Sign in with your new password.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', height: 38, justifyContent: 'center', marginTop: 16 }}
            onClick={() => navigate('/login')}
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Choose a new password</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '6px 0 16px' }}>
          Must be at least {MIN_LENGTH} characters.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="rp-password">New password</label>
            <input
              id="rp-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {tooShort && (
              <p className="field-hint" style={{ color: 'var(--warning-700)' }}>
                {MIN_LENGTH - password.length} more character
                {MIN_LENGTH - password.length === 1 ? '' : 's'} needed.
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="rp-confirm">Confirm new password</label>
            <input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && (
              <p className="field-hint" style={{ color: 'var(--danger-700)' }}>
                Passwords do not match.
              </p>
            )}
          </div>

          {mutation.isError && (
            <p className="login-error">
              {mutation.error?.response?.data?.error ?? 'Could not reset the password. Try again.'}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: 38, justifyContent: 'center', marginTop: 12 }}
            disabled={!canSubmit}
          >
            {mutation.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12.5 }}>
          <Link className="text-link" to="/forgot-password">Request a new link</Link>
        </p>
      </div>
    </div>
  );
}
