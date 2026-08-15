import { Link, useLocation } from 'react-router-dom';
import Page from '../components/ui/Page.jsx';

// An unmatched route used to render an empty <main> — no message, no error, no
// clue. Seven sidebar links were in exactly that state.
export default function NotFound() {
  const location = useLocation();

  return (
    <Page title="Page not found">
      <div className="empty-state">
        <div className="e-icon">
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
          </svg>
        </div>
        <h3>There’s nothing at {location.pathname}</h3>
        <p>The link may be out of date, or the page may have moved.</p>
        <Link className="btn btn-primary" to="/partner/dashboard" style={{ marginTop: 12 }}>
          Back to dashboard
        </Link>
      </div>
    </Page>
  );
}
