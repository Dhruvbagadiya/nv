import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';

/**
 * allowedRoles  — if set, user must have one of these roles
 * loginPath     — where to redirect unauthenticated users (default /partner/login)
 * redirectPath  — where to send authenticated users who lack the required role
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
  loginPath    = '/partner/login',
  redirectPath = '/partner/dashboard',
}) {
  const status = useAuth((s) => s.status);
  const user   = useAuth((s) => s.user);
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', fontSize: 13, color: 'var(--ink-500)' }}>
        Loading…
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}
