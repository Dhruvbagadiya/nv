import Pagination from './Pagination.jsx';

// The table card is on 6 of the screens in the images. Every existing screen
// re-implements the same four states by hand, and each one gets a slightly
// different subset right:
//   - loading      -> a <tr> saying "Loading..."
//   - empty        -> present on some screens, missing on others
//   - error        -> missing everywhere; a failed query rendered as "no data",
//                     which tells the user the wrong thing entirely
//   - pagination   -> tracked in state on two screens, rendered on neither (F-11)
//
// columns: [{ key, header, render?, className?, width? }]
// `render(row)` is optional; without it the cell shows row[key].
export default function DataTable({
  columns,
  rows,
  isLoading,
  isError,
  error,
  emptyMessage = 'No data found',
  errorMessage = 'Couldn’t load this list.',
  getRowKey = (row) => row.id,
  // Pass the API's `meta` object straight through instead of spreading four
  // pagination props at every call site. List responses are uniformly
  // { items, meta: { total, page, pageSize, totalPages } }.
  meta,
  onPageChange,
}) {
  const colSpan = columns.length;

  // Keep the previous rows visible while a page change is in flight (React
  // Query's keepPreviousData) rather than flashing an empty table.
  const showRows = !isError && rows?.length > 0;

  return (
    <>
      {/* .table-card already sets overflow-x: auto, which matters for the Entry
          Requirements screens — their cells hold long free-text requirements. */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className} style={col.width ? { width: col.width } : undefined}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={colSpan} className="empty-state">
                  Loading…
                </td>
              </tr>
            )}

            {isError && !isLoading && (
              <tr>
                <td colSpan={colSpan} className="empty-state">
                  {errorMessage}
                  {error?.response?.status === 403 && ' You may not have access to it.'}
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows?.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="empty-state">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {showRows &&
              !isLoading &&
              rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.className}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {onPageChange && meta && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          pageSize={meta.pageSize}
          onChange={onPageChange}
        />
      )}
    </>
  );
}
