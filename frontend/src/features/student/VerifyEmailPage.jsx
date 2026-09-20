import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../../api/auth.js';
import { useAuth } from '../../store/useAuth.js';

/*
 * The page the confirmation link in the welcome email lands on.
 *
 * Reached by someone who may or may not be signed in — the link is clicked from
 * an inbox, quite possibly on a different device from the one they registered
 * on — so nothing here requires a session. The token in the URL is the whole
 * credential.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  // patchUser is a no-op when nobody is signed in on this device, which is the
  // common case: the link is often opened on a phone after registering on a
  // laptop. No branching needed.
  const patchUser = useAuth((s) => s.patchUser);

  const [state, setState] = useState(token ? 'working' : 'missing');
  const [message, setMessage] = useState('');

  // The way out of a dead link. Kept on this page rather than pointing at the
  // sign-in screen: under the hard gate an unconfirmed account cannot sign in,
  // so "sign in and use the banner" — which this page used to say — is advice
  // that cannot be followed. Whoever is reading an expired link needs a new one
  // sent from here, and the resend endpoint takes an address precisely so it
  // can be called without a session.
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent

  /*
   * React 18 mounts effects twice in development StrictMode. The token is
   * single-use, so without this guard the second call spends a token the first
   * call already consumed and the page reports failure for a confirmation that
   * actually succeeded.
   */
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    let alive = true;
    verifyEmail(token)
      .then(() => {
        if (!alive) return;
        setState('done');
        // If they are signed in on this device, drop the banner and re-enable
        // the apply button without needing a reload.
        patchUser({ emailVerifiedAt: new Date().toISOString() });
      })
      .catch((err) => {
        if (!alive) return;
        setMessage(err?.response?.data?.error ?? 'This confirmation link is not valid.');
        setState('failed');
      });

    return () => { alive = false; };
  }, [token, patchUser]);

  return (
    <div className="student-auth-page">
      <div className="student-auth-card" style={{ textAlign: 'center' }}>
        {state === 'working' && (
          <>
            <h1 className="student-auth-title">Confirming your email…</h1>
            <p className="student-auth-sub">One moment.</p>
          </>
        )}

        {state === 'done' && (
          <>
            <h1 className="student-auth-title">Email confirmed</h1>
            <p className="student-auth-sub">
              Thanks — your address is verified. You can now submit applications.
            </p>
            <Link to="/programs" className="student-apply-btn" style={{ marginTop: 16 }}>
              Browse programs
            </Link>
          </>
        )}

        {(state === 'failed' || state === 'missing') && (
          <>
            <h1 className="student-auth-title">Link not valid</h1>
            <p className="student-auth-sub">
              {state === 'missing'
                ? 'This page needs a confirmation link from your email.'
                : message}
            </p>

            {resendState === 'sent' ? (
              <div className="student-auth-notice" style={{ marginTop: 16 }}>
                <strong>Check your inbox.</strong> If {resendEmail} has an account
                awaiting confirmation, a new link is on its way. It expires in 24 hours.
              </div>
            ) : (
              <form
                style={{ marginTop: 18, textAlign: 'left' }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setResendState('sending');
                  // Deliberately no error branch. The endpoint answers
                  // identically for a registered address, an unknown one and an
                  // already-verified one so it cannot be used to discover who
                  // has an account — so there is nothing truthful to report
                  // except that it was sent.
                  try { await resendVerification(resendEmail); } catch { /* see above */ }
                  setResendState('sent');
                }}
              >
                <div className="student-auth-field">
                  <label htmlFor="v-email">Send a new link</label>
                  <input
                    id="v-email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="student-apply-btn"
                  style={{ marginTop: 10, width: '100%' }}
                  disabled={resendState === 'sending'}
                >
                  {resendState === 'sending' ? 'Sending…' : 'Email me a new link'}
                </button>
              </form>
            )}

            <p className="student-auth-sub" style={{ marginTop: 14 }}>
              Already confirmed? <Link to="/login">Sign in</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
