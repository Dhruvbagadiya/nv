import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountryStrip from './CountryStrip.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import { useAuth } from '../../store/useAuth.js';

export default function Header() {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'YA';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-header">
      <button className="menu-toggle" aria-label="Open menu">
        <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <CountryStrip />

      <div className="header-search">
        <span className="search-icon">
          <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="6" />
            <line x1="20" y1="20" x2="14.5" y2="14.5" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="kbd-hint">/</span>
      </div>

      <div className="header-right">
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
  );
}
