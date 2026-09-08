import { describe, it, expect, beforeEach, vi } from 'vitest';

// Replace the shared Prisma singleton before courses.service.js imports it, so
// no real client is ever constructed. tests/setup.js also points DATABASE_URL at
// an unreachable host, so a mistake here fails loudly rather than silently
// reaching production.
vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/courses/courses.service.js');

beforeEach(resetPrismaMock);

/** The shape courses.service.js expects back from a findMany/update include. */
function courseRow(overrides = {}) {
  return {
    id: 'c1',
    institutionId: 'i1',
    title: 'BSc Computing',
    shortName: null,
    slug: 'bsc-computing',
    programLevel: 'BACHELORS_DEGREE',
    minLength: 36,
    maxLength: 36,
    languageOfInstruction: 'eng',
    tuitionFee: 12800,
    applicationFee: null,
    currencyCode: null,
    commissionAmount: null,
    abAppCreationEnabled: false,
    successScoreIntent: null,
    successScoreLabel: null,
    tags: ['top_programs'],
    badges: ['Instant Offer'],
    intakeMonths: [2, 9],
    entryRequirements: null,
    externalUrl: null,
    source: 'applyboard',
    externalId: 42,
    archivedAt: null,
    intakes: [],
    institution: {
      id: 'i1',
      name: 'Test University',
      slug: 'test-university',
      city: 'Leeds',
      province: null,
      logoUrl: null,
      bannerUrl: null,
      photos: [],
      commission: null,
      country: { code: 'UK', currencyCode: 'GBP' },
    },
    ...overrides,
  };
}

describe('toProgramResource — the shape the admin form round-trips', () => {
  // The admin course form reads attr.badges on open and posts it back on save.
  // The serializer never emitted `badges`, so the form always read [] and every
  // save wrote [] — destroying the badges on 55,446 courses one edit at a time.
  it('returns badges, because the admin form posts back whatever it reads', async () => {
    prismaMock.course.findFirst.mockResolvedValue(courseRow());

    const resource = await service.getCourse('c1');

    expect(resource.attributes.badges).toEqual(['Instant Offer']);
  });

  // The form seeds its currency field from this. If it only ever sees the
  // resolved value, a course that inherits its country's currency gets that
  // value written back as an explicit override and stops inheriting.
  it('distinguishes an inherited currency from a course-level override', async () => {
    prismaMock.course.findFirst.mockResolvedValue(courseRow({ currencyCode: null }));
    const inherited = await service.getCourse('c1');

    // What to display: falls back to the country.
    expect(inherited.attributes.currency).toBe('GBP');
    // What the form must seed from: no override is set on this course.
    expect(inherited.attributes.currencyCode).toBeNull();

    prismaMock.course.findFirst.mockResolvedValue(courseRow({ currencyCode: 'AED' }));
    const overridden = await service.getCourse('c1');
    expect(overridden.attributes.currencyCode).toBe('AED');
  });
});

describe('updateCourse — intake handling', () => {
  beforeEach(() => {
    prismaMock.course.update.mockResolvedValue(courseRow());
  });

  // `[]` is truthy. The admin form sends `intakes` on every save, filtered to
  // rows that have a start date — so saving a course whose intake rows were
  // never filled in deleted every CourseIntake row it had.
  it('does not delete every intake when handed an empty array', async () => {
    await service.updateCourse('c1', { title: 'Renamed', intakes: [] });

    const data = prismaMock.course.update.mock.calls[0][0].data;
    expect(data.intakes).toBeUndefined();
  });

  it('leaves intakes alone when the key is absent', async () => {
    await service.updateCourse('c1', { title: 'Renamed' });

    const data = prismaMock.course.update.mock.calls[0][0].data;
    expect(data.intakes).toBeUndefined();
  });

  it('replaces the set when real intakes are supplied', async () => {
    const intakes = [{ startDate: new Date('2027-02-01'), openDate: null, submissionDeadline: null }];
    await service.updateCourse('c1', { intakes });

    const data = prismaMock.course.update.mock.calls[0][0].data;
    expect(data.intakes.deleteMany).toEqual({});
    expect(data.intakes.create).toHaveLength(1);
  });

  // The admin form maps only the three dates, so a save that survives the bug
  // above still silently discarded the score an admissions decision rests on.
  it('carries overallScore and scoreDetails through a replacement', async () => {
    const intakes = [{
      startDate: new Date('2027-02-01'),
      openDate: null,
      submissionDeadline: null,
      overallScore: 6.5,
      scoreDetails: [{ test: 'IELTS', band: '6.5' }],
    }];
    await service.updateCourse('c1', { intakes });

    const created = prismaMock.course.update.mock.calls[0][0].data.intakes.create[0];
    expect(created.overallScore).toBe(6.5);
    expect(created.scoreDetails).toEqual([{ test: 'IELTS', band: '6.5' }]);
  });
});
