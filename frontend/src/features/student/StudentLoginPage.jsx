import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { login } from '../../api/auth.js';
import { registerStudent } from '../../api/students.js';
import { useAuth } from '../../store/useAuth.js';
import { homePathFor } from '../../routes/homePath.js';

export default function StudentLoginPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const setSession = useAuth((s) => s.setSession);
  const status     = useAuth((s) => s.status);
  const user       = useAuth((s) => s.user);

  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [localErr, setLocalErr] = useState(null);

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      if (data.user.role !== 'STUDENT') {
        setLocalErr('This account is not a student account. Use the partner portal instead.');
        return;
      }
      setSession(data);
      // Always go to role home — not location.state?.from — to prevent a previous
      // user's stale URL from being restored into a new session.
      navigate(homePathFor(data.user.role), { replace: true });
    },
  });

  const registerMutation = useMutation({
    mutationFn: () => registerStudent({ name, email, password }),
    onSuccess: () => {
      // After registration, log them in automatically
      loginMutation.mutate();
    },
  });

  // MUST come after every hook. When this sat above the useMutation calls the hook
  // count changed between renders, which React rejects outright — it crashed on the
  // render right after a successful login, and whenever a signed-in student opened
  // this page.
  // Any signed-in user goes to their own portal. Previously only STUDENT was
  // handled, so an agent or admin who opened this page was shown a sign-in form
  // while already authenticated — confusing, and one click from a blank page.
  if (status === 'authenticated') {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalErr(null);
    if (mode === 'register') {
      if (password !== confirm) { setLocalErr('Passwords do not match.'); return; }
      if (password.length < 10)  { setLocalErr('Password must be at least 10 characters.'); return; }
      registerMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const errorMsg  = localErr
    || (loginMutation.isError    ? loginMutation.error?.response?.data?.error    ?? 'Sign in failed.'    : null)
    || (registerMutation.isError ? registerMutation.error?.response?.data?.error ?? 'Registration failed.' : null);

  return (
    <div className="student-auth-page">
      <div className="student-auth-card">
        {/* Brand */}
        <div className="student-auth-brand">
          <div className="student-auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <div className="student-auth-brand-name">NV Immigration</div>
            <div className="student-auth-brand-sub">Student Portal</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="student-auth-tabs">
          <button type="button"
            className={`student-auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setLocalErr(null); }}>
            Sign in
          </button>
          <button type="button"
            className={`student-auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setLocalErr(null); }}>
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="student-auth-form">
          {mode === 'register' && (
            <div className="student-auth-field">
              <label htmlFor="s-name">Full name</label>
              <input id="s-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As on your passport" required />
            </div>
          )}
          <div className="student-auth-field">
            <label htmlFor="s-email">Email</label>
            <input id="s-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com" autoComplete="username" required />
          </div>
          <div className="student-auth-field">
            <label htmlFor="s-password">Password</label>
            <input id="s-password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min 10 characters' : '••••••••••'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required />
          </div>
          {mode === 'register' && (
            <div className="student-auth-field">
              <label htmlFor="s-confirm">Confirm password</label>
              <input id="s-confirm" type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password" required />
            </div>
          )}

          {errorMsg && <div className="student-auth-error">{errorMsg}</div>}

          <button type="submit" className="student-auth-btn" disabled={isPending}>
            {isPending
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p className="student-auth-switch-link">
          Are you a partner agent?{' '}
          {mode === 'login' && (
            <Link className="text-link" to="/forgot-password" style={{ marginRight: 12 }}>
              Forgot password?
            </Link>
          )}
          <Link to="/partner/login">Partner portal →</Link>
        </p>
      </div>
    </div>
  );
}
