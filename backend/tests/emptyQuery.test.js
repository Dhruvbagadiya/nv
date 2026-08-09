import { describe, it, expect } from 'vitest';
import { listCoursesQuery } from '../src/modules/courses/courses.schemas.js';
import { listApplicationsQuery } from '../src/modules/applications/applications.schemas.js';
import { listInquiriesQuery } from '../src/modules/courseInquiries/courseInquiries.schemas.js';
import { listMoiQuery } from '../src/modules/moiInstitutions/moiInstitutions.schemas.js';
import { listDocumentsQuery } from '../src/modules/documents/documents.schemas.js';
import { listCommissionsQuery } from '../src/modules/commissions/commissions.schemas.js';
import { listEntryRequirementsQuery } from '../src/modules/entryRequirements/entryRequirements.schemas.js';
import { listUpdatesQuery } from '../src/modules/importantUpdates/importantUpdates.schemas.js';
import { listInstitutionsQuery } from '../src/modules/institutions/institutions.schemas.js';
import { listNotificationsQuery } from '../src/modules/notifications/notifications.schemas.js';
import { listCountriesQuery } from '../src/modules/countries/countries.schemas.js';

// A browser form with nothing selected serialises to `?countryId=&stage=&page=1`.
// zod's `.optional()` only permits the key to be ABSENT, so a present empty string
// is still validated — and `z.string().uuid().optional()` rejects `countryId=`.
//
// Six of eight filtered screens 400'd on first load because of this, the Dashboard
// among them. Every API test had passed, because they all either sent a real value
// or omitted the key entirely — neither of which is what a browser does.
//
// These are the exact query strings the screens send with no filters applied.

const FIRST_LOAD = [
  ['Dashboard / courses', listCoursesQuery, { country: '', search: '', tag: '', programLevel: '', institutionId: '', page: '1' }],
  ['Application history', listApplicationsQuery, { country: '', institutionId: '', stage: '', passportNo: '', studentName: '', page: '1' }],
  ['Course inquiry history', listInquiriesQuery, { countryId: '', intake: '', stage: '', page: '1' }],
  ['MOI accepted', listMoiQuery, { country: '', courseType: '', institutionId: '', page: '1' }],
  ['Document bank', listDocumentsQuery, { category: 'SOP', countryId: '', institutionId: '', search: '', page: '1' }],
  ['Universities commission', listCommissionsQuery, { country: '', search: '', page: '1' }],
  ['Entry requirements', listEntryRequirementsQuery, { level: 'UG', country: '', institutionId: '', englishRequirement: '', credibilityInterview: '', page: '1' }],
  ['Important updates', listUpdatesQuery, { from: '', to: '', countryId: '', institutionId: '', page: '1' }],
  ['Institution dropdowns', listInstitutionsQuery, { country: '', search: '', blacklisted: '', trending: '', includeArchived: '' }],
  ['Notifications', listNotificationsQuery, { unreadOnly: '', page: '1' }],
  ['Countries', listCountriesQuery, { withInstitutionsOnly: '' }],
];

describe('empty query parameters mean "no filter"', () => {
  it.each(FIRST_LOAD)('%s loads with every filter empty', (_name, schema, query) => {
    const result = schema.safeParse(query);
    const why = result.success ? '' : JSON.stringify(result.error.issues);
    expect(result.success, why).toBe(true);
  });

  // An empty value must become undefined, not survive as '' — otherwise the
  // service builds `where: { stage: '' }` and silently matches nothing.
  it.each(FIRST_LOAD)('%s drops empty values rather than passing them through', (_n, schema, query) => {
    const data = schema.parse(query);
    for (const [key, value] of Object.entries(data)) {
      expect(value, `${key} survived as an empty string`).not.toBe('');
    }
  });

  it('still rejects values that are genuinely wrong', () => {
    expect(listInquiriesQuery.safeParse({ countryId: 'not-a-uuid' }).success).toBe(false);
    expect(listInquiriesQuery.safeParse({ stage: 'BOGUS' }).success).toBe(false);
    expect(listCoursesQuery.safeParse({ page: 'abc' }).success).toBe(false);
    expect(listUpdatesQuery.safeParse({ from: 'not-a-date' }).success).toBe(false);
  });

  it('keeps real values intact', () => {
    const parsed = listInquiriesQuery.parse({
      countryId: '11111111-1111-4111-8111-111111111111',
      intake: 'Jan 2027',
      stage: 'PENDING',
      page: '2',
    });
    expect(parsed.stage).toBe('PENDING');
    expect(parsed.intake).toBe('Jan 2027');
    expect(parsed.page).toBe(2);
  });

  // "false" is a non-empty string and therefore truthy — an untyped flag becomes a
  // filter that cannot be switched off. Empty must mean "not set", NOT false.
  it('distinguishes empty from false on boolean flags', () => {
    expect(listInstitutionsQuery.parse({ blacklisted: '' }).blacklisted).toBeUndefined();
    expect(listInstitutionsQuery.parse({ blacklisted: 'false' }).blacklisted).toBe(false);
    expect(listInstitutionsQuery.parse({ blacklisted: 'true' }).blacklisted).toBe(true);
  });
});
