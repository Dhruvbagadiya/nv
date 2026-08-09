import { describe, it, expect } from 'vitest';
import { registerSchema, createUserSchema, loginSchema } from '../src/modules/auth/auth.schemas.js';
import { createSubAgentBody } from '../src/modules/auth/auth.schemas.js';
import { listCoursesQuery, createCourseBody } from '../src/modules/courses/courses.schemas.js';
import { listApplicationsQuery } from '../src/modules/applications/applications.schemas.js';
import { listDocumentsQuery, uploadUrlBody } from '../src/modules/documents/documents.schemas.js';
import { createAnnouncementBody } from '../src/modules/announcements/announcements.schemas.js';
import { listUpdatesQuery } from '../src/modules/importantUpdates/importantUpdates.schemas.js';
import { listEntryRequirementsQuery } from '../src/modules/entryRequirements/entryRequirements.schemas.js';
import { listInstitutionsQuery } from '../src/modules/institutions/institutions.schemas.js';

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
