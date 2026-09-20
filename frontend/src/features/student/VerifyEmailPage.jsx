import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../../api/auth.js';
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
            {/* Deliberately points at sign-in rather than offering a resend
                button: resending needs a session, and whoever is looking at a
                dead link may not have one. */}
            <p className="student-auth-sub" style={{ marginTop: 10 }}>
              Sign in and use the banner at the top of the page to send a new one.
            </p>
            <Link to="/login" className="student-apply-btn" style={{ marginTop: 16 }}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
