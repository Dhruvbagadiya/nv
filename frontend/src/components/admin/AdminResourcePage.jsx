import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../ui/Page.jsx';
import DataTable from '../ui/DataTable.jsx';
import FilterBar from '../ui/FilterBar.jsx';
import ResourceForm from './ResourceForm.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';

// Six reference resources need the same admin screen: a table, a create button, and
// per-row edit and archive actions. Rather than six copies, each screen supplies a
// config and this component supplies the behaviour — the same leverage as FilterBar
// and DataTable on the read-only side.
//
// A resource config provides:
//   title, subtitle, queryKey  (a string, or an array whose FIRST element is the
//                                entity name used to look up related caches)
//   list(filters) -> { items, meta } | { items }
//   create?(values), update?(id, values), remove?(id)
//   columns          DataTable columns
//   formFields       ResourceForm fields
//   toForm?(row)     row -> form values      (defaults to the row itself)
//   toPayload(values) form values -> API body
//   filterDefaults?, filterFields?
//   idOf?(row)       defaults to row.id
export default function AdminResourcePage({ resource }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // row being edited, or 'new'
  const filtersEnabled = Boolean(resource.filterDefaults);
  const idOf = resource.idOf ?? ((row) => row.id);
  // Commissions identify a row by institutionId, because the save is an upsert
  // keyed on the institution — but archive and restore address the commission's
  // own id, like every other module. One accessor cannot serve both.
  const removeIdOf = resource.removeIdOf ?? idOf;

  // useUrlFilters needs a stable defaults reference; resources with no filters get a
  // frozen empty object rather than a fresh literal each render.
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(
    resource.filterDefaults ?? EMPTY_FILTERS
  );

  // One key root per entity, variants after it. An admin screen and the
  // agent-facing screen reading the same rows share a root, so invalidating the
  // entity reaches both by prefix — which is what a config screen got wrong when
  // its key was the flat string `admin-entry-requirements-UG`: nothing else in
  // the app shared a prefix with it, so saving a requirement refreshed the admin
  // table and no other screen.
  const keyParts = Array.isArray(resource.queryKey) ? resource.queryKey : [resource.queryKey];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: [...keyParts, applied],
    queryFn: () => resource.list(filtersEnabled ? applied : undefined),
    placeholderData: keepPreviousData,
  });

  // The root IS the entity name in RELATED_KEYS, so a resource never has to
  // repeat itself in two places.
  const invalidate = () => invalidateResource(queryClient, keyParts[0]);

  // A screen whose tab strip lives outside useUrlFilters — Entry Requirements
  // switching UG/PG — keeps the page number across the switch, so moving from
  // page 3 of one tab to a tab with one page requests page 3 and renders the
  // empty state for a tab that has rows. useUrlFilters already enforces "any
  // filter change resets the page" for the filters it owns; this extends it to
  // the part of the key the resource supplies.
  //
  // A ref rather than a render-phase comparison because the reset writes to the
  // URL, which cannot happen during render — and skipping the first run is what
  // keeps a pasted ?page=3 link working.
  const tabKey = JSON.stringify(keyParts);
  const previousTabKey = useRef(tabKey);
  useEffect(() => {
    if (previousTabKey.current === tabKey) return;
    previousTabKey.current = tabKey;
    setPage(1);
  }, [tabKey, setPage]);

  const saveMutation = useMutation({
    mutationFn: ({ id, values }) => {
      const payload = resource.toPayload(values);
      // An upsert-style resource (commissions, entry requirements) has no separate
      // update path — its create IS the update.
      return id && resource.update ? resource.update(id, payload) : resource.create(payload);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const removeMutation = useMutation({ mutationFn: resource.remove, onSuccess: invalidate });
  const restoreMutation = useMutation({ mutationFn: resource.restore, onSuccess: invalidate });

  const rows = data?.items ?? [];

  // The button said "Archive" on every screen, but two of them map `remove` to a

  // real delete — the confirm text said "permanently" while the button next to

  // it promised the row was only being filed away. The label follows the effect.

  const removeLabel = resource.removeLabel ?? 'Archive';


  const columns = [
    ...resource.columns,
    // Only meaningful where archiving is reversible; a column that appears and
    // disappears between screens is more confusing than one that reads "Active".
    ...(resource.restore
      ? [{ key: 'archivedAt', header: 'Status', render: (row) => (row.archivedAt ? 'Archived' : 'Active') }]
      : []),
    {
      key: '__actions',
      header: 'Actions',
      render: (row) => (
        <div className="action-row">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(row)}>
            Edit
          </button>
          {/* An archived row offers the way back rather than a second archive. */}
          {resource.restore && row.archivedAt ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => restoreMutation.mutate(removeIdOf(row))}
              disabled={restoreMutation.isPending}
              aria-label={`Restore ${resource.rowLabel?.(row) ?? 'item'}`}
            >
              Restore
            </button>
          ) : (
            resource.remove && (
              <button
                type="button"
                className="btn btn-ghost"
                // Destructive and not undoable from this screen, so it asks first.
                onClick={() => {
                  if (window.confirm(resource.confirmRemove?.(row) ?? `${removeLabel} this item?`)) {
                    removeMutation.mutate(removeIdOf(row));
                  }
                }}
                disabled={removeMutation.isPending}
                // Twenty identical buttons per page otherwise, with nothing to tell
                // a screen reader which row this one belongs to.
                aria-label={`${removeLabel} ${resource.rowLabel?.(row) ?? 'item'}`}
              >
                {removeLabel}
              </button>
            )
          )}
        </div>
      ),
    },
  ];

  // The API's own message is far more useful than "something went wrong" — its zod
  // errors name the offending field.
  const saveError =
    saveMutation.error?.response?.data?.error ??
    (saveMutation.error ? 'Could not save. Check the fields and try again.' : null);

  return (
    <Page
      title={resource.title}
      subtitle={resource.subtitle}
      actions={
        resource.create && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            {resource.createLabel ?? 'Add new'}
          </button>
        )
      }
    >
      {filtersEnabled && resource.filterFields && (
        <FilterBar
          // Appended rather than asked of every resource: the option only makes
          // sense where archiving is reversible, and without a way to LIST the
          // archived rows the Restore button could never be reached.
          fields={
            resource.restore
              ? [...resource.filterFields, {
                  name: 'status',
                  label: 'Status',
                  type: 'select',
                  placeholder: 'Active',
                  options: [
                    { value: 'active', label: 'Active' },
                    { value: 'archived', label: 'Archived' },
                    { value: 'all', label: 'All' },
                  ],
                }]
              : resource.filterFields
          }
          values={draft}
          onChange={setField}
          onApply={apply}
          onClear={clear}
          busy={isFetching}
        />
      )}

      {removeMutation.isError && (
        <p className="form-error">
          {removeMutation.error?.response?.data?.error ?? 'Could not archive that item.'}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        error={error}
        emptyMessage={resource.emptyMessage ?? 'Nothing here yet.'}
        meta={data?.meta}
        onPageChange={data?.meta ? setPage : undefined}
        getRowKey={idOf}
      />

      {editing && (
        <ResourceForm
          title={editing === 'new' ? (resource.createLabel ?? 'Add new') : `Edit ${resource.title}`}
          fields={resource.formFields}
          initialValues={editing === 'new' ? {} : (resource.toForm?.(editing) ?? editing)}
          onSubmit={(values) =>
            saveMutation.mutate({ id: editing === 'new' ? null : idOf(editing), values })
          }
          onClose={() => {
            saveMutation.reset();
            setEditing(null);
          }}
          isSaving={saveMutation.isPending}
          error={saveError}
        />
      )}
    </Page>
  );
}

const EMPTY_FILTERS = Object.freeze({});
