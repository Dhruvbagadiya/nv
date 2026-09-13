import { describe, it, expect, beforeEach, vi } from 'vitest';

// Replace the shared Prisma singleton before the service imports it, so no real
// client is ever constructed.
vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/applications/applications.service.js');

beforeEach(resetPrismaMock);

/**
 * The aggregates behind the partner dashboard.
 *
 * Two of these do their arithmetic in JavaScript rather than in the database —
 * countByCountry because the country is two joins away from Application and
 * groupBy only groups by columns on the model, topCourses because the groupBy
 * gives ids and the names need a second query. That arithmetic is the part a
 * mock can actually prove, and it is the part that will break silently: a
 * miscounted tally still renders a tidy chart.
 */

describe('countByCountry', () => {
  it('tallies through the course→institution→country chain and sorts by volume', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { course: { institution: { countryId: 'uk' } } },
      { course: { institution: { countryId: 'ca' } } },
      { course: { institution: { countryId: 'uk' } } },
      { course: { institution: { countryId: 'uk' } } },
    ]);
    prismaMock.country.findMany.mockResolvedValue([
      { id: 'ca', code: 'CA', name: 'Canada', isoCode: 'ca' },
      { id: 'uk', code: 'UK', name: 'United Kingdom', isoCode: 'gb' },
    ]);

    const rows = await service.countByCountry({ agentId: 'a1' });

    // Sorted here, not by the country findMany, which returns whatever order the
    // planner likes — it deliberately came back alphabetical above.
    expect(rows.map((r) => [r.code, r.count])).toEqual([['UK', 3], ['CA', 1]]);
    expect(prismaMock.application.findMany.mock.calls[0][0].where).toEqual({ agentId: 'a1' });
  });

  it('drops applications whose course has no institution country', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { course: { institution: { countryId: 'uk' } } },
      // A course with no institution, and an application with no course at all.
      // Both are reachable rows, and `undefined` as a Map key would have counted
      // them as a country of their own.
      { course: { institution: null } },
      { course: null },
    ]);
    prismaMock.country.findMany.mockResolvedValue([
      { id: 'uk', code: 'UK', name: 'United Kingdom', isoCode: 'gb' },
    ]);

    const rows = await service.countByCountry({});

    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(1);
    expect(prismaMock.country.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['uk'] } });
  });

  it('asks for no countries when there are no applications', async () => {
    prismaMock.application.findMany.mockResolvedValue([]);

    expect(await service.countByCountry({})).toEqual([]);
    // `{ id: { in: [] } }` is a valid query that returns nothing, so the bug this
    // guards is a wasted round trip rather than a wrong answer — but it is on the
    // path every brand-new partner takes.
    expect(prismaMock.country.findMany).not.toHaveBeenCalled();
  });
});

describe('topCourses', () => {
  it('keeps the groupBy ordering, not the findMany ordering', async () => {
    prismaMock.application.groupBy.mockResolvedValue([
      { courseId: 'c2', _count: { _all: 5 } },
      { courseId: 'c1', _count: { _all: 2 } },
    ]);
    prismaMock.course.findMany.mockResolvedValue([
      { id: 'c1', title: 'BSc Computing', institution: { name: 'Leeds' } },
      { id: 'c2', title: 'MSc Data', institution: { name: 'Sheffield' } },
    ]);

    const rows = await service.topCourses({ agentId: 'a1', limit: 5 });

    expect(rows.map((r) => [r.title, r.count])).toEqual([['MSc Data', 5], ['BSc Computing', 2]]);
  });

  it('drops a course the second query could not find', async () => {
    // Archived or deleted between the two queries. Without the filter this
    // rendered a row of `undefined` with a real count beside it.
    prismaMock.application.groupBy.mockResolvedValue([
      { courseId: 'gone', _count: { _all: 9 } },
      { courseId: 'c1', _count: { _all: 1 } },
    ]);
    prismaMock.course.findMany.mockResolvedValue([
      { id: 'c1', title: 'BSc Computing', institution: { name: 'Leeds' } },
    ]);

    const rows = await service.topCourses({});

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('BSc Computing');
  });
});

describe('monthOverMonth', () => {
  it('bounds last month on both sides so the two windows cannot overlap', async () => {
    prismaMock.application.count.mockResolvedValueOnce(4).mockResolvedValueOnce(7);

    const result = await service.monthOverMonth({ agentId: 'a1' });

    expect(result).toEqual({ thisMonth: 4, lastMonth: 7 });

    const [thisCall, lastCall] = prismaMock.application.count.mock.calls.map((c) => c[0].where);
    expect(lastCall.createdAt.lt.getTime()).toBe(thisCall.createdAt.gte.getTime());
    expect(lastCall.createdAt.gte.getTime()).toBeLessThan(lastCall.createdAt.lt.getTime());
    // Both windows start at midnight on the 1st, not at "now minus 30 days".
    expect(thisCall.createdAt.gte.getDate()).toBe(1);
    expect(thisCall.createdAt.gte.getHours()).toBe(0);
  });

  it('rolls the year back in January', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 14));
    try {
      await service.monthOverMonth({});
      const [, lastCall] = prismaMock.application.count.mock.calls.map((c) => c[0].where);
      expect(lastCall.createdAt.gte.getFullYear()).toBe(2025);
      expect(lastCall.createdAt.gte.getMonth()).toBe(11);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('countAwaitingDocuments', () => {
  it('counts applications with no document that is not archived', async () => {
    prismaMock.application.count.mockResolvedValue(3);

    expect(await service.countAwaitingDocuments({ agentId: 'a1' })).toBe(3);
    // `none` on the unarchived set, not `none` on all documents — an application
    // whose only upload was archived is still waiting for one.
    expect(prismaMock.application.count.mock.calls[0][0].where).toEqual({
      agentId: 'a1',
      documents: { none: { archivedAt: null } },
    });
  });
});
