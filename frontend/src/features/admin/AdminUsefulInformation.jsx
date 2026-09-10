import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchUsefulInformation } from '../../api/referenceScreens.js';
import {
  createUsefulInformation,
  updateUsefulInformation,
  archiveUsefulInformation,
  restoreUsefulInformation,
} from '../../api/admin.js';

// Stable reference: useUrlFilters treats `defaults` as the schema and memoises on
// its identity.
const FILTER_DEFAULTS = { search: '', status: 'active', page: 1 };

const resource = {
  title: 'Useful information',
  subtitle: 'The notes agents see on the Report screen',
  queryKey: 'admin-useful-information',
  createLabel: 'Add note',
  emptyMessage: 'Nothing published yet — the Report panel is empty until you add something.',
  list: fetchUsefulInformation,
  create: createUsefulInformation,
  update: updateUsefulInformation,
  remove: archiveUsefulInformation,
  restore: restoreUsefulInformation,
  confirmRemove: (u) => `Archive "${u.title}"?`,
  rowLabel: (u) => u.title,

  filterDefaults: FILTER_DEFAULTS,
  filterFields: [
    { name: 'search', label: 'Search', type: 'text', placeholder: 'Title' },
  ],

  columns: [
    { key: 'title', header: 'Title', className: 'cell-strong' },
    {
      key: 'body',
      header: 'Text',
      // The panel shows the whole thing; the table only needs enough to
      // recognise the row.
      render: (u) => (u.body.length > 90 ? `${u.body.slice(0, 90)}…` : u.body),
    },
    { key: 'sortOrder', header: 'Order', className: 'cell-mono' },
  ],

  formFields: [
    {
      name: 'title', label: 'Title', type: 'text', required: true,
      placeholder: 'e.g. UK maintenance funds from January 2027',
      hint: 'The bold line in the Report panel. Keep it short enough to read at a glance.',
    },
    {
      name: 'body', label: 'Text', type: 'textarea', required: true, rows: 4,
      hint: 'Shown in full on the Report screen, so write it for an agent in a hurry.',
    },
    {
      name: 'linkUrl', label: 'Read more link', type: 'text',
      placeholder: '/documents/visa or https://…',
      hint: 'Optional. Adds a "Read more" link. A path stays inside the app; a full URL opens in a new tab.',
    },
    {
      name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0,
      // reports.service.js takes the first five by sortOrder.
      hint: 'Lowest first. Only the top five reach the Report panel, so this decides what agents actually see.',
    },
  ],

  toPayload: (v) => ({
    title: v.title,
    body: v.body,
    linkUrl: v.linkUrl || null,
    sortOrder: Number(v.sortOrder) || 0,
  }),
};

export default function AdminUsefulInformation() {
  return <AdminResourcePage resource={resource} />;
}
