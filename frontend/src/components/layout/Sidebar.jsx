import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navConfig } from './navConfig.js';
import { useAuth } from '../../store/useAuth.js';

// Structural pattern carried over directly from the HTML mockup:
// fixed brand header -> scrollable nav middle -> fixed agent footer.
// This is what prevented the brand from scrolling out of view under the header —
// keep the three-part split when editing.

function Chevron() {
  return (
    <svg
      className="icon-svg chev"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// A nav entry with `children` is a disclosure, not a link. Entry Requirements and
// Document Bank both expand in the reference screenshots.
function NavGroup({ item }) {
  const location = useLocation();
  // Auto-open when a child is the active route — arriving at /documents/sop from a
  // bookmark should not show a collapsed group with no indication of where you are.
  const containsActive = item.children.some((c) => location.pathname.startsWith(c.path));
  const [open, setOpen] = useState(containsActive);
  const expanded = open || containsActive;

  return (
    <div>
      <button
        type="button"
        className={`sidebar-item side-group-toggle${containsActive ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expanded}
      >
        <span className="icon" dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
        <span className="side-text">{item.label}</span>
        <span className="side-text">
          <Chevron />
        </span>
      </button>

      <div className={`side-children${expanded ? ' open' : ''}`}>
        {item.children.map((child) => (
          <NavLink
            key={child.path}
            to={child.path}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          >
            <span className="side-text">• {child.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const user = useAuth((s) => s.user);
  const role = user?.role;

  // A section with no `roles` field is visible to everyone; a section with `roles`
  // only renders if the current user's role is in that list.
  const visibleSections = navConfig.filter(
    (section) => !section.roles || section.roles.includes(role)
  );

  return (
    <div className="sidebar" id="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16" />
            <path d="M6 21h12" />
            <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
          </svg>
        </div>
        <div className="brand-text">
          <div className="b-name">NV Immigration</div>
          <div className="b-sub">Partner Portal</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {visibleSections.map((section) => (
          <div key={section.label || 'core'}>
            {section.label && <div className="side-label">{section.label}</div>}
            <div className="side-section">
              {section.items.map((item) =>
                item.children ? (
                  <NavGroup key={item.label} item={item} />
                ) : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                  >
                    <span className="icon" dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                    <span className="side-text">{item.label}</span>
                  </NavLink>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="sidebar-agent">
          <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'YA'}
          </div>
          <div>
            <div className="a-name">{user?.name || 'Agent name'}</div>
            <div className="a-role">
              {user?.role === 'AGENT' ? 'Partner Agency' : user?.role || 'Partner Agency'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
