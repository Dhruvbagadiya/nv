import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import {
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../api/admin.js';

// The two banners above every screen. Editable here so changing the wording, or
// taking one down, does not need a deploy.
const VARIANTS = [
  { value: 'DANGER', label: 'Danger (red)' },
  { value: 'INFO', label: 'Info (blue)' },
  { value: 'WARNING', label: 'Warning (amber)' },
];

const resource = {
  title: 'Announcements',
  subtitle: 'Banners shown above every page',
  queryKey: 'admin-announcements',
  createLabel: 'Add banner',
  emptyMessage: 'No banners configured.',
  list: fetchAllAnnouncements,
  create: createAnnouncement,
  update: updateAnnouncement,
  remove: deleteAnnouncement,
  confirmRemove: () => 'Delete this banner permanently? Use "Active" to hide it instead.',

  columns: [
    {
      key: 'variant',
      header: 'Style',
      render: (a) => <span className={`variant-chip ${a.variant.toLowerCase()}`}>{a.variant}</span>,
    },
    { key: 'message', header: 'Message', render: (a) => <span className="clamp-2">{a.message}</span> },
    { key: 'ctaLabel', header: 'Button', render: (a) => a.ctaLabel || '—' },
    {
      key: 'isActive',
      header: 'Active',
      render: (a) => (
        <span className={`status-pill ${a.isActive ? 'offer' : 'submission'}`}>
          {a.isActive ? 'Live' : 'Hidden'}
        </span>
      ),
    },
    { key: 'sortOrder', header: 'Order', className: 'cell-mono' },
  ],

  formFields: [
    { name: 'variant', label: 'Style', type: 'select', options: VARIANTS, required: true, defaultValue: 'INFO' },
    { name: 'message', label: 'Message', type: 'textarea', required: true, rows: 3 },
    {
      name: 'ctaLabel',
      label: 'Button label',
      type: 'text',
      placeholder: 'e.g. Click for list',
      hint: 'Leave both button fields empty for a banner with no action.',
    },
    {
      name: 'ctaUrl',
      label: 'Button link',
      type: 'text',
      placeholder: '/documents/visa or https://…',
      // The API enforces this too; saying it here avoids a round trip to find out.
      hint: 'Required if a button label is set. A path stays inside the app; a full URL opens in a new tab.',
    },
    { name: 'isActive', label: 'Active (visible to agents)', type: 'checkbox', defaultValue: true },
    { name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
  ],

  toPayload: (v) => ({
    variant: v.variant,
    message: v.message,
    // Empty strings become null: the API's optional fields accept null, and "" would
    // render as an empty button.
    ctaLabel: v.ctaLabel || null,
    ctaUrl: v.ctaUrl || null,
    isActive: Boolean(v.isActive),
    sortOrder: Number(v.sortOrder) || 0,
  }),
};

export default function AdminAnnouncements() {
  return <AdminResourcePage resource={resource} />;
}
