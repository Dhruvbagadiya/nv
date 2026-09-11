// Fees were printed as "$12000 CAD" everywhere regardless of destination, so
// every UK course quoted Canadian dollars. Currency comes from the course's
// country; Intl supplies the symbol and the separators.
export function formatFee(amount, currencyCode = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // An unrecognised ISO code should degrade, not blank out the cell.
    return `${value.toLocaleString()} ${currencyCode}`;
  }
}

/**
 * An application fee, or null when none is published.
 *
 * Three states, and the difference between two of them is money. `applicationFee`
 * is nullable by design — null means "no fee published", which is the case for
 * the great majority of the imported catalogue — while 0 means the application
 * is genuinely free. `Number(null)` is 0, so the obvious test collapses the two
 * and advertises an unpublished fee as free. That is what the student programme
 * browser and the student course page both did, on public pages, to courses that
 * then invoice.
 *
 * Returning null rather than a string leaves each screen free to render "not
 * published" in its own voice, while the rule itself lives in one place.
 * Prisma sends Decimal columns as strings over JSON, so the comparison is on
 * Number() and the null check has to come first.
 */
export function formatApplicationFee(amount, currencyCode) {
  if (amount == null) return null;
  return Number(amount) > 0 ? formatFee(amount, currencyCode) : 'Free';
}

/**
 * A course length from its min/max month columns, or null when unpublished.
 *
 * Both columns default to 0 rather than null, so an unstated duration reads as
 * "0 months" unless the falsy case is handled before the equality check.
 */
export function formatDuration(min, max) {
  if (!min && !max) return null;
  if (min === max) return `${min} months`;
  return `${min} – ${max} months`;
}

// The API reports a validation failure as { error, details: [{ path, message }] }
// and everything else as { error }. Reading only `error` on a 400 shows the
// generic "Validation failed" while the useful part sits in details, which is
// what made the empty-countryId bug so hard to place from the UI alone.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const body = error?.response?.data;
  const detail = body?.details?.[0];
  if (detail?.message) {
    return detail.field ? `${detail.field}: ${detail.message}` : detail.message;
  }
  return body?.error ?? error?.message ?? fallback;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
