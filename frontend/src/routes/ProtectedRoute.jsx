import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';

// Pass allowedRoles to restrict a route further than "just logged in" —
// e.g. <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>.
// Omit it for routes any authenticated user (agent or admin) can reach.
export default function ProtectedRoute({ children, allowedRoles }) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const user = useAuth((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
