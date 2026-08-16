import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { forgotPassword } from '../../api/auth.js';

// One page for all three portals. The reset link works regardless of role, so
// splitting this per portal would only add screens that behave identically —
// `?from=` just decides which login page "Back to sign in" returns to.
export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const backTo = params.get('from') === 'partner' ? '/partner/login'
    : params.get('from') === 'admin' ? '/admin/login'
    : '/login';

  const [email, setEmail] = useState('');

  const mutation = useMutation({
    mutationFn: () => forgotPassword(email.trim()),
  });

  // The success copy deliberately does not confirm the address exists — the API
  // answers identically either way, and saying "we sent it" here would give away
  // what the endpoint is careful not to.
  if (mutation.isSuccess) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Check your email</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '8px 0 0', lineHeight: 1.5 }}>
            If <strong>{email.trim()}</strong> is registered, a reset link is on its way. It expires
            in 30 minutes and can only be used once.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: 14 }}>
            Didn’t get it? Check spam, or{' '}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: 0, height: 'auto', textDecoration: 'underline' }}
              onClick={() => mutation.reset()}
            >
              try another address
            </button>
            .
          </p>
          <p style={{ marginTop: 18 }}>
            <Link className="text-link" to={backTo}>Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Forgot your password?</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-600)', margin: '6px 0 16px' }}>
          Enter your email and we’ll send you a link to set a new one.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {mutation.isError && (
            <p className="login-error">
              {mutation.error?.response?.data?.error ?? 'Something went wrong. Try again.'}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: 38, justifyContent: 'center', marginTop: 12 }}
            disabled={mutation.isPending || !email.trim()}
          >
            {mutation.isPending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12.5 }}>
          <Link className="text-link" to={backTo}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
