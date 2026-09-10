/**
 * Where a row came from, and whether an edit to it will last.
 *
 * A row imported from a feed is rewritten by the next import of that feed,
 * which matches on (source, externalId) and overwrites the fields it owns. An
 * admin correcting a tuition fee on an imported course is making a change that
 * disappears overnight, and nothing on the screen said so.
 *
 * The stored values are `manual`, `catalogue_a` and `catalogue_b`. Those are
 * column values, not labels — printing them raw asks the reader to know the
 * schema.
 */
const LABELS = {
  manual: 'Manual',
  catalogue_a: 'Catalogue A',
  catalogue_b: 'Catalogue B',
};

export const sourceLabel = (source) => LABELS[source] ?? source ?? 'Manual';

export const isImported = (source) => Boolean(source) && source !== 'manual';

export default function SourceBadge({ source, externalId }) {
  if (!isImported(source)) return <span className="cell-muted">Manual</span>;

  return (
    <span
      className="tag-pill"
      title={
        `Imported from ${sourceLabel(source)}` +
        (externalId != null ? ` (id ${externalId})` : '') +
        ' — edits are overwritten by the next import.'
      }
    >
      {sourceLabel(source)}
    </span>
  );
}

/** The same warning, at the point where the edit is actually being made. */
export function ImportNotice({ source, externalId }) {
  if (!isImported(source)) return null;

  return (
    <p className="form-notice">
      Imported from <strong>{sourceLabel(source)}</strong>
      {externalId != null && <> (id {externalId})</>}. Edits to imported fields are
      overwritten the next time this feed is imported — correct the source or the import
      mapping to make a change stick.
    </p>
  );
}
