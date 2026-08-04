import { Link } from 'react-router-dom';

// The Report screen's stat tiles: a label with a count badge. In the reference
// they are inert; here each one links to the list it counts, because a dashboard
// number you cannot drill into is a dead end.
export default function StatTile({ label, value, to }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? 0}</span>
    </>
  );

  if (!to) return <div className="stat-tile">{body}</div>;
  return (
    <Link className="stat-tile stat-tile-link" to={to}>
      {body}
    </Link>
  );
}

export function StatTileGrid({ children }) {
  return <div className="stat-grid">{children}</div>;
}
