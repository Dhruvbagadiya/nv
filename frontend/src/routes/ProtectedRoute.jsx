import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';
import { homePathFor, loginPathForArea } from './homePath.js';

/**
 * allowedRoles — if set, the user must hold one of these roles
 * loginPath    — where to send unauthenticated visitors. Defaults to the sign-in
 *                page for the area they were trying to reach.
 * redirectPath — optional override for where to send an authenticated user whose
 *                role is not allowed. Defaults to that user's OWN home, which is
 *                the only target guaranteed not to reject them again.
 *
 * Two failures this guards against, both previously live:
 *
 *  1. Fail-open. The check used to read `allowedRoles && user && !includes(...)`,
 *     which short-circuits when user is null and lets the page render.
 *  2. Redirect dead-end. redirectPath was a fixed route inside the same guarded
 *     area, so a student sent to /partner/dashboard was rejected and redirected
 *     again — the guard rendered only a <Navigate> and the page came up blank.
 */
export default function ProtectedRoute({ children, allowedRoles, loginPath, redirectPath }) {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const location = useLocation();

  // Still restoring the session from the refresh cookie. Rendering either outcome
  // now would be a guess, and one of the guesses is a security bug.
  if (status === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: 13,
          color: 'var(--ink-500)',
        }}
      >
        Loading…
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Navigate
        to={loginPath ?? loginPathForArea(location.pathname)}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Fails closed: requires a match rather than requiring a mismatch to reject.
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const target = redirectPath ?? homePathFor(user?.role);
    // Never redirect into the area we are already refusing — that is precisely the
    // loop that rendered a blank page.
    const safeTarget = location.pathname.startsWith(target) ? homePathFor(user?.role) : target;
    return <Navigate to={safeTarget} replace />;
  }

  return children;
}
