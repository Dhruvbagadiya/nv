import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Page from '../../components/ui/Page.jsx';
import { fetchAdminStats } from '../../api/admin.js';

// Stat card with an icon, count, label and a link.
function StatCard({ icon, label, value, to, color = 'var(--accent-700)' }) {
  const body = (
    <div className="admin-stat-card" style={{ '--card-color': color }}>
      <div className="admin-stat-icon">{icon}</div>
      <div className="admin-stat-body">
        <div className="admin-stat-value">{value ?? '—'}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{body}</Link> : body;
}

// Quick-action tile
function ActionTile({ icon, label, to, description }) {
  return (
    <Link to={to} className="admin-action-tile">
      <div className="admin-action-icon">{icon}</div>
      <div>
        <div className="admin-action-label">{label}</div>
        <div className="admin-action-desc">{description}</div>
      </div>
    </Link>
  );
}

const INSTITUTION_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1"/>
  </svg>
);
const COURSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="18" cy="9" r="2.5"/>
  </svg>
);
const APP_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 3 14 8 19 8"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
  </svg>
);
const ANNOUNCE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16v9H8l-4 4z"/>
  </svg>
);
const DOC_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  </svg>
);
const COMMISSION_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>
  </svg>
);
const MOI_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 3 14 8 19 8"/><polyline points="9.5 14 11 15.5 14.5 12"/>
  </svg>
);

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <Page title="Admin Panel" subtitle="Manage content, users and settings">

      {/* ── Stats row ─────────────────────────────────────── */}
      <div className="admin-stats-grid">
        <StatCard icon={INSTITUTION_ICON} label="Institutions"
          value={isLoading ? '…' : stats?.institutions}
          to="/admin/institutions" color="var(--info-700)" />
        <StatCard icon={COURSE_ICON} label="Courses"
          value={isLoading ? '…' : stats?.courses}
          to="/admin/courses" color="var(--success-700)" />
        <StatCard icon={USER_ICON} label="Users"
          value={isLoading ? '…' : stats?.users}
          to="/admin/users" color="var(--purple-700)" />
        <StatCard icon={APP_ICON} label="Applications"
          value={isLoading ? '…' : stats?.applications}
          to="/partner/app-history" color="var(--accent-700)" />
        <StatCard icon={ANNOUNCE_ICON} label="Active banners"
          value={isLoading ? '…' : stats?.activeBanners}
          to="/admin/announcements" color="var(--warning-700)" />
        <StatCard icon={DOC_ICON} label="Documents"
          value={isLoading ? '…' : stats?.documents}
          to="/admin/documents" color="var(--teal-700)" />
      </div>

      {/* ── Quick actions ─────────────────────────────────── */}
      <h2 className="admin-section-heading">Quick actions</h2>
      <div className="admin-actions-grid">
        <ActionTile icon={INSTITUTION_ICON} label="Institutions"
          to="/admin/institutions" description="Add, edit and blacklist partner universities" />
        <ActionTile icon={COURSE_ICON} label="Courses"
          to="/admin/courses" description="Manage the programme catalogue and intakes" />
        <ActionTile icon={COMMISSION_ICON} label="Commission rates"
          to="/admin/commissions" description="Set per-institution commission tiers" />
        <ActionTile icon={MOI_ICON} label="MOI acceptances"
          to="/admin/moi" description="Track Ministry of Interior acceptance records" />
        <ActionTile icon={USER_ICON} label="Users"
          to="/admin/users" description="Create accounts and manage roles" />
        <ActionTile icon={ANNOUNCE_ICON} label="Banners"
          to="/admin/announcements" description="Control the portal-wide announcement bars" />
        <ActionTile icon={DOC_ICON} label="Document bank"
          to="/admin/documents" description="Upload visa documents, SOPs, LORs and brochures" />
        <ActionTile icon={APP_ICON} label="Applications"
          to="/partner/app-history" description="Review and advance student applications" />
      </div>
    </Page>
  );
}
