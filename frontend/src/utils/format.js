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

// Prisma returns Decimal columns as strings over JSON, so `fee === 0` is false
// for a zero fee — it arrives as "0".
export const isFree = (amount) => Number(amount) === 0;

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
