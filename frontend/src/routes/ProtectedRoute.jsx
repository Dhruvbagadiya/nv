import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';

// Pass allowedRoles to restrict a route further than "just logged in" —
// e.g. <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>.
// Omit it for routes any authenticated user can reach.
//
// This guard used to read:
//     if (allowedRoles && user && !allowedRoles.includes(user.role))
// which fails OPEN. After a page refresh the store held a token but no user, so
// `user` was null, the condition short-circuited, and any logged-in agent who
// refreshed on /admin/courses got the admin UI. The API still returned 403, so
// only the interface leaked — still not something to ship.
//
// Two changes make it fail closed: wait for the session to resolve before
// deciding anything, then require a role match rather than requiring a
// mismatch in order to reject.
export default function ProtectedRoute({ children, allowedRoles }) {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const location = useLocation();

  // Still restoring the session from the refresh cookie. Rendering either
  // outcome now would be a guess, and one of the two guesses is a security bug.
  if (status === 'loading') {
    return <div className="empty-state">Loading…</div>;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
