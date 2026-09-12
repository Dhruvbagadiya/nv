import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchImportantUpdates } from '../../api/referenceScreens.js';
import {
  createImportantUpdate,
  updateImportantUpdate,
  archiveImportantUpdate,
  restoreImportantUpdate,
} from '../../api/admin.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { formatDate, toDateInput } from '../../utils/format.js';

// A date input needs yyyy-mm-dd; the API returns a full ISO timestamp.
// Shared with the two profile forms; guards the Invalid Date that would throw.

const FILTER_DEFAULTS = { countryId: '', institutionId: '', status: 'active', page: 1 };

export default function AdminUpdates() {
  const { countries, isError: countriesFailed } = useCountries();

  const countryOptions = countries.map((c) => ({ value: c.id, label: c.name }));

  const resource = {
    title: 'Important updates',
    subtitle: 'Policy and institution announcements agents see',
    queryKey: ['important-updates', 'admin'],
    createLabel: 'Add update',
    emptyMessage: 'No updates published.',
    list: fetchImportantUpdates,
    create: createImportantUpdate,
    update: updateImportantUpdate,
    remove: archiveImportantUpdate,
    restore: restoreImportantUpdate,
    confirmRemove: (u) => `Archive "${u.title}"? Agents will stop seeing it.`,

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'countryId', label: 'Country', type: 'select', placeholder: 'Any country', options: countryOptions },
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'institution',
        hint: 'Leave blank unless the update is about one university only.',
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
      {
        name: 'title', label: 'Title', type: 'text', required: true,
        placeholder: 'e.g. UKVI raises maintenance funds from January',
        hint: 'The headline agents scan in the list. Say what changed, not just the topic.',
      },
      {
        name: 'body', label: 'Update text', type: 'textarea', required: true, rows: 6,
        hint: 'The full notice, shown when an agent opens the row. Include what changed, who it affects and from when.',
      },
      {
        name: 'publishDate',
        label: 'Publish date',
        type: 'date',
        required: true,
        defaultValue: new Date().toISOString().slice(0, 10),
        hint: 'Sorts the list and drives the date filter. A future date does not hide the update — untick nothing, archive it instead.',
      },
      {
        name: 'countryId',
        label: 'Country',
        type: 'select',
        placeholder: 'All countries',
        options: countryOptions,
        optionsError: countriesFailed,
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
