import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CountryStrip from './CountryStrip.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import SubAgentButton from './SubAgentButton.jsx';
import { useAuth } from '../../store/useAuth.js';

export default function Header() {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef(null);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

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
    navigate(`/dashboard?search=${encodeURIComponent(term)}`);
    setSearch('');
    searchRef.current?.blur();
  };

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'YA';

  // Awaited so the server-side revocation is actually requested before we
  // navigate away — logout() now revokes the refresh token, not just local state.
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
        <div className="notif-wrap">
          <div
            className="avatar"
            title={user?.name || 'Your account'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {initials}
          </div>
          {menuOpen && (
            <div className="notif-panel open" style={{ width: 180 }}>
              <div className="notif-panel-head">{user?.name || 'Account'}</div>
              <button
                className="btn btn-outline"
                style={{ width: 'calc(100% - 24px)', margin: 12 }}
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
