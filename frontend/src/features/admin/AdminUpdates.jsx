import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchImportantUpdates } from '../../api/referenceScreens.js';
import {
  createImportantUpdate,
  updateImportantUpdate,
  archiveImportantUpdate,
} from '../../api/admin.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { formatDate } from '../../utils/format.js';

// A date input needs yyyy-mm-dd; the API returns a full ISO timestamp.
const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

const FILTER_DEFAULTS = { countryId: '', institutionId: '', page: 1 };

export default function AdminUpdates() {
  const { countries } = useCountries();

  const countryOptions = countries.map((c) => ({ value: c.id, label: c.name }));

  const resource = {
    title: 'Important updates',
    subtitle: 'Policy and institution announcements agents see',
    queryKey: 'admin-important-updates',
    createLabel: 'Add update',
    emptyMessage: 'No updates published.',
    list: fetchImportantUpdates,
    create: createImportantUpdate,
    update: updateImportantUpdate,
    remove: archiveImportantUpdate,
    confirmRemove: (u) => `Archive "${u.title}"? Agents will stop seeing it.`,

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'countryId', label: 'Country', type: 'select', placeholder: 'Any country', options: countryOptions },
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'institution',
      },
    ],

    columns: [
      { key: 'title', header: 'Title', className: 'cell-strong' },
      { key: 'body', header: 'Update', render: (u) => <span className="clamp-2">{u.body}</span> },
      { key: 'publishDate', header: 'Published', render: (u) => formatDate(u.publishDate) },
      { key: 'scope', header: 'Scope', render: (u) => u.institution?.name ?? u.country?.name ?? 'All' },
      {
        key: 'attachmentUrl',
        header: 'Attachment',
        render: (u) =>
          u.attachmentUrl ? (
            <a className="text-link" href={u.attachmentUrl} target="_blank" rel="noopener noreferrer">
              View
            </a>
          ) : (
            '—'
          ),
      },
    ],

    formFields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'body', label: 'Update text', type: 'textarea', required: true, rows: 6 },
      {
        name: 'publishDate',
        label: 'Publish date',
        type: 'date',
        required: true,
        defaultValue: new Date().toISOString().slice(0, 10),
      },
      {
        name: 'countryId',
        label: 'Country',
        type: 'select',
        placeholder: 'All countries',
        options: countryOptions,
        hint: 'Leave blank for an update that applies everywhere.',
      },
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'institution',
      },
      {
        name: 'attachmentUrl',
        label: 'Attachment',
        type: 'file',
        category: 'update-attachments',
        // The download icon on the agent-facing screen only renders when this is set.
        hint: 'Optional. When set, agents get a download button on this row.',
      },
    ],

    toForm: (u) => ({ ...u, publishDate: toDateInput(u.publishDate) }),

    toPayload: (v) => ({
      title: v.title,
      body: v.body,
      publishDate: v.publishDate,
      countryId: v.countryId || null,
      institutionId: v.institutionId || null,
      attachmentUrl: v.attachmentUrl || null,
    }),
  };

  return <AdminResourcePage resource={resource} />;
}
