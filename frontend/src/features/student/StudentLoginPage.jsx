import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { login } from '../../api/auth.js';
import { registerStudent } from '../../api/students.js';
import { resendVerification } from '../../api/auth.js';
import { useAuth } from '../../store/useAuth.js';
import { homePathFor } from '../../routes/homePath.js';

export default function StudentLoginPage() {
  const navigate   = useNavigate();
  const _location   = useLocation();
  const setSession = useAuth((s) => s.setSession);
  const status     = useAuth((s) => s.status);
  const user       = useAuth((s) => s.user);

  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [localErr, setLocalErr] = useState(null);
  const [justRegistered, setJustRegistered] = useState(false);
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent

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
    mutationFn: () => registerStudent({ name, email, phone, password }),
    onSuccess: () => {
      /*
       * Deliberately NOT signing them in. This used to call loginMutation, which
       * under the verification gate now fails with EMAIL_UNVERIFIED — so a
       * successful registration would end on a red error, which reads as "your
       * sign-up did not work" when in fact it did.
       *
       * Show the inbox instruction instead. It is also the one moment they are
       * definitely paying attention to which address they typed.
       */
      setJustRegistered(true);
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
      /*
       * Mirrors the server rule in auth.schemas.js rather than replacing it.
       * The server is the one that decides; this exists so a mistyped number
       * comes back as a message under the form instead of a round trip that
       * returns a red 400 after the button has already said "Creating…".
       */
      const digits = phone.replace(/[\s()./-]/g, '').replace(/^\+/, '');
      if (!/^\d{7,15}$/.test(digits) || new Set(digits).size === 1) {
        setLocalErr('Enter a valid mobile number, including the country code.');
        return;
      }
      if (password !== confirm) { setLocalErr('Passwords do not match.'); return; }
      if (password.length < 10)  { setLocalErr('Password must be at least 10 characters.'); return; }
      registerMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  /*
   * The server distinguishes "unconfirmed" from "wrong password" with a code, so
   * this can offer the way forward instead of showing someone with a perfectly
   * correct password a message telling them it is wrong.
   */
  const unverified =
    loginMutation.error?.response?.data?.details?.code === 'EMAIL_UNVERIFIED';

  const handleResend = async () => {
    setResendState('sending');
    try {
      await resendVerification(email);
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

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
          {mode === 'register' && (
            <div className="student-auth-field">
              <label htmlFor="s-phone">Mobile number</label>
              {/* type="tel" so a phone keyboard opens the number pad, and
                  autoComplete="tel" so the browser can fill it. */}
              <input id="s-phone" type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 99999 99999"
                inputMode="tel" autoComplete="tel" required />
              <p className="student-auth-hint">
                Your counsellor calls this number about offers and visa deadlines.
              </p>
            </div>
          )}
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

          {/* A successful registration ends here, not signed in — the account
              exists but cannot be used until the address is confirmed. */}
          {justRegistered && (
            <div className="student-auth-notice">
              <strong>Check your inbox.</strong> We sent a confirmation link to{' '}
              {email}. Confirm it, then sign in.
            </div>
          )}

          {errorMsg && !unverified && (
            <div className="student-auth-error">{errorMsg}</div>
          )}

          {/* The way out of the gate. Without this, somebody whose confirmation
              email never arrived has no route back in at all: the resend needs
              no session precisely so it can be reached from here. */}
          {unverified && (
            <div className="student-auth-notice">
              <strong>Confirm your email first.</strong> {errorMsg}
              {resendState === 'sent' ? (
                <p style={{ margin: '8px 0 0' }}>
                  A new link is on its way to {email}.
                </p>
              ) : (
                <button
                  type="button"
                  className="student-verify-resend"
                  style={{ marginTop: 8 }}
                  onClick={handleResend}
                  disabled={resendState === 'sending'}
                >
                  {resendState === 'sending' ? 'Sending…' : 'Send a new link'}
                </button>
              )}
            </div>
          )}

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
