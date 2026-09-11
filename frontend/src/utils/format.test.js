import { describe, it, expect } from 'vitest';
import { formatApplicationFee, formatDuration } from './format.js';

/**
 * `applicationFee` is nullable by design: null means "no fee published", 0 means
 * the application is genuinely free. `Number(null)` is 0, so the obvious test
 * collapses the two — which is how the public student pages advertised an
 * unpublished fee as Free on courses that then invoice.
 */
describe('formatApplicationFee', () => {
  it('reads null as not published, not as free', () => {
    expect(formatApplicationFee(null, 'GBP')).toBeNull();
  });

  it('reads undefined as not published too', () => {
    expect(formatApplicationFee(undefined, 'GBP')).toBeNull();
  });

  it('says Free only when the fee is genuinely zero', () => {
    expect(formatApplicationFee(0, 'GBP')).toBe('Free');
  });

  // Prisma sends Decimal columns as strings over JSON, so the zero that arrives
  // is "0" and the comparison has to be numeric.
  it('says Free for the string zero Prisma actually sends', () => {
    expect(formatApplicationFee('0', 'GBP')).toBe('Free');
  });

  it('formats a real fee in the course currency', () => {
    expect(formatApplicationFee(50, 'GBP')).toMatch(/50/);
  });
});

// Both length columns default to 0 rather than null, so an unstated duration
// rendered as "0 months" wherever the falsy case was not handled first.
describe('formatDuration', () => {
  it('returns null when neither bound is published', () => {
    expect(formatDuration(0, 0)).toBeNull();
    expect(formatDuration(null, null)).toBeNull();
  });

  it('collapses an equal range to one figure', () => {
    expect(formatDuration(48, 48)).toBe('48 months');
  });

  it('shows a real range as a range', () => {
    expect(formatDuration(12, 24)).toMatch(/12.*24/);
  });
});
