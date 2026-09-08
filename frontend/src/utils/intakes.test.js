import { describe, it, expect } from 'vitest';
import { monthLabels, nextIntakes, formatIntake } from './intakes.js';

describe('monthLabels', () => {
  it('names and sorts the months', () => {
    expect(monthLabels([9, 2])).toEqual(['Feb', 'Sep']);
  });
  it('ignores values that are not months', () => {
    expect(monthLabels([0, 2, 13, 99])).toEqual(['Feb']);
  });
  it('handles a course with none', () => {
    expect(monthLabels([])).toEqual([]);
    expect(monthLabels(undefined)).toEqual([]);
  });
});

describe('nextIntakes', () => {
  const june2026 = new Date('2026-06-15T00:00:00Z');

  it('rolls a passed month into next year', () => {
    // February is behind us in June, so the next February is 2027. This is the
    // rotation the stored months exist to express.
    expect(nextIntakes([2], 1, june2026)).toEqual([{ month: 2, year: 2027 }]);
  });

  it('keeps a month still to come this year', () => {
    expect(nextIntakes([9], 1, june2026)).toEqual([{ month: 9, year: 2026 }]);
  });

  it('orders a mixed set by when it actually happens', () => {
    expect(nextIntakes([2, 9], 3, june2026)).toEqual([
      { month: 9, year: 2026 },
      { month: 2, year: 2027 },
      { month: 9, year: 2027 },
    ]);
  });

  it('includes the current month rather than skipping it', () => {
    expect(nextIntakes([6], 1, june2026)).toEqual([{ month: 6, year: 2026 }]);
  });

  it('returns nothing when no months are published', () => {
    expect(nextIntakes([], 3, june2026)).toEqual([]);
  });
});

describe('formatIntake', () => {
  it('writes an intake the way a card shows it', () => {
    expect(formatIntake({ month: 2, year: 2027 })).toBe('Feb 2027');
  });
});
