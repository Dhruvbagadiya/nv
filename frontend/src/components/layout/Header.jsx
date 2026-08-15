import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import CountryStrip from './CountryStrip.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import SubAgentButton from './SubAgentButton.jsx';
import { useAuth } from '../../store/useAuth.js';
import { homePathFor } from '../../routes/homePath.js';

const ROLE_LABEL = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  AGENT:       'Partner Agent',
  STUDENT:     'Student',
};
const ROLE_COLOR = {
  SUPER_ADMIN: { background: 'var(--purple-100)', color: 'var(--purple-700)' },
  ADMIN:       { background: 'var(--info-100)',   color: 'var(--info-700)' },
  AGENT:       { background: 'var(--success-100)',color: 'var(--success-700)' },
  STUDENT:     { background: 'var(--accent-100)', color: 'var(--accent-700)' },
};

export default function Header() {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef(null);
  const menuRef   = useRef(null);
  const user      = useAuth((s) => s.user);
  const logout    = useAuth((s) => s.logout);
  const navigate  = useNavigate();
  const location  = useLocation();

  // Close the profile menu when clicking outside it.
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Profile path depends on the portal the user is in.
  const profilePath = user?.role === 'STUDENT'
    ? '/profile'
    : user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
      ? '/admin/profile'
      : '/partner/profile';

  // F-14: the sidebar is off-canvas below 900px and the hamburger had no onClick,
  // so on a phone there was no way to reach the navigation at all. The CSS for it
  // already existed (`body.sidebar-open .sidebar`), just unused.
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', navOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [navOpen]);

  // Close the drawer on navigation, or it stays open over the page just reached.
  // Adjusted during render rather than in an effect: setState inside an effect
  // causes a second render pass, and React documents this pattern for
  // "reset state when something changes".
  const [navPath, setNavPath] = useState(location.pathname);
  if (navPath !== location.pathname) {
    setNavPath(location.pathname);
    setNavOpen(false);
  }

  // F-15: the search box advertised a "/" shortcut that did nothing. Now it
  // focuses the field, and submitting searches the course catalogue.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setNavOpen(false);
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    // The dashboard is the course catalogue, and its search covers course title,
    // institution and city.
    navigate(`/partner/dashboard?search=${encodeURIComponent(term)}`);
    setSearch('');
    searchRef.current?.blur();
  };

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'YA';

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    // Navigate to the login page for whatever portal the user was in.
    const loginPath = user?.role === 'STUDENT'
      ? '/login'
      : user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
        ? '/admin/login'
        : '/partner/login';
    navigate(loginPath, { replace: true });
  };

  return (
    <>
      {/* The CSS for this existed (`body.sidebar-open .sidebar-overlay`) but no
          component ever rendered it, so there was nothing to dim or tap-to-close.
          position:fixed, so its place in the tree does not matter. */}
      <div
        className="sidebar-overlay"
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
    <div className="app-header">
      <button
        className="menu-toggle"
        aria-label={navOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((o) => !o)}
      >
        <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <CountryStrip />

      <form className="header-search" onSubmit={submitSearch} role="search">
        <span className="search-icon">
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="6" />
            <line x1="20" y1="20" x2="14.5" y2="14.5" />
          </svg>
        </span>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search courses"
        />
        <span className="kbd-hint">/</span>
      </form>

      <div className="header-right">
        {/* The person+ action from the reference header. Renders only for top-level
            agents, since only they can have sub-agents. */}
        <SubAgentButton />
        <NotificationDropdown />
        <div className="notif-wrap" ref={menuRef}>
          <button
            className="header-avatar-btn"
            aria-label="Account menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="header-avatar-img" />
            ) : (
              <div className="avatar" title={user?.name || 'Your account'}>
                {initials}
              </div>
            )}
          </button>

          {menuOpen && (
            <div className="header-profile-menu">
              {/* User info block */}
              <div className="header-profile-menu-top">
                <div className="header-profile-menu-avatar">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="header-profile-menu-info">
                  <div className="header-profile-menu-name">{user?.name}</div>
                  <div className="header-profile-menu-email">{user?.email}</div>
                  <span className="profile-role-badge" style={ROLE_COLOR[user?.role] ?? {}}>
                    {ROLE_LABEL[user?.role] ?? user?.role}
                  </span>
                </div>
              </div>

              <div className="header-profile-menu-divider" />

              {/* Navigation links — role-aware */}
              <Link to={profilePath} className="header-profile-menu-item" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                My profile
              </Link>

              {user?.role === 'AGENT' && !user?.parentAgentId && (
                <Link to="/partner/settings" className="header-profile-menu-item" onClick={() => setMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Agency settings
                </Link>
              )}

              {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <Link to="/admin" className="header-profile-menu-item" onClick={() => setMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
                  Admin panel
                </Link>
              )}

              {user?.role === 'STUDENT' && (
                <Link to="/my-applications" className="header-profile-menu-item" onClick={() => setMenuOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/></svg>
                  My applications
                </Link>
              )}

              <div className="header-profile-menu-divider" />

              <button className="header-profile-menu-item header-profile-menu-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
