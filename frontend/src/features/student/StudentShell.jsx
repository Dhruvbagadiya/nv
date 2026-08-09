import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth.js';

export default function StudentShell({ children }) {
  const user     = useAuth((s) => s.user);
  const logout   = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="student-shell">
      <header className="student-header">
        <Link to="/programs" className="student-header-brand">
          <div className="student-header-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span className="student-header-brand-text">NV Immigration</span>
        </Link>

        <nav className="student-header-nav">
          <NavLink to="/programs"        className={({ isActive }) => `student-nav-link${isActive ? ' active' : ''}`}>Programs</NavLink>
          {user && (
            <>
              <NavLink to="/my-applications" className={({ isActive }) => `student-nav-link${isActive ? ' active' : ''}`}>My Applications</NavLink>
              <NavLink to="/profile"         className={({ isActive }) => `student-nav-link${isActive ? ' active' : ''}`}>Profile</NavLink>
            </>
          )}
        </nav>

        <div className="student-header-right">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-600)' }}>{user.name}</span>
              <button className="btn btn-outline" onClick={handleLogout} style={{ fontSize: 12, height: 28 }}>
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary" style={{ fontSize: 12, height: 28 }}>
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="student-main">
        {children}
      </main>

      <footer className="student-footer">
        <div className="student-footer-inner">
          <span>© {new Date().getFullYear()} NV Immigration</span>
          <span style={{ color: 'var(--ink-400)' }}>·</span>
          <a href="mailto:support@nvimmigration.com">Support</a>
        </div>
      </footer>
    </div>
  );
}
