import { describe, it, expect } from 'vitest';
import { programLevelFor } from '../src/utils/programLevelMatch.js';

/**
 * Mapping a typed course type onto a ProgramLevel.
 *
 * The cost of a wrong answer here is not a blank cell — it is an MOI record
 * filed against the wrong award, telling an agent a school accepts an MOI letter
 * for a Master's when it only accepts one for a Bachelor's. So the interesting
 * assertions are the ones about refusing to guess.
 */
describe('programLevelFor', () => {
  it.each([
    ["Bachelor's Degree", 'BACHELORS_DEGREE'],
    ['Bachelors', 'BACHELORS_DEGREE'],
    ['BACHELOR DEGREE', 'BACHELORS_DEGREE'],
    ['Masters', 'MASTERS_DEGREE'],
    ["Master's degree", 'MASTERS_DEGREE'],
    ['MBA', 'MASTERS_DEGREE'],
    ['Diploma', 'DIPLOMA'],
    ['Higher Diploma', 'HIGHER_DIPLOMA'],
    ['Undergraduate Diploma', 'UNDERGRADUATE_DIPLOMA'],
    ['PhD', 'DOCTORAL_PHD'],
    ['Foundation year', 'FOUNDATION'],
  ])('maps %s', (typed, expected) => {
    expect(programLevelFor(typed)).toBe(expected);
  });

  // Order in the phrase list is load-bearing: "diploma" and "post graduate" both
  // appear inside "postgraduate diploma", and whichever is tested first wins.
  it.each([
    ['Postgraduate Diploma', 'POST_GRADUATE_DIPLOMA'],
    ['PG Diploma', 'POST_GRADUATE_DIPLOMA'],
    ['Postgraduate Certificate', 'POST_GRADUATE_CERTIFICATE'],
    ['Advanced Diploma', 'ADVANCED_DIPLOMA'],
    ['Integrated Masters', 'INTEGRATED_MASTERS'],
  ])('prefers the longer phrase for %s', (typed, expected) => {
    expect(programLevelFor(typed)).toBe(expected);
  });

  it('accepts the enum name however it was punctuated', () => {
    expect(programLevelFor('MASTERS_DEGREE')).toBe('MASTERS_DEGREE');
    expect(programLevelFor('masters degree')).toBe('MASTERS_DEGREE');
  });

  // Two letters matched as a substring is how a level lands on the wrong course.
  it('matches bare abbreviations only as the whole value', () => {
    expect(programLevelFor('UG')).toBe('BACHELORS_DEGREE');
    expect(programLevelFor('Language courses')).toBeNull();
    expect(programLevelFor('Rugby Management')).toBeNull();
  });

  /**
   * Null, never OTHER. OTHER is a level a course can genuinely be, so filing an
   * unmapped row as OTHER would make it match real OTHER courses — a wrong
   * answer nobody can see, where a null is visible in the backfill's report.
   */
  it.each(['', null, undefined, '   ', 'Whatever the provider calls it', '???'])(
    'returns null rather than guessing for %p',
    (typed) => {
      expect(programLevelFor(typed)).toBeNull();
    }
  );
});
