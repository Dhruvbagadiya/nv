// Moved out of features/courseFinder/, since CourseFinder was the only screen
// that had pagination at all — Application History and Course Inquiry History
// both tracked a `page` and rendered no control for it, so page 2 was
// unreachable (F-11).
//
// The old version emitted bare <button>s and a "Page 1 of 4" span, ignoring the
// .pagination-wrap / .page-btn / .pagination-info styling that already existed
// in the CSS. This uses it.

// Numbered pages with ellipses, so 40 pages don't render 40 buttons.
// e.g. current 7 of 20 -> [1, '…', 6, 7, 8, '…', 20]
function pageWindow(page, totalPages, span = 1) {
  const pages = new Set([1, totalPages]);
  for (let p = page - span; p <= page + span; p += 1) {
    if (p > 1 && p < totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const out = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push({ gap: true, key: `gap-${p}` });
    out.push({ page: p, key: `p-${p}` });
    previous = p;
  }
  return out;
}

export default function Pagination({ page, totalPages, total, pageSize, maxPage, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  // The API refuses offsets past a limit, because OFFSET makes Postgres walk
  // every skipped row — page 7,757 of the catalogue took seconds and then 400d.
  // Navigation is capped at what the server will actually serve; the true page
  // count is still reported, so the numbers do not quietly lie.
  const lastNavigable = Math.min(totalPages, maxPage || totalPages);
  const current = Math.min(Math.max(page, 1), lastNavigable);
  const go = (next) => {
    if (next >= 1 && next <= lastNavigable && next !== current) onChange(next);
  };

  const firstRow = total ? (current - 1) * (pageSize || 0) + 1 : null;
  const lastRow = total ? Math.min(current * (pageSize || 0), total) : null;

  return (
    <div className="pagination-wrap">
      <div className="pagination-info">
        {total != null && pageSize
          ? `Showing ${firstRow}–${lastRow} of ${total}`
          : `Page ${current} of ${totalPages}`}
        {lastNavigable < totalPages && (
          <span className="pagination-capped">
            {' '}· browsable to page {lastNavigable} — filter or search to reach the rest
          </span>
        )}
      </div>

      <nav className="pagination" aria-label="Pagination">
        <button
          type="button"
          className="page-btn"
          onClick={() => go(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>

        {pageWindow(current, lastNavigable).map((item) =>
          item.gap ? (
            <span key={item.key} className="page-btn" aria-hidden="true" style={{ border: 'none' }}>
              …
            </span>
          ) : (
            <button
              type="button"
              key={item.key}
              className={`page-btn${item.page === current ? ' active' : ''}`}
              onClick={() => go(item.page)}
              aria-label={`Page ${item.page}`}
              aria-current={item.page === current ? 'page' : undefined}
            >
              {item.page}
            </button>
          )
        )}

        <button
          type="button"
          className="page-btn"
          onClick={() => go(current + 1)}
          disabled={current >= lastNavigable}
          aria-label="Next page"
        >
          ›
        </button>
      </nav>
    </div>
  );
}
