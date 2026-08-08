import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { login } from '../../api/auth.js';
import { useAuth } from '../../store/useAuth.js';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export default function AdminLoginPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const setSession = useAuth((s) => s.setSession);
  const status     = useAuth((s) => s.status);
  const user       = useAuth((s) => s.user);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      if (!ADMIN_ROLES.includes(data.user.role)) {
        mutation.reset();
        return;
      }
      setSession(data);
      navigate(location.state?.from ?? '/admin', { replace: true });
    },
  });

  // Already signed in as admin — skip the login page.
  if (status === 'authenticated' && ADMIN_ROLES.includes(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  // Detect "wrong role" — logged in but not admin.
  const wrongRole =
    mutation.isSuccess && !ADMIN_ROLES.includes(mutation.data?.user?.role);

  const errorMsg = wrongRole
    ? 'This account does not have admin access.'
    : mutation.error?.response?.data?.error ?? (mutation.isError ? 'Invalid email or password.' : null);

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Brand */}
        <div className="admin-login-brand">
          <div className="admin-login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="1"/>
              <path d="M9 21v-4h6v4"/>
              <path d="M9 7h1M14 7h1M9 11h1M14 11h1"/>
            </svg>
          </div>
          <div>
            <div className="admin-login-title">NV Immigration</div>
            <div className="admin-login-sub">Admin Portal</div>
          </div>
        </div>

        <h2 className="admin-login-heading">Sign in to admin panel</h2>
        <p className="admin-login-desc">Access is restricted to administrators only.</p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-field">
            <label htmlFor="al-email">Email</label>
            <input
              id="al-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="admin-login-field">
            <label htmlFor="al-password">Password</label>
            <input
              id="al-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {errorMsg && (
            <div className="admin-login-error">{errorMsg}</div>
          )}

          <button
            type="submit"
            className="admin-login-btn"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <a href="/partner/login" className="admin-login-switch">
          Go to Partner Portal →
        </a>
      </div>
    </div>
  );
}
