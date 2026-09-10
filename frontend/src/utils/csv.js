/**
 * A small CSV reader for the bulk course import.
 *
 * Written rather than pulled in because the input is a spreadsheet export and
 * the only hard parts are the two that a naive `split(',')` gets wrong: a comma
 * inside a quoted field, and a newline inside a quoted field. Both appear in
 * real course data — "MSc Business, Finance and Economics" and multi-line entry
 * requirements — and both would silently shift every later column.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // Strip a UTF-8 BOM: Excel writes one, and it would otherwise become part of
  // the first header name, so "title" would not match.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < src.length) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        // "" inside a quoted field is one literal quote.
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }

    if (c === '"') { quoted = true; i += 1; continue; }
    if (c === ',') { endField(); i += 1; continue; }
    if (c === '\r') { i += 1; continue; }
    if (c === '\n') { endRow(); i += 1; continue; }
    field += c; i += 1;
  }

  // A file not ending in a newline still has a final row.
  if (field !== '' || row.length) endRow();

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Rows keyed by header name.
 *
 * Headers are matched case- and space-insensitively, so "Tuition Fee",
 * "tuition_fee" and "tuitionfee" all reach the same field — a spreadsheet
 * exported by someone else should not have to be renamed by hand first.
 */
export function parseCsvToObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], rows: [] };

  const raw = rows[0].map((h) => h.trim());
  const keys = raw.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  return {
    headers: raw,
    rows: rows.slice(1).map((cells) => {
      const obj = {};
      keys.forEach((key, idx) => { obj[key] = (cells[idx] ?? '').trim(); });
      return obj;
    }),
  };
}
