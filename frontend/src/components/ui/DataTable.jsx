import { useEffect, useRef, useState } from 'react';
import Pagination from './Pagination.jsx';
import Icon from './Icon.jsx';

// Rows past this index all share the last delay. Without a cap a 50-row page
// would leave the final row waiting 1.5s, which reads as the table hanging.
const STAGGER_CAP = 12;

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
  // Optional: makes each row clickable with a pointer cursor.
  onRowClick,
  rowClickTitle,
}) {
  const colSpan = columns.length;

  // Keep the previous rows visible while a page change is in flight (React
  // Query's keepPreviousData) rather than flashing an empty table.
  const showRows = !isError && rows?.length > 0;

  // Stagger the rows on the FIRST paint only. On a later page change the rows
  // are a replacement rather than an arrival, and animating them in makes
  // pagination feel slower than it is. `entered` latches once and never resets.
  const entered = useRef(false);
  const [staggering, setStaggering] = useState(false);
  useEffect(() => {
    if (entered.current || !showRows) return;
    entered.current = true;
    setStaggering(true);
    // One frame is enough for the animation to be picked up; clearing the
    // attribute afterwards keeps re-renders from replaying it.
    const t = setTimeout(() => setStaggering(false), STAGGER_CAP * 30 + 200);
    return () => clearTimeout(t);
  }, [showRows]);

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
          <tbody data-enter={staggering ? '' : undefined}>
            {/* Skeleton rows rather than a "Loading…" string: the table keeps its
                shape, so the surrounding layout does not jump when the data
                lands, and the wait reads as the same table filling in rather
                than a different screen. */}
            {isLoading &&
              Array.from({ length: 6 }, (_, r) => (
                <tr key={`skel-${r}`} aria-hidden="true">
                  {columns.map((col) => (
                    <td key={col.key}>
                      <span className="skel skel-text" />
                    </td>
                  ))}
                </tr>
              ))}
            {isLoading && (
              <tr>
                <td colSpan={colSpan} className="sr-only" role="status" aria-busy="true">
                  Loading…
                </td>
              </tr>
            )}

            {isError && !isLoading && (
              <tr>
                <td colSpan={colSpan}>
                  <div className="empty-state">
                    <span className="e-icon e-icon--danger" aria-hidden="true">
                      <Icon name="alert" size={20} />
                    </span>
                    {/* errorMessage IS the heading — rendering it again in the
                        body duplicated the text, which broke every getByText
                        assertion on it by matching two nodes. */}
                    <h3>{errorMessage}</h3>
                    {error?.response?.status === 403 && (
                      <p>You may not have access to it.</p>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows?.length === 0 && (
              <tr>
                <td colSpan={colSpan}>
                  <div className="empty-state">
                    <span className="e-icon" aria-hidden="true">
                      <Icon name="inbox" size={20} />
                    </span>
                    {/* The message stays the h3 so callers keep full control of
                        the wording, and DataTable.test.jsx still finds it. */}
                    <h3>{emptyMessage}</h3>
                  </div>
                </td>
              </tr>
            )}

            {showRows &&
              !isLoading &&
              rows.map((row, i) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  title={rowClickTitle}
                  className={onRowClick ? 'row-clickable' : undefined}
                  style={{ '--i': Math.min(i, STAGGER_CAP) }}
                >
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
          maxPage={meta.maxPage}
          onChange={onPageChange}
        />
      )}
    </>
  );
}
