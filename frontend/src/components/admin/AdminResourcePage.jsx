import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../ui/Page.jsx';
import DataTable from '../ui/DataTable.jsx';
import FilterBar from '../ui/FilterBar.jsx';
import ResourceForm from './ResourceForm.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';

// Six reference resources need the same admin screen: a table, a create button, and
// per-row edit and archive actions. Rather than six copies, each screen supplies a
// config and this component supplies the behaviour — the same leverage as FilterBar
// and DataTable on the read-only side.
//
// A resource config provides:
//   title, subtitle, queryKey
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

  // useUrlFilters needs a stable defaults reference; resources with no filters get a
  // frozen empty object rather than a fresh literal each render.
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(
    resource.filterDefaults ?? EMPTY_FILTERS
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: [resource.queryKey, applied],
    queryFn: () => resource.list(filtersEnabled ? applied : undefined),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [resource.queryKey] });

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

  const rows = data?.items ?? [];

  // The button said "Archive" on every screen, but two of them map `remove` to a

  // real delete — the confirm text said "permanently" while the button next to

  // it promised the row was only being filed away. The label follows the effect.

  const removeLabel = resource.removeLabel ?? 'Archive';


  const columns = [
    ...resource.columns,
    {
      key: '__actions',
      header: 'Actions',
      render: (row) => (
        <div className="action-row">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(row)}>
            Edit
          </button>
          {resource.remove && (
            <button
              type="button"
              className="btn btn-ghost"
              // Destructive and not undoable from this screen, so it asks first.
              onClick={() => {
                if (window.confirm(resource.confirmRemove?.(row) ?? `${removeLabel} this item?`)) {
                  removeMutation.mutate(idOf(row));
                }
              }}
              disabled={removeMutation.isPending}
              // Twenty identical buttons per page otherwise, with nothing to tell
              // a screen reader which row this one belongs to.
              aria-label={`${removeLabel} ${resource.rowLabel?.(row) ?? 'item'}`}
            >
              {removeLabel}
            </button>
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
          fields={resource.filterFields}
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
