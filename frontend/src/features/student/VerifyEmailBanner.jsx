import { useState } from 'react';
import { resendVerification } from '../../api/auth.js';
import { useAuth } from '../../store/useAuth.js';

/*
 * Shown to a signed-in student whose address has not been confirmed.
 *
 * Deliberately a banner and not a blocking screen. The account is real enough to
 * browse with — what it cannot do is submit an application, because those go to
 * partner institutions under NV's name. Locking someone out of the catalogue
 * until they find an email would lose applicants to fix a problem that only
 * exists at the point of submission.
 *
 * Renders nothing at all for a verified user, a non-student, or a signed-out
 * visitor, so the shell can mount it unconditionally.
 */
export default function VerifyEmailBanner() {
  const user = useAuth((s) => s.user);
  const [state, setState] = useState('idle'); // idle | sending | sent | failed

  if (!user || user.role !== 'STUDENT' || user.emailVerifiedAt) return null;

  const handleResend = async () => {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="student-verify-banner" role="status">
      <p>
        <strong>Confirm your email.</strong>{' '}
        {state === 'sent'
          ? `A new link is on its way to ${user.email}. It expires in 24 hours.`
          : state === 'failed'
            ? 'We could not send that just now — please try again in a few minutes.'
            : `We sent a link to ${user.email}. You can browse programs now, but you will need to confirm before submitting an application.`}
      </p>
      {/* Hidden once sent: the endpoint is rate-limited, and a button that
          invites a second click straight after a successful send is a button
          that earns its user a 429. */}
      {state !== 'sent' && (
        <button
          type="button"
          className="student-verify-resend"
          onClick={handleResend}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? 'Sending…' : 'Resend link'}
        </button>
      )}
    </div>
  );
}
