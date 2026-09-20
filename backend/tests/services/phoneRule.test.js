import { describe, it, expect } from 'vitest';
import { phoneNumber } from '../../src/modules/auth/auth.schemas.js';
import { updateProfileBody } from '../../src/modules/students/students.schemas.js';

const ok = (v) => phoneNumber.safeParse(v).success;

/*
 * The rule refuses what cannot be a phone number rather than asserting what one
 * looks like — the same discipline as the passport rule, and for the same
 * reason. NV's applicants are Indian, but the number they can be reached on is
 * often a foreign one by the time an offer lands, so a ^[6-9]\d{9}$ check would
 * turn away exactly the people furthest along in the process.
 */
describe('mobile number validation', () => {
  it('accepts the formats Indian applicants actually type', () => {
    expect(ok('9925913764')).toBe(true);
    expect(ok('+91 99259 13764')).toBe(true);
    expect(ok('+919925913764')).toBe(true);
    expect(ok('099259-13764')).toBe(true);
  });

  it('accepts foreign numbers, which applicants abroad will have', () => {
    expect(ok('+1 415 555 0123')).toBe(true);   // US
    expect(ok('+44 7700 900123')).toBe(true);   // UK mobile
    expect(ok('+61 412 345 678')).toBe(true);   // AU
    expect(ok('(992) 591-3764')).toBe(true);    // bracketed area code
  });

  it('rejects placeholder junk', () => {
    // The shape of "I do not want to give you my number".
    expect(ok('0000000000')).toBe(false);
    expect(ok('1111111111')).toBe(false);
    expect(ok('9999999999')).toBe(false);
  });

  it('rejects things that are not numbers at all', () => {
    expect(ok('not a phone')).toBe(false);
    expect(ok('99259abcde')).toBe(false);
    expect(ok('+++9925913764')).toBe(false);
  });

  it('rejects lengths no national numbering plan produces', () => {
    expect(ok('')).toBe(false);
    expect(ok('12345')).toBe(false);            // 5 digits
    expect(ok('123456')).toBe(false);           // 6, still short
    expect(ok('1234567')).toBe(true);           // 7 is the shortest real one
    expect(ok('1234567890123456')).toBe(false); // 16 > E.164 maximum of 15
  });

  /*
   * The requirement has to hold on BOTH ends or it is decorative: sign up with
   * a number, blank it on the profile screen, and the applicant is unreachable
   * again with the gate none the wiser.
   */
  it('cannot be cleared again from the student profile form', () => {
    expect(updateProfileBody.safeParse({ phone: '9925913764' }).success).toBe(true);
    expect(updateProfileBody.safeParse({ phone: null }).success).toBe(false);
    expect(updateProfileBody.safeParse({ phone: '' }).success).toBe(false);
    expect(updateProfileBody.safeParse({ nationality: 'Indian' }).success).toBe(false);
  });
});
