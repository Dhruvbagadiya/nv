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
    source: 'catalogue_a',
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

  // The contract is the key's PRESENCE, not its length.
  //
  // It used to be `intakes?.length`, which made an empty array mean the same as
  // an absent key — so a user who removed every intake and saved got a success
  // message and the rows back on reopening. That guard was compensating for an
  // admin form that posted a truncated list (the list query caps intakes at 12);
  // the form now omits the key entirely until it holds the complete set, so the
  // honest reading is safe and clearing works.
  it('clears the set when handed an empty array', async () => {
    await service.updateCourse('c1', { title: 'Renamed', intakes: [] });

    const data = prismaMock.course.update.mock.calls[0][0].data;
    expect(data.intakes.deleteMany).toEqual({});
    expect(data.intakes.create).toEqual([]);
  });

  // The other half of that contract, and the reason an absent key cannot be
  // treated as an empty one: most saves say nothing about intakes at all.
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

describe('createCourse', () => {
  beforeEach(() => {
    prismaMock.course.create.mockResolvedValue(courseRow());
  });

  // Course.slug is required with no default, but the request schema makes it
  // optional. Prisma then raised a validation error with no `.code`, which the
  // error handler could not map, so a create without a slug was a guaranteed 500.
  it('derives a slug when the caller omits one', async () => {
    await service.createCourse({ institutionId: 'i1', title: 'MSc Data Science', tuitionFee: 1 });

    // The bare slug, with no timestamp on the end. The suffix used to be
    // unconditional because it was the only collision handling there was; the
    // retry below does that job properly, and a URL ending in a base36
    // timestamp was the price of never testing whether it collided.
    expect(prismaMock.course.create.mock.calls[0][0].data.slug).toBe('msc-data-science');
  });

  it('keeps an explicit slug untouched when nothing else holds it', async () => {
    await service.createCourse({ institutionId: 'i1', title: 'X', slug: 'chosen-slug', tuitionFee: 1 });

    expect(prismaMock.course.create.mock.calls[0][0].data.slug).toBe('chosen-slug');
  });

  /**
   * Two courses of the same name at different institutions is an ordinary thing
   * to want, and the admin form derives the slug from the title as you type — so
   * the second "Diploma in Hospitality Management" sent the same slug as the
   * first and got "That value is already taken", naming neither the field nor
   * the value, over a string the admin never chose.
   */
  it('retries with a numbered slug when the derived one is taken', async () => {
    const collision = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['slug'] },
    });
    prismaMock.course.create
      .mockRejectedValueOnce(collision)
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce(courseRow({ slug: 'diploma-in-hospitality-management-3' }));

    await service.createCourse({
      institutionId: 'i1', title: 'Diploma in Hospitality Management', tuitionFee: 1,
    });

    expect(prismaMock.course.create.mock.calls.map((c) => c[0].data.slug)).toEqual([
      'diploma-in-hospitality-management',
      'diploma-in-hospitality-management-2',
      'diploma-in-hospitality-management-3',
    ]);
  });

  // A retry loop rather than a "find the next free number" query, because that
  // query has a race in it — so the constraint stays the arbiter, and anything
  // that is NOT the slug has to come straight back out.
  it('does not retry a collision on anything but the slug', async () => {
    const collision = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['source', 'externalId'] },
    });
    prismaMock.course.create.mockRejectedValue(collision);

    // (source, externalId) colliding means this row is already imported, which
    // is a real conflict the caller has to see.
    await expect(
      service.createCourse({ institutionId: 'i1', title: 'X', tuitionFee: 1 })
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(prismaMock.course.create).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than looping forever', async () => {
    const collision = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['slug'] },
    });
    prismaMock.course.create.mockRejectedValue(collision);

    await expect(
      service.createCourse({ institutionId: 'i1', title: 'X', tuitionFee: 1 })
    ).rejects.toThrow(/set the slug by hand/);
  });
});

// Same defect as createCourse above, in the path that skipped the fix: the bulk
// importer handed its rows straight to createMany, and the import screen never
// sends a slug, so every bulk import raised a PrismaClientValidationError and
// surfaced as a 500. Its own screen test mocked the API, so it passed against a
// backend that could not accept its payload.
describe('bulkCreateCourses', () => {
  beforeEach(() => {
    prismaMock.course.createMany.mockResolvedValue({ count: 2 });
  });

  const dataOf = () => prismaMock.course.createMany.mock.calls[0][0].data;

  it('derives a slug for every row that arrives without one', async () => {
    await service.bulkCreateCourses([
      { institutionId: 'i1', title: 'MSc Data Science', tuitionFee: 1 },
      { institutionId: 'i1', title: 'BA Design', tuitionFee: 2 },
    ]);

    const [a, b] = dataOf();
    expect(a.slug).toMatch(/^msc-data-science-/);
    expect(b.slug).toMatch(/^ba-design-/);
  });

  // A whole file is created inside one millisecond, so a timestamp alone gives
  // two rows of the same title an identical slug — and `skipDuplicates` would
  // then drop the second silently rather than reporting anything.
  it('gives two rows of the same title distinct slugs', async () => {
    await service.bulkCreateCourses([
      { institutionId: 'i1', title: 'MBA', tuitionFee: 1 },
      { institutionId: 'i2', title: 'MBA', tuitionFee: 2 },
    ]);

    const [a, b] = dataOf();
    expect(a.slug).not.toBe(b.slug);
  });

  it('keeps an explicit slug untouched', async () => {
    await service.bulkCreateCourses([{ institutionId: 'i1', title: 'X', slug: 'chosen', tuitionFee: 1 }]);

    expect(dataOf()[0].slug).toBe('chosen');
  });

  it('still asks Prisma to skip duplicates', async () => {
    await service.bulkCreateCourses([{ institutionId: 'i1', title: 'X', tuitionFee: 1 }]);

    expect(prismaMock.course.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });
});

/**
 * The list used the detail include, so a page of 12 courses also fetched each
 * institution's commission row, up to 12 gallery photos per course, and EVERY
 * intake row — unbounded, and a rolling course carries dozens. A card reads
 * none of it: the gallery backs the detail view, and no screen reads the
 * institution commission object at all.
 */
describe('searchCourses — what a page of cards actually needs', () => {
  beforeEach(() => {
    resetPrismaMock();
    prismaMock.course.findMany.mockResolvedValue([]);
    prismaMock.course.count.mockResolvedValue(0);
  });

  const includeOf = () => prismaMock.course.findMany.mock.calls[0][0].include;

  it('does not fetch the photo gallery for a list', async () => {
    await service.searchCourses({ page: 1, pageSize: 12 });
    expect(includeOf().institution.include.photos).toBeUndefined();
  });

  it('does not fetch the institution commission for a list', async () => {
    await service.searchCourses({ page: 1, pageSize: 12 });
    expect(includeOf().institution.include.commission).toBeUndefined();
  });

  // Cards do show intakes, so these are bounded rather than dropped.
  it('bounds the intake rows instead of taking all of them', async () => {
    await service.searchCourses({ page: 1, pageSize: 12 });
    expect(includeOf().intakes.take).toBeGreaterThan(0);
  });

  it('still fetches the detail view in full', async () => {
    // The row is absent, so getCourse throws — irrelevant here. What is being
    // asserted is the include it asked for, which is recorded either way.
    prismaMock.course.findFirst.mockResolvedValue(null);
    await expect(service.getCourse('11111111-1111-1111-1111-111111111111')).rejects.toThrow();

    const include = prismaMock.course.findFirst.mock.calls[0][0].include;
    expect(include.institution.include.photos).toBeDefined();
    expect(include.institution.include.commission).toBe(true);
  });
});

/**
 * Intakes, on the create path.
 *
 * Reported as "intakes are not saving and showing when selected". Two different
 * things wear that name and only one of them is a store: `intakeMonths` is the
 * recurring pattern the month chips write, and `intakes` are dated instances
 * with real deadlines. The admin list counted only the second, so selecting six
 * months and saving rendered "0" in a column headed Intakes.
 *
 * These pin the half that is a store, so the display fix is not covering for a
 * write that never happened.
 */
describe('createCourse — intakes', () => {
  beforeEach(() => {
    prismaMock.course.create.mockResolvedValue(courseRow());
  });

  it('writes the recurring months as given', async () => {
    await service.createCourse({
      institutionId: 'i1', title: 'X', tuitionFee: 1, intakeMonths: [2, 9],
    });

    expect(prismaMock.course.create.mock.calls[0][0].data.intakeMonths).toEqual([2, 9]);
  });

  it('creates dated intakes alongside the course, in one write', async () => {
    const intakes = [
      { startDate: new Date('2027-02-01'), openDate: null, submissionDeadline: null, overallScore: 6.5, scoreDetails: [] },
    ];

    await service.createCourse({ institutionId: 'i1', title: 'X', tuitionFee: 1, intakes });

    const data = prismaMock.course.create.mock.calls[0][0].data;
    expect(data.intakes.create).toHaveLength(1);
    expect(data.intakes.create[0].overallScore).toBe(6.5);
  });

  it('omits the nested create entirely when there are no dated intakes', async () => {
    await service.createCourse({ institutionId: 'i1', title: 'X', tuitionFee: 1, intakes: [] });

    // `intakes: { create: [] }` is a valid but pointless write; the absence is
    // what keeps the created row's shape the same as one made by the importer.
    expect(prismaMock.course.create.mock.calls[0][0].data.intakes).toBeUndefined();
  });

  // The two are independent: a course can run every February with no dated
  // instance published, which is the ordinary case for most providers.
  it('keeps months when there are no dated intakes, and the reverse', async () => {
    await service.createCourse({
      institutionId: 'i1', title: 'X', tuitionFee: 1, intakeMonths: [2, 9], intakes: [],
    });

    const data = prismaMock.course.create.mock.calls[0][0].data;
    expect(data.intakeMonths).toEqual([2, 9]);
    expect(data.intakes).toBeUndefined();
  });

  // The response is what the admin form seeds itself from after a save, so a
  // create that stores intakes and returns none looks identical to one that
  // stored nothing.
  it('asks for the intakes back, so the saved course renders them', async () => {
    await service.createCourse({ institutionId: 'i1', title: 'X', tuitionFee: 1 });

    expect(prismaMock.course.create.mock.calls[0][0].include.intakes).toBeTruthy();
  });
});
