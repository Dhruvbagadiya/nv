import { describe, it, expect } from 'vitest';
import { createCourseBody, PROGRAM_LEVELS } from '../src/modules/courses/courses.schemas.js';

/**
 * Every way the Add-course form gets rejected.
 *
 * All five produced the same message — "Invalid request body" — because the
 * admin screen read `.error` off the envelope and threw away the `details`
 * array, which names the field. So a missing institution, a tuition fee typed
 * with a comma, and a URL pasted without its scheme were indistinguishable from
 * each other and from a bug.
 *
 * This file is the list. The screen now validates the same rules before the
 * round trip and surfaces the server's details for anything it misses; these
 * assertions are what stop the two drifting into disagreement.
 */

const VALID = {
  institutionId: '11111111-1111-4111-8111-111111111111',
  title: 'Diploma in Hospitality',
  shortName: null,
  slug: 'diploma-in-hospitality',
  programLevel: 'DIPLOMA',
  minLength: 0,
  maxLength: 0,
  languageOfInstruction: 'eng',
  tuitionFee: 0,
  applicationFee: null,
  currencyCode: null,
  externalUrl: null,
  entryRequirements: null,
  commissionAmount: null,
  abAppCreationEnabled: false,
  intakeMonths: [],
  tags: [],
  badges: [],
  intakes: [],
};

const fieldsThatFailed = (body) => {
  const r = createCourseBody.safeParse(body);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('createCourseBody', () => {
  it('accepts the payload a blank form produces once the required fields are in', () => {
    expect(createCourseBody.safeParse(VALID).success).toBe(true);
  });

  // The commonest one, and the reason this was reported as "it worked the first
  // time": on a second Add the picker starts empty again, and an unset picker
  // sends '' where the API wants a uuid.
  it('rejects an unset institution picker, naming the field', () => {
    expect(fieldsThatFailed({ ...VALID, institutionId: '' })).toEqual(['institutionId']);
  });

  it.each([
    ['a thousands separator', '1,500'],
    ['a currency symbol', 'SGD 154'],
    ['free text', 'ask the university'],
  ])('rejects a tuition fee with %s', (_label, typed) => {
    // Number() of each of these is NaN, which the API reports as "Expected
    // number, received nan" — accurate, and no help at all to whoever typed it.
    expect(fieldsThatFailed({ ...VALID, tuitionFee: Number(typed) })).toEqual(['tuitionFee']);
  });

  it('accepts a blank tuition fee as zero, since Number("") is 0', () => {
    expect(createCourseBody.safeParse({ ...VALID, tuitionFee: Number('') }).success).toBe(true);
  });

  it('rejects a currency code that is not exactly three letters', () => {
    expect(fieldsThatFailed({ ...VALID, currencyCode: 'SG' })).toEqual(['currencyCode']);
    expect(createCourseBody.safeParse({ ...VALID, currencyCode: 'sgd' }).success).toBe(true);
  });

  it('rejects a URL pasted without its scheme', () => {
    // Which is what copying an address out of a page rather than the address
    // bar gives you. The form now prefixes https:// instead of refusing it.
    expect(fieldsThatFailed({ ...VALID, externalUrl: 'www.herts.ac.uk/course' })).toEqual(['externalUrl']);
    expect(createCourseBody.safeParse({ ...VALID, externalUrl: 'https://www.herts.ac.uk/course' }).success).toBe(true);
  });

  it('rejects an unknown key rather than dropping it, because the body is strict', () => {
    const r = createCourseBody.safeParse({ ...VALID, confirm: 'x' });
    expect(r.success).toBe(false);
    // zod reports this one with an EMPTY path and the offending name in `keys`,
    // which is why the validate middleware falls back to it — otherwise the
    // client renders ": Unrecognized key(s) in object", a message with a colon
    // and no subject.
    expect(r.error.issues[0].path).toEqual([]);
    expect(r.error.issues[0].keys).toEqual(['confirm']);
  });
});

describe('ProgramLevel', () => {
  // They already existed as course TITLES — "UNDERGRADUATE DIPLOMA IN
  // HOSPITALITY AND TOURISM" — while the column filed them under something else,
  // so an agent could read the level and not filter by it.
  it.each(['HIGHER_DIPLOMA', 'UNDERGRADUATE_CERTIFICATE', 'UNDERGRADUATE_DIPLOMA'])(
    'accepts %s',
    (level) => {
      expect(PROGRAM_LEVELS).toContain(level);
      expect(createCourseBody.safeParse({ ...VALID, programLevel: level }).success).toBe(true);
    }
  );

  // PROGRAM_LEVELS is derived from the Prisma enum, never hand-listed — it was a
  // nine-value copy while the schema had seventeen, and the eight it omitted
  // could not be created, filtered or even saved back unchanged.
  it('is the database enum, not a copy of it', () => {
    expect(PROGRAM_LEVELS).toHaveLength(20);
  });
});
