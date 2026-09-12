import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const { clearAuthCache } = await import('../../src/utils/userCache.js');
const app = (await import('../../src/app.js')).default;
const { bearer } = await import('../helpers/authToken.js');

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
  prismaMock.course.count.mockResolvedValue(0);
  prismaMock.institution.count.mockResolvedValue(0);
});

/** What the service was actually asked to fetch. */
const courseWhere = () => prismaMock.course.findMany.mock.calls[0][0].where;

// GET /api/courses is public so students can browse without signing in, but it
// accepted `status=archived` from anyone — letting the whole internet enumerate
// courses an admin had deliberately hidden.
describe('archived rows are not publicly enumerable', () => {
  it('ignores status=archived from an anonymous caller', async () => {
    await request(app).get('/api/courses?status=archived').expect(200);

    // The active filter is still applied, so nothing archived comes back.
    expect(courseWhere().archivedAt).toBeNull();
  });

  it('ignores status=all from an agent', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });

    await request(app)
      .get('/api/courses?status=all')
      .set('Authorization', bearer({ role: 'AGENT' }))
      .expect(200);

    expect(courseWhere().archivedAt).toBeNull();
  });

  it('honours status=archived for an admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });

    await request(app)
      .get('/api/courses?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(courseWhere().archivedAt).toEqual({ not: null });
  });

  // A token is proof of who signed in, not of what they may still do.
  it('treats a deactivated admin as anonymous', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: false, role: 'ADMIN' });

    await request(app)
      .get('/api/courses?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(courseWhere().archivedAt).toBeNull();
  });

  // The token still says ADMIN; the database says otherwise, and the database wins.
  it('uses the stored role, not the role baked into the token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });

    await request(app)
      .get('/api/courses?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(courseWhere().archivedAt).toBeNull();
  });
});

/**
 * The course catalogue is public so a student can browse without an account —
 * but commission is partner-confidential everywhere else in the product:
 * /api/commissions requires a partner role, the screen lives under /partner/*,
 * and only partner components render it. The figures rode along on the public
 * programme payload regardless, so they sat in the network tab of any anonymous
 * visitor to /programs. The UI simply never drew them.
 */
describe('commission is not served to callers who may not see it', () => {
  const COURSE = {
    id: 'c1',
    title: 'MSc Data Science',
    slug: 'msc-data-science',
    programLevel: 'MASTERS_DEGREE',
    minLength: 12, maxLength: 12,
    tuitionFee: 20000,
    applicationFee: null,
    // The per-course payout column, and the institution's structured rates.
    commissionAmount: 1500,
    currencyCode: null,
    languageOfInstruction: 'eng',
    abAppCreationEnabled: false,
    successScoreIntent: null, successScoreLabel: null,
    tags: [], badges: [], intakeMonths: [9],
    entryRequirements: null, externalUrl: null,
    archivedAt: null, source: null, externalId: null,
    createdAt: new Date(), updatedAt: new Date(),
    intakes: [],
    institution: {
      id: 'i1', name: 'Test University', slug: 'test-university',
      city: 'London', province: null, logoUrl: null, bannerUrl: null, photos: [],
      country: { code: 'UK', currencyCode: 'GBP', name: 'United Kingdom', isoCode: 'gb' },
      commission: {
        commissionType: 'percentage', rateFrom: 10, rateTo: 15,
        amountFrom: null, amountTo: null, isTierAdjusted: false,
        maxNumberOfInstallments: null, tuitionBasis: 'net',
      },
    },
  };

  beforeEach(() => {
    prismaMock.course.findMany.mockResolvedValue([COURSE]);
    prismaMock.course.count.mockResolvedValue(1);
    prismaMock.course.findFirst.mockResolvedValue(COURSE);
  });

  it('withholds both commission fields from an anonymous list request', async () => {
    const res = await request(app).get('/api/courses').expect(200);

    const attr = res.body.data[0].attributes;
    expect(attr.commissionAmount).toBeNull();
    // The structured object is omitted outright rather than nulled — the
    // serializer only adds the key when there is something to put in it.
    expect(attr).not.toHaveProperty('commission');
    // The rest of the card is untouched — this narrows the payload, not the page.
    expect(attr.tuition).toBe(20000);
  });

  // This route had NO auth middleware at all, so req.user was always undefined
  // and every caller looked anonymous — including a real agent.
  it('withholds them from an anonymous detail request', async () => {
    const res = await request(app).get('/api/courses/11111111-1111-4111-8111-111111111111').expect(200);

    expect(res.body.data.attributes.commissionAmount).toBeNull();
    expect(res.body.data.attributes).not.toHaveProperty('commission');
  });

  it('withholds them from a signed-in STUDENT', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'STUDENT' });

    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', bearer({ role: 'STUDENT' }))
      .expect(200);

    expect(res.body.data[0].attributes.commissionAmount).toBeNull();
  });

  it.each(['AGENT', 'ADMIN', 'SUPER_ADMIN'])('still serves them to %s', async (role) => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role });

    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', bearer({ role }))
      .expect(200);

    expect(res.body.data[0].attributes.commissionAmount).toBe(1500);
  });

  it('serves the structured rates to an agent on the detail route', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });

    const res = await request(app)
      .get('/api/courses/11111111-1111-4111-8111-111111111111')
      .set('Authorization', bearer({ role: 'AGENT' }))
      .expect(200);

    expect(res.body.data.attributes.commission).toMatchObject({ type: 'percentage', rateFrom: 10 });
  });
});

/**
 * Six controllers wrapped `status` in canSeeArchived and two did not, so any
 * authenticated agent could ask for the rows an admin had retired: the full body
 * of a withdrawn policy update, the direct number of a staff member who has
 * left. The by-id paths were always guarded — only the lists were open.
 */
describe('archived reference rows are not readable by an agent', () => {
  beforeEach(() => {
    prismaMock.importantUpdate.findMany.mockResolvedValue([]);
    prismaMock.importantUpdate.count.mockResolvedValue(0);
    prismaMock.supportContact.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });
  });

  it('ignores ?status=archived on important updates', async () => {
    await request(app)
      .get('/api/important-updates?status=archived')
      .set('Authorization', bearer({ role: 'AGENT' }))
      .expect(200);

    expect(prismaMock.importantUpdate.findMany.mock.calls[0][0].where.archivedAt).toBeNull();
  });

  it('ignores ?status=all on support contacts', async () => {
    await request(app)
      .get('/api/support-contacts?status=all')
      .set('Authorization', bearer({ role: 'AGENT' }))
      .expect(200);

    expect(prismaMock.supportContact.findMany.mock.calls[0][0].where.archivedAt).toBeNull();
  });

  it('still lets an admin find an archived update to restore it', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });

    await request(app)
      .get('/api/important-updates?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    // archiveWhere('archived') asks for rows that HAVE an archivedAt.
    expect(prismaMock.importantUpdate.findMany.mock.calls[0][0].where.archivedAt).not.toBeNull();
  });
});
