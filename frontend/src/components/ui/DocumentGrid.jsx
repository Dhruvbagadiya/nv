// Carries all five Document Bank screens (Visa Documents, Refund Forms,
// Institute Brochures, SOP, LOR). In the reference portal these are five
// near-identical pages of PDF tiles differing only by category, so they are one
// component behind five routes rather than five files.
//
// Tile counts vary wildly — 6 for LOR, ~50 for SOP — so pagination is optional
// and passed through from the page.
import Pagination from './Pagination.jsx';

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <text x="12" y="17" textAnchor="middle" fontSize="6" stroke="none" fill="currentColor">
        PDF
      </text>
    </svg>
  );
}

export function DocumentTile({ document: doc }) {
  return (
    <a
      className="doc-tile"
      href={doc.fileUrl}
      target="_blank"
      // noopener is the security half of this — without it the opened document
      // can reach back through window.opener.
      rel="noopener noreferrer"
      // The tiles in the screenshots show long names on 2–3 lines with no way to
      // read the full text; the title attribute at least makes it recoverable.
      title={doc.title}
    >
      <span className="doc-tile-icon">
        <PdfIcon />
      </span>
      <span className="doc-tile-title">{doc.title}</span>
    </a>
  );
}

export default function DocumentGrid({
  documents,
  isLoading,
  isError,
  emptyMessage = 'No Data Found',
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}) {
  if (isLoading) {
    return (
      <div className="doc-panel">
        <p className="empty-state">Loading…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="doc-panel">
        <p className="empty-state">Couldn’t load these documents.</p>
      </div>
    );
  }

  // Image 11 of the reference set is precisely this state — Institute Brochures
  // with filters applied and nothing to show — so it is a designed state, not an
  // afterthought.
  if (!documents?.length) {
    return (
      <div className="doc-panel">
        <p className="empty-state">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="doc-panel">
        <div className="doc-grid">
          {documents.map((doc) => (
            <DocumentTile key={doc.id} document={doc} />
          ))}
        </div>
      </div>
      {onPageChange && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onChange={onPageChange}
        />
      )}
    </>
  );
}
