import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import { fetchDocuments } from '../../api/referenceScreens.js';
import {
  createDocument,
  updateDocument,
  archiveDocument,
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

const FILTER_DEFAULTS = { countryId: '', institutionId: '', search: '', page: 1 };

// Hand-written rather than using AdminResourcePage, because the form needs a file
// upload with its own progress and failure modes, which the generic config-driven
// form has no vocabulary for.
function DocumentForm({ initial, onClose, onSaved, storage }) {
  const isEdit = Boolean(initial?.id);
  const { countries } = useCountries();
  const { options: institutionOptions } = useInstitutions();

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
            disabled={upload.isPending}
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
          />
          {storage?.enabled ? (
            <div className="field-hint">
              Max {Math.round(storage.maxBytes / 1024 / 1024)} MB · uploaded to cloud storage.
            </div>
          ) : (
            <div className="field-hint">
              Saved to the server's local disk. Configure S3/R2 env vars to use cloud storage instead.
            </div>
          )}
          {upload.isPending && (
            <div className="field-hint" style={{ color: 'var(--accent-700)' }}>Uploading…</div>
          )}
          {uploadError && <p className="form-error">{uploadError}</p>}
          {values.fileUrl && !upload.isPending && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--success-700)', fontWeight: 600 }}>✓ File ready</span>
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

        <div className="form-field">
          <label className="flabel" htmlFor="doc-institution">
            Institution
          </label>
          <select
            id="doc-institution"
            value={values.institutionId}
            onChange={(e) => set('institutionId', e.target.value)}
          >
            <option value="">All institutions</option>
            {institutionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

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
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('VISA_DOCUMENT');
  const [editing, setEditing] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries } = useCountries();
  const { options: institutionOptions } = useInstitutions();

  // Checked up front so the form can say uploads are unavailable before someone
  // picks a file and waits for a failure.
  const { data: storage } = useQuery({
    queryKey: ['storage-status'],
    queryFn: fetchStorageStatus,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['admin-documents', category, applied],
    queryFn: () => fetchDocuments({ ...applied, category }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
  const archive = useMutation({ mutationFn: archiveDocument, onSuccess: invalidate });

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
    {
      key: '__actions',
      header: 'Actions',
      render: (d) => (
        <div className="action-row">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(d)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => window.confirm(`Archive "${d.title}"?`) && archive.mutate(d.id)}
            disabled={archive.isPending}
          >
            Archive
          </button>
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
            onClick={() => setCategory(c.value)}
            aria-pressed={category === c.value}
          >
            {c.label}
          </button>
        ))}
      </div>

      <FilterBar
        fields={[
          {
            name: 'countryId',
            label: 'Country',
            type: 'select',
            placeholder: 'Any country',
            options: countries.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: 'institutionId',
            label: 'Institution',
            type: 'select',
            placeholder: 'Any institution',
            options: institutionOptions,
          },
          { name: 'search', label: 'Search', type: 'text', placeholder: 'Document title' },
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
