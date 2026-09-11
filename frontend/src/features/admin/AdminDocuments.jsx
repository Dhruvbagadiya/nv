import { useState } from 'react';
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { toast } from '../../store/useToast.js';
import { errorMessage } from '../../utils/format.js';
import { useInvalidateResource } from '../../hooks/useInvalidateResource.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { fetchDocuments, fetchDocumentFacets } from '../../api/referenceScreens.js';
import InstitutionPicker from '../../components/ui/InstitutionPicker.jsx';
import {
  createDocument,
  updateDocument,
  archiveDocument,
  restoreDocument,
  fetchStorageStatus,
  uploadFile,
} from '../../api/admin.js';

const CATEGORIES = [
  { value: 'VISA_DOCUMENT', label: 'Visa documents' },
  { value: 'REFUND_FORM', label: 'Refund forms' },
  { value: 'INSTITUTE_BROCHURE', label: 'Institute brochures' },
  { value: 'SOP', label: 'SOP documents' },
  { value: 'LOR', label: 'LOR documents' },
];

const FILTER_DEFAULTS = { countryId: '', institutionId: '', search: '', status: 'active', page: 1 };

// Hand-written rather than using AdminResourcePage, because the form needs a file
// upload with its own progress and failure modes, which the generic config-driven
// form has no vocabulary for.
function DocumentForm({ initial, onClose, onSaved, storage }) {
  const isEdit = Boolean(initial?.id);
  const { countries } = useCountries();

  const [values, setValues] = useState({
    category: initial?.category ?? 'VISA_DOCUMENT',
    title: initial?.title ?? '',
    fileUrl: initial?.fileUrl ?? '',
    countryId: initial?.countryId ?? '',
    institutionId: initial?.institutionId ?? '',
    sortOrder: initial?.sortOrder ?? 0,
  });
  const [uploadError, setUploadError] = useState(null);

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  const upload = useMutation({
    mutationFn: (file) => uploadFile(file, values.category),
    onSuccess: (fileUrl, file) => {
      setUploadError(null);
      set('fileUrl', fileUrl);
      // Saves retyping the name; still editable, since a filename is rarely the
      // label you want agents to read.
      if (!values.title) set('title', file.name.replace(/\.[^.]+$/, ''));
    },
    onError: (e) => setUploadError(e.response?.data?.error ?? e.message),
  });

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? updateDocument(initial.id, payload) : createDocument(payload),
    onSuccess: onSaved,
  });

  const submit = (e) => {
    e.preventDefault();
    save.mutate({
      category: values.category,
      title: values.title,
      fileUrl: values.fileUrl,
      countryId: values.countryId || null,
      institutionId: values.institutionId || null,
      sortOrder: Number(values.sortOrder) || 0,
    });
  };

  const saveError =
    save.error?.response?.data?.error ?? (save.error ? 'Could not save this document.' : null);

  return (
    <Modal title={isEdit ? 'Edit document' : 'Add document'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-field">
          <label className="flabel" htmlFor="doc-category">
            Category *
          </label>
          <select
            id="doc-category"
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="doc-file">
            File
          </label>
          {/* Always show the file picker — upload goes to local disk when S3
              is not configured, or to the bucket when it is. */}
          <input
            id="doc-file"
            type="file"
            // Built from the server's own allow-list, so the picker cannot offer
            // a type putObject would reject — the rejection is a 400 after the
            // whole file has uploaded, which is a slow way to learn.
            accept={storage?.allowedContentTypes?.join(',')}
            disabled={upload.isPending}
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
          />
          {storage?.enabled ? (
            <div className="field-hint">
              Max {Math.round(storage.maxBytes / 1024 / 1024)} MB · uploaded to cloud storage.
            </div>
          ) : (
            <div className="field-hint">
              Saved to the server&rsquo;s local disk. Configure S3/R2 env vars to use cloud storage instead.
            </div>
          )}
          {upload.isPending && (
            <div className="field-hint" style={{ color: 'var(--accent-700)' }}>Uploading…</div>
          )}
          {uploadError && <p className="form-error">{uploadError}</p>}
          {values.fileUrl && !upload.isPending && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span className="row gap-1 c-success fw-6"><Icon name="check" size={14} />File ready</span>
              <a href={values.fileUrl} target="_blank" rel="noopener noreferrer" className="alert-link">
                Preview
              </a>
            </div>
          )}
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="doc-url">
            File URL *
          </label>
          <input
            id="doc-url"
            type="text"
            value={values.fileUrl}
            onChange={(e) => set('fileUrl', e.target.value)}
            placeholder="/files/visa_document/example.pdf or https://…"
            required
          />
          <div className="field-hint">Filled in automatically after an upload.</div>
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="doc-title">
            Title *
          </label>
          <input
            id="doc-title"
            type="text"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            required
          />
          <div className="field-hint">This is the label agents see on the tile.</div>
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="doc-country">
            Country
          </label>
          <select
            id="doc-country"
            value={values.countryId}
            onChange={(e) => set('countryId', e.target.value)}
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <InstitutionPicker
          id="doc-institution"
          value={values.institutionId}
          selectedLabel={initial?.institution?.name}
          onChange={(next) => set('institutionId', next)}
          hint="Optional. Leave blank for a document that applies to every institution."
        />

        <div className="form-field">
          <label className="flabel" htmlFor="doc-sort">
            Sort order
          </label>
          <input
            id="doc-sort"
            type="number"
            value={values.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
          />
        </div>

        {saveError && <p className="form-error">{saveError}</p>}

        <div className="submit-row">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={save.isPending || upload.isPending || !values.fileUrl}
          >
            {save.isPending ? 'Saving…' : 'Save document'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminDocuments() {
  const [category, setCategory] = useState('VISA_DOCUMENT');
  const [editing, setEditing] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);

  // Checked up front so the form can say uploads are unavailable before someone
  // picks a file and waits for a failure.
  const { data: storage } = useQuery({
    queryKey: ['storage-status'],
    queryFn: fetchStorageStatus,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // SOP alone runs to 58 documents over two pages, and without this the table
  // empties to its loading state on every page change.
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['admin-documents', category, applied],
    queryFn: () => fetchDocuments({ ...applied, category }),
    placeholderData: keepPreviousData,
  });

  // Filter options come from what this category actually has, not the full
  // country and institution lists. Every imported document is unscoped, so the
  // full lists offered ~1,255 institutions that each returned an empty table —
  // which reads as a broken filter rather than an empty one. Same endpoint the
  // agent-facing Document Bank uses; if documents get scoped later the
  // dropdowns come back on their own.
  const { data: facets } = useQuery({
    queryKey: ['document-facets', category],
    queryFn: () => fetchDocumentFacets(category),
    staleTime: 10 * 60 * 1000,
  });

  const invalidate = useInvalidateResource('documents');
  // Archiving and restoring had no error surface at all, so a refusal looked
  // exactly like a success: the row simply stayed as it was.
  const archive = useMutation({
    mutationFn: archiveDocument,
    onSuccess: () => { invalidate(); toast.success('Document archived.'); },
    onError: (e) => toast.error(errorMessage(e, 'Could not archive that document.')),
  });
  const restore = useMutation({
    mutationFn: restoreDocument,
    onSuccess: () => { invalidate(); toast.success('Document restored.'); },
    onError: (e) => toast.error(errorMessage(e, 'Could not restore that document.')),
  });

  const columns = [
    { key: 'title', header: 'Title', className: 'cell-strong' },
    {
      key: 'fileUrl',
      header: 'File',
      render: (d) => (
        <a className="text-link" href={d.fileUrl} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (d) => d.institution?.name ?? d.country?.name ?? 'All',
    },
    { key: 'sortOrder', header: 'Order', className: 'cell-mono' },
    // Only meaningful under Archived/All, but a column that appears and
    // disappears is more confusing than one that reads "Active".
    {
      key: 'archivedAt',
      header: 'Status',
      render: (d) => (d.archivedAt ? 'Archived' : 'Active'),
    },
    {
      key: '__actions',
      header: 'Actions',
      render: (d) => (
        <div className="action-row">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(d)}>
            Edit
          </button>
          {d.archivedAt ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => restore.mutate(d.id)}
              disabled={restore.isPending}
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.confirm(`Archive "${d.title}"?`) && archive.mutate(d.id)}
              disabled={archive.isPending}
            >
              Archive
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Document bank"
      subtitle="Templates and reference files agents download"
      actions={
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          Add document
        </button>
      }
    >
      {/* Category is a tab strip, not a filter: the API requires one, and there is
          no combined view. */}
      <div className="level-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`chip${category === c.value ? ' chip-active' : ''}`}
            onClick={() => {
              setCategory(c.value);
              // The page lives in the URL and the tab does not, so without this
              // a switch from SOP page 3 to a category with one page asks for
              // page 3, gets nothing back, and reads "No documents in this
              // category yet" for a category that has several.
              setPage(1);
            }}
            aria-pressed={category === c.value}
          >
            {c.label}
          </button>
        ))}
      </div>

      <FilterBar
        fields={[
          // A dropdown with nothing behind it is hidden rather than shown empty.
          ...(facets?.countries?.length
            ? [{
                name: 'countryId',
                label: 'Country',
                type: 'select',
                placeholder: 'Any country',
                options: facets.countries.map((c) => ({ value: c.id, label: c.name })),
              }]
            : []),
          ...(facets?.institutions?.length
            ? [{
                name: 'institutionId',
                label: 'Institution',
                type: 'select',
                placeholder: 'Any institution',
                options: facets.institutions.map((i) => ({ value: i.id, label: i.name })),
              }]
            : []),
          { name: 'search', label: 'Search', type: 'text', placeholder: 'Document title' },
          // Archiving is a soft delete with a restore endpoint, but nothing
          // listed archived rows, so the Restore button could never be reached
          // and every Archive was effectively permanent from this screen.
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            placeholder: 'Active',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'all', label: 'All' },
            ],
          },
        ]}
        values={draft}
        onChange={setField}
        onApply={apply}
        onClear={clear}
        busy={isFetching}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        isError={isError}
        error={error}
        emptyMessage="No documents in this category yet."
        meta={data?.meta}
        onPageChange={setPage}
      />

      {editing && (
        <DocumentForm
          initial={editing.id ? editing : { category }}
          storage={storage}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}
