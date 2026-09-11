import { describe, it, expect } from 'vitest';
import { registerSchema, createUserSchema, loginSchema } from '../src/modules/auth/auth.schemas.js';
import { createSubAgentBody } from '../src/modules/auth/auth.schemas.js';
import { listCoursesQuery, createCourseBody } from '../src/modules/courses/courses.schemas.js';
import { listApplicationsQuery } from '../src/modules/applications/applications.schemas.js';
import { listDocumentsQuery, uploadUrlBody } from '../src/modules/documents/documents.schemas.js';
import { createAnnouncementBody } from '../src/modules/announcements/announcements.schemas.js';
import { listUpdatesQuery } from '../src/modules/importantUpdates/importantUpdates.schemas.js';
import { listEntryRequirementsQuery } from '../src/modules/entryRequirements/entryRequirements.schemas.js';
import { listInstitutionsQuery, createInstitutionBody } from '../src/modules/institutions/institutions.schemas.js';
import { createMoiBody } from '../src/modules/moiInstitutions/moiInstitutions.schemas.js';
import { upsertAgencyBody } from '../src/modules/agency/agency.schemas.js';
import { updateProfileBody } from '../src/modules/profile/profile.schemas.js';

const UUID = '00000000-0000-4000-8000-000000000000';

// The schemas are the API's actual security and correctness boundary — several of
// this project's worst bugs were things a schema would have refused. These are
// regression tests for exactly those.

describe('auth schemas', () => {
  // F-01. POST /auth/register was unauthenticated and forwarded the whole body to a
  // service signed `register({ ..., role = 'AGENT' })` — a default, not a
  // constraint — so {"role":"SUPER_ADMIN"} minted a super admin from an anonymous
  // request. .strict() is what makes that a 400 instead of a silent downgrade.
  it('registerSchema REJECTS a role in the body', () => {
    const result = registerSchema.safeParse({
      name: 'Attacker',
      email: 'attacker@evil.com',
      password: 'hunter2hunter2',
      role: 'SUPER_ADMIN',
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error.issues)).toMatch(/role/);
  });

  it('registerSchema accepts the same payload without a role', () => {
    const result = registerSchema.safeParse({
      name: 'Real Person',
      email: 'Real.Person@Example.COM',
      password: 'longenoughpassword',
    });
    expect(result.success).toBe(true);
    // Normalised, so two accounts cannot differ only by case.
    expect(result.data.email).toBe('real.person@example.com');
  });

  it('registerSchema enforces a minimum password length', () => {
    const result = registerSchema.safeParse({ name: 'A', email: 'a@b.com', password: 'short' });
    expect(result.success).toBe(false);
  });

  // The privileged path DOES take a role, and only accepts known ones.
  it('createUserSchema requires a valid role', () => {
    expect(
      createUserSchema.safeParse({ name: 'S', email: 's@x.com', password: 'longenoughpw', role: 'ADMIN' })
        .success
    ).toBe(true);
    expect(
      createUserSchema.safeParse({ name: 'S', email: 's@x.com', password: 'longenoughpw', role: 'GOD' })
        .success
    ).toBe(false);
    // Role is required here — omitting it must not silently default.
    expect(
      createUserSchema.safeParse({ name: 'S', email: 's@x.com', password: 'longenoughpw' }).success
    ).toBe(false);
  });

  // Same reasoning as register: a sub-agent is always an AGENT.
  it('createSubAgentBody rejects a role', () => {
    expect(
      createSubAgentBody.safeParse({
        name: 'X',
        email: 'x@y.com',
        password: 'longenoughpw',
        role: 'ADMIN',
      }).success
    ).toBe(false);
  });

  it('loginSchema normalises the email but not the password', () => {
    const r = loginSchema.safeParse({ email: '  AGENT@Example.com ', password: '  spaces  ' });
    expect(r.data.email).toBe('agent@example.com');
    expect(r.data.password).toBe('  spaces  ');
  });
});

describe('query coercion', () => {
  // ?page=abc used to reach Prisma as `skip: NaN`, which becomes a 500.
  it('rejects a non-numeric page instead of producing NaN', () => {
    const r = listCoursesQuery.safeParse({ page: 'abc' });
    expect(r.success).toBe(false);
  });

  it('coerces numeric strings and applies defaults', () => {
    const r = listCoursesQuery.safeParse({ page: '3' });
    expect(r.data.page).toBe(3);
    expect(r.data.pageSize).toBe(12); // the course grid's own default
  });

  it('caps pageSize so a caller cannot ask for the whole table', () => {
    expect(listCoursesQuery.safeParse({ pageSize: '5000' }).success).toBe(false);
  });

  it('rejects page 0 and negatives', () => {
    expect(listCoursesQuery.safeParse({ page: '0' }).success).toBe(false);
    expect(listCoursesQuery.safeParse({ page: '-2' }).success).toBe(false);
  });

  // Query strings have no booleans: "false" is a truthy string, so an untyped flag
  // becomes a filter that cannot be switched off.
  it('treats blacklisted=false as false, not as truthy', () => {
    expect(listInstitutionsQuery.safeParse({ blacklisted: 'false' }).data.blacklisted).toBe(false);
    expect(listInstitutionsQuery.safeParse({ blacklisted: 'true' }).data.blacklisted).toBe(true);
    // Absent stays absent, so "no filter" is distinguishable from "filter off".
    expect(listInstitutionsQuery.safeParse({}).data.blacklisted).toBeUndefined();
  });

  it('rejects an unknown application stage', () => {
    expect(listApplicationsQuery.safeParse({ stage: 'CAS_LETTER' }).success).toBe(true);
    expect(listApplicationsQuery.safeParse({ stage: 'MADE_UP' }).success).toBe(false);
  });

  // Required, not defaulted: there is no combined view, and quietly picking one
  // would make the other screens look empty.
  it('requires level on entry requirements and category on documents', () => {
    expect(listEntryRequirementsQuery.safeParse({}).success).toBe(false);
    expect(listEntryRequirementsQuery.safeParse({ level: 'UG' }).success).toBe(true);
    expect(listDocumentsQuery.safeParse({}).success).toBe(false);
    expect(listDocumentsQuery.safeParse({ category: 'SOP' }).success).toBe(true);
  });

  // A reversed range silently returns nothing, which reads as "no updates" rather
  // than "your dates are backwards".
  it('rejects a reversed publish-date range', () => {
    expect(
      listUpdatesQuery.safeParse({ from: '2026-12-01', to: '2026-01-01' }).success
    ).toBe(false);
    expect(listUpdatesQuery.safeParse({ from: '2026-01-01', to: '2026-12-01' }).success).toBe(true);
    // One-sided ranges are fine.
    expect(listUpdatesQuery.safeParse({ from: '2026-01-01' }).success).toBe(true);
  });
});

describe('write-body schemas', () => {
  // Matches the schema after the program-API overhaul: degreeLevel became the
  // programLevel enum, durationText became minLength/maxLength in months, and
  // city moved to Institution.
  const validCourse = {
    institutionId: '11111111-1111-4111-8111-111111111111',
    title: 'MSc Data',
    programLevel: 'MASTERS_DEGREE',
    minLength: 12,
    maxLength: 12,
    tuitionFee: 12000,
    applicationFee: 0,
  };

  it('accepts a valid course and defaults its array fields', () => {
    const r = createCourseBody.safeParse(validCourse);
    expect(r.success).toBe(true);
    expect(r.data.tags).toEqual([]);
    expect(r.data.badges).toEqual([]);
  });

  it('rejects negative fees rather than rendering "$-500" on a card', () => {
    expect(createCourseBody.safeParse({ ...validCourse, tuitionFee: -500 }).success).toBe(false);
  });

  it('rejects an unknown field, so a typo is an error rather than a silent no-op', () => {
    expect(createCourseBody.safeParse({ ...validCourse, tuitionFeee: 1 }).success).toBe(false);
  });

  it('rejects a non-uuid institutionId', () => {
    expect(createCourseBody.safeParse({ ...validCourse, institutionId: '' }).success).toBe(false);
  });

  // A button with a label and no destination is a dead control.
  it('announcements require a ctaUrl whenever a ctaLabel is set', () => {
    expect(
      createAnnouncementBody.safeParse({ variant: 'INFO', message: 'm', ctaLabel: 'Click' }).success
    ).toBe(false);
    expect(
      createAnnouncementBody.safeParse({
        variant: 'INFO',
        message: 'm',
        ctaLabel: 'Click',
        ctaUrl: '/x',
      }).success
    ).toBe(true);
    // No button at all is fine.
    expect(createAnnouncementBody.safeParse({ variant: 'INFO', message: 'm' }).success).toBe(true);
  });

  it('rejects an unknown announcement variant', () => {
    expect(createAnnouncementBody.safeParse({ variant: 'RAINBOW', message: 'm' }).success).toBe(false);
  });

  it('uploadUrlBody requires a filename and content type', () => {
    expect(uploadUrlBody.safeParse({ filename: 'a.pdf', contentType: 'application/pdf' }).success).toBe(true);
    expect(uploadUrlBody.safeParse({ filename: 'a.pdf' }).success).toBe(false);
    expect(uploadUrlBody.safeParse({ filename: '', contentType: 'application/pdf' }).success).toBe(false);
  });
});


describe('ProgramLevel parity', () => {
  // The API schema carried a hand-written nine-value copy while the database
  // enum had seventeen. The eight it omitted could not be created, filtered or
  // edited -- a PUT echoing a course's own level returned 400 -- and 4,907 live
  // courses were on one of them. Deriving the list from Prisma makes drift
  // impossible; this asserts nobody reintroduces a literal.
  it('accepts exactly the levels the database defines', async () => {
    const { ProgramLevel } = await import('@prisma/client');
    const { PROGRAM_LEVELS } = await import('../src/modules/courses/courses.schemas.js');
    expect(new Set(PROGRAM_LEVELS)).toEqual(new Set(Object.values(ProgramLevel)));
  });

  it.each(['DOCTORAL_PHD', 'POST_GRADUATE_DIPLOMA', 'ADVANCED_DIPLOMA', 'SECONDARY_SCHOOL'])(
    'lets %s through the list filter',
    async (level) => {
      const { listCoursesQuery } = await import('../src/modules/courses/courses.schemas.js');
      expect(listCoursesQuery.safeParse({ programLevel: level }).success).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// Uploaded URLs
// ---------------------------------------------------------------------------
// `putObject` returns an absolute CDN URL when S3/R2 is configured and a RELATIVE
// `/uploads/<key>` path when it is not — and local storage is the live
// configuration. A FileField writes whatever came back straight into the form
// field, so every schema that used a plain z.string().url() answered a perfectly
// good upload with 400 "Invalid url". Agency logos and profile avatars each
// carried their own refinement and worked; institutions and MOI documents did not.
describe('uploaded URL fields accept what the upload endpoint actually returns', () => {
  const cases = [
    ['institution logo',   createInstitutionBody, (v) => ({ name: 'X', countryId: UUID, logoUrl: v })],
    ['institution banner', createInstitutionBody, (v) => ({ name: 'X', countryId: UUID, bannerUrl: v })],
    ['MOI document',       createMoiBody,         (v) => ({ institutionId: UUID, courseType: 'MBA', years: 2, documentUrl: v })],
    ['agency logo',        upsertAgencyBody,      (v) => ({ agencyName: 'A', logoUrl: v })],
    ['profile avatar',     updateProfileBody,     (v) => ({ avatarUrl: v })],
  ];

  it.each(cases)('%s accepts a local /uploads/ path', (_label, schema, body) => {
    expect(schema.safeParse(body('/uploads/logos/2f9c.png')).success).toBe(true);
  });

  it.each(cases)('%s still accepts an absolute CDN URL', (_label, schema, body) => {
    expect(schema.safeParse(body('https://cdn.nvimmigrationpvtltd.com/logos/2f9c.png')).success).toBe(true);
  });

  // The refinement must still refuse nonsense — it widens the rule, not removes it.
  it.each(cases)('%s rejects a string that is neither', (_label, schema, body) => {
    expect(schema.safeParse(body('logos/2f9c.png')).success).toBe(false);
  });
});
