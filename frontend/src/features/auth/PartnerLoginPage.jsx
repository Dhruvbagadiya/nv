import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { login } from '../../api/auth.js';
import { useAuth } from '../../store/useAuth.js';

const PARTNER_ROLES = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

export default function PartnerLoginPage() {
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
      setSession(data);
      const from = location.state?.from ?? '/partner/dashboard';
      navigate(from, { replace: true });
    },
  });

  if (status === 'authenticated' && PARTNER_ROLES.includes(user?.role)) {
    return <Navigate to="/partner/dashboard" replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="login-page">
      <form className="form-card login-card" onSubmit={handleSubmit}>
        <div className="brand-mark login-mark">
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"/>
            <path d="M6 21h12"/>
            <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>
          </svg>
        </div>
        <h2>NV Immigration</h2>
        <div className="sub">Sign in to your partner portal</div>

        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Email</div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com" autoComplete="username" required />
          </div>
        </div>
        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Password</div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" required />
          </div>
        </div>

        {mutation.isError && (
          <p className="empty-state login-error">
            {mutation.error?.response?.data?.error ?? "Couldn't sign in — check your credentials."}
          </p>
        )}

        <div className="submit-row">
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-500)', textAlign: 'center' }}>
          Are you a student?{' '}
          <a href="/login" style={{ color: 'var(--accent-700)', fontWeight: 600 }}>Student portal →</a>
        </p>
      </form>
    </div>
  );
}
