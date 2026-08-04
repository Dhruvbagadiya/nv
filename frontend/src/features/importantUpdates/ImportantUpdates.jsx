import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import { fetchImportantUpdates } from '../../api/referenceScreens.js';
import { formatDate } from '../../utils/format.js';

const FILTER_DEFAULTS = { from: '', to: '', countryId: '', institutionId: '', page: 1 };

export default function ImportantUpdates() {
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries } = useCountries();
  const { options: institutionOptions } = useInstitutions();
  // The detail row is already in the list payload, so the eye icon opens instantly
  // rather than firing another request for data we have.
  const [selected, setSelected] = useState(null);

  const fields = [
    { name: 'from', label: 'Publish date from', type: 'date' },
    { name: 'to', label: 'Publish date to', type: 'date' },
    {
      name: 'countryId',
      label: 'Country preferences',
      type: 'select',
      placeholder: 'Select country',
      // Filters by id here, not code, because ImportantUpdate.countryId is a
      // direct relation rather than a join through institution.
      options: countries.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: 'institutionId',
      label: 'University name',
      type: 'select',
      placeholder: 'University name',
      options: institutionOptions,
    },
  ];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['important-updates', applied],
    queryFn: () => fetchImportantUpdates(applied),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { key: 'title', header: 'Title of update', className: 'cell-strong' },
    {
      key: 'update',
      header: 'Update',
      // Truncated in the table, full text in the modal. The reference screen
      // leaves this column blank entirely, which makes the eye icon the only way
      // to discover there is any content at all.
      render: (u) => <span className="clamp-2">{u.body}</span>,
    },
    { key: 'publishDate', header: 'Publish date', render: (u) => formatDate(u.publishDate) },
    {
      key: 'details',
      header: 'Details',
      render: (u) => (
        <div className="action-row">
          <button
            type="button"
            className="action-icon-btn"
            title="View update"
            aria-label={`View ${u.title}`}
            onClick={() => setSelected(u)}
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {/* Only rendered when there is something to download — the reference
              shows this icon on some rows and not others, and a download button
              that resolves to nothing is worse than no button. */}
          {u.attachmentUrl && (
            <a
              className="action-icon-btn"
              href={u.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Download attachment"
              aria-label={`Download attachment for ${u.title}`}
            >
              <svg
                className="icon-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M12 3v12" />
                <polyline points="7 11 12 16 17 11" />
                <path d="M5 20h14" />
              </svg>
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page title="Important Updates" subtitle="Policy and institution announcements">
      <FilterBar
        fields={fields}
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
        emptyMessage="No updates match these filters."
        meta={data?.meta}
        onPageChange={setPage}
      />

      {selected && (
        <Modal
          title={selected.title}
          subtitle={[
            formatDate(selected.publishDate),
            selected.country?.name,
            selected.institution?.name,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setSelected(null)}
          footer={
            selected.attachmentUrl && (
              <a
                className="btn btn-primary"
                href={selected.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download attachment
              </a>
            )
          }
        >
          <p className="modal-text">{selected.body}</p>
        </Modal>
      )}
    </Page>
  );
}
