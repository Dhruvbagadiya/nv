import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchSupportContacts } from '../../api/referenceScreens.js';
import {
  createSupportContact,
  updateSupportContact,
  archiveSupportContact,
} from '../../api/admin.js';

const resource = {
  title: 'Support contacts',
  subtitle: 'The team shown on Help & Support',
  queryKey: 'admin-support-contacts',
  createLabel: 'Add contact',
  emptyMessage: 'No support contacts published.',
  list: async () => ({ items: await fetchSupportContacts() }),
  create: createSupportContact,
  update: updateSupportContact,
  remove: archiveSupportContact,
  confirmRemove: (c) => `Remove ${c.name} from Help & Support?`,

  columns: [
    { key: 'name', header: 'Name', className: 'cell-strong' },
    { key: 'phone', header: 'Phone', className: 'cell-mono' },
    { key: 'sortOrder', header: 'Order', className: 'cell-mono' },
  ],

  formFields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
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
    { name: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
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
