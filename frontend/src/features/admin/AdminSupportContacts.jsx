import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchSupportContacts } from '../../api/referenceScreens.js';
import {
  createSupportContact,
  updateSupportContact,
  archiveSupportContact,
  restoreSupportContact,
} from '../../api/admin.js';

// Stable reference: useUrlFilters treats `defaults` as the schema and memoises
// on its identity.
const FILTER_DEFAULTS = { status: 'active' };

const resource = {
  title: 'Support contacts',
  subtitle: 'The team shown on Help & Support',
  queryKey: ['support-contacts', 'admin'],
  createLabel: 'Add contact',
  emptyMessage: 'No support contacts published.',
  list: async (filters) => ({ items: await fetchSupportContacts(filters) }),
  create: createSupportContact,
  update: updateSupportContact,
  remove: archiveSupportContact,
  restore: restoreSupportContact,
  confirmRemove: (c) => `Remove ${c.name} from Help & Support?`,
  rowLabel: (c) => c.name,

  // This screen had no filters, so there was nowhere to list archived contacts
  // and the Restore button could never appear. The status control is appended by
  // AdminResourcePage; filterFields only has to exist for it to render.
  filterDefaults: FILTER_DEFAULTS,
  filterFields: [],

  columns: [
    { key: 'name', header: 'Name', className: 'cell-strong' },
    { key: 'phone', header: 'Phone', className: 'cell-mono' },
    { key: 'sortOrder', header: 'Order', className: 'cell-mono' },
  ],

  formFields: [
    {
      name: 'name', label: 'Name', type: 'text', required: true,
      placeholder: 'e.g. Priya Shah',
      hint: 'The person or desk an agent will be calling. Shown on the Help & Support card.',
    },
    {
      name: 'phone',
      label: 'Phone',
      type: 'text',
      required: true,
      placeholder: '+91 90000 00001',
      // The Help & Support screen strips non-digits to build tel: and wa.me links,
      // so a country code is what makes WhatsApp work.
      hint: 'Include the country code — the WhatsApp link is built from these digits.',
    },
    {
      name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0,
      hint: 'Lowest number appears first. Put the main contact at 0.',
    },
  ],

  toPayload: (v) => ({
    name: v.name,
    phone: v.phone,
    sortOrder: Number(v.sortOrder) || 0,
  }),
};

export default function AdminSupportContacts() {
  return <AdminResourcePage resource={resource} />;
}
