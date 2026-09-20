import { describe, it, expect } from 'vitest';
import { passportNumber, createApplicationBody } from '../../src/modules/applications/applications.schemas.js';

/*
 * The rule validates by what a passport number CANNOT be, not by format. There
 * is no useful regex across ~190 issuing authorities, and a portal that turns
 * away a genuine applicant because their document does not match our guess is
 * worse than one that accepts junk a human sees on the next screen.
 *
 * The rule it replaced was min(4), which accepted "aaaa".
 */
describe('passport numbers', () => {
  it.each(['aaaa', '1111', '111111', 'AAAAAA', 'abc', '12345', '  aa  '])(
    'rejects %j — placeholder input, or too short to be anyone\'s',
    (v) => expect(passportNumber.safeParse(v).success).toBe(false)
  );

  it.each(['P7654321', 'X1234567', 'A1234B', 'L898902C3', '123456789'])(
    'accepts %j — a shape some country actually issues',
    (v) => expect(passportNumber.safeParse(v).success).toBe(true)
  );

  it('does not uppercase what it is given', () => {
    // It is copied off a document and should be stored as written.
    expect(passportNumber.parse('p7654321')).toBe('p7654321');
  });

  it('is what the application body uses', () => {
    const base = { studentName: 'A B', courseId: '00000000-0000-4000-8000-000000000000' };
    expect(createApplicationBody.safeParse({ ...base, passportNo: 'aaaa' }).success).toBe(false);
    expect(createApplicationBody.safeParse({ ...base, passportNo: 'P7654321' }).success).toBe(true);
  });
});
