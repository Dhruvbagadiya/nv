import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../../api/auth.js';
import { useAuth } from '../../store/useAuth.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      setSession(data);
      const redirectTo = location.state?.from || '/dashboard';
      navigate(redirectTo, { replace: true });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="login-page">
      <form className="form-card login-card" onSubmit={handleSubmit}>
        <div className="brand-mark login-mark">
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16" />
            <path d="M6 21h12" />
            <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
          </svg>
        </div>
        <h2>NV Immigration</h2>
        <div className="sub">Sign in to your partner portal</div>

        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              autoComplete="username"
              required
            />
          </div>
        </div>
        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="empty-state login-error">
            {mutation.error?.response?.data?.error || "Couldn't sign in — check your email and password."}
          </p>
        )}

        <div className="submit-row">
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
