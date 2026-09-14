import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/reports/activity.service.js');

beforeEach(resetPrismaMock);

const at = (iso) => new Date(iso);
const ACTOR = { id: 'u1', name: 'Darshan', email: 'd@example.com' };

/**
 * The activity feed merges three tables in JavaScript, which is the whole risk:
 * the database is not doing the ordering or the windowing, so both are code that
 * can be wrong while still returning a plausible page of rows.
 */

describe('listActivity', () => {
  it('interleaves the three streams by time, newest first', async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { id: 'a1', reference: 14, studentName: 'Dhruv', stage: 'APPLICATION', createdAt: at('2026-09-10'), agent: ACTOR, course: { institution: { name: 'EUBA' } } },
    ]);
    prismaMock.applicationDocument.findMany.mockResolvedValue([
      { id: 'd1', fileName: 'passport.pdf', kind: 'PASSPORT', createdAt: at('2026-09-12'), uploadedBy: ACTOR, application: { id: 'a1', reference: 14, studentName: 'Dhruv' } },
    ]);
    prismaMock.courseInquiry.findMany.mockResolvedValue([
      { id: 'q1', intake: 'Sep 2026', courseType: 'DIPLOMA', stage: 'INQUIRY', createdAt: at('2026-09-11'), agent: ACTOR, country: { code: 'CA', name: 'Canada', isoCode: 'ca' } },
    ]);

    const { items } = await service.listActivity({ page: 1, pageSize: 20 });

    expect(items.map((e) => e.type)).toEqual(['DOCUMENT', 'INQUIRY', 'APPLICATION']);
    // Ids are namespaced, so an application and a document that happen to share
    // a uuid cannot collide as React keys or in the sort tiebreak.
    expect(items[0].id).toBe('document:d1');
  });

  it('breaks ties on id so a row cannot fall between two pages', async () => {
    // A bulk import writes rows in the same millisecond constantly. With an
    // unstable sort those two swap places between the page-1 and page-2 queries
    // and one of them appears on neither.
    const same = at('2026-09-12T10:00:00.000Z');
    // resetPrismaMock clears calls but keeps resolutions, so the other two
    // streams have to be emptied explicitly or the previous test's rows leak in.
    prismaMock.applicationDocument.findMany.mockResolvedValue([]);
    prismaMock.courseInquiry.findMany.mockResolvedValue([]);
    prismaMock.application.findMany.mockResolvedValue([
      { id: 'b', reference: 2, studentName: 'B', stage: 'APPLICATION', createdAt: same, agent: ACTOR, course: null },
      { id: 'a', reference: 1, studentName: 'A', stage: 'APPLICATION', createdAt: same, agent: ACTOR, course: null },
    ]);

    const { items } = await service.listActivity({ page: 1, pageSize: 20 });

    expect(items.map((e) => e.id)).toEqual(['application:a', 'application:b']);
  });

  it('reads skip+take from each stream, since the top N is a subset of each top N', async () => {
    await service.listActivity({ page: 3, pageSize: 10 });

    for (const model of ['application', 'applicationDocument', 'courseInquiry']) {
      // Page 3 of 10 needs rows 20-29, so each stream must offer its first 30.
      expect(prismaMock[model].findMany.mock.calls[0][0].take).toBe(30);
    }
  });

  it('windows the merged list, not each stream', async () => {
    const rows = (n, prefix) => Array.from({ length: n }, (_, i) => ({
      id: `${prefix}${i}`, reference: i, studentName: 'X', stage: 'APPLICATION',
      createdAt: at(`2026-09-${String(28 - i).padStart(2, '0')}`), agent: ACTOR, course: null,
    }));
    prismaMock.applicationDocument.findMany.mockResolvedValue([]);
    prismaMock.courseInquiry.findMany.mockResolvedValue([]);
    prismaMock.application.findMany.mockResolvedValue(rows(6, 'a'));
    prismaMock.application.count.mockResolvedValue(6);

    const { items, meta } = await service.listActivity({ page: 2, pageSize: 2 });

    expect(items.map((e) => e.id)).toEqual(['application:a2', 'application:a3']);
    expect(meta.page).toBe(2);
  });

  it('totals all three tables, so the page count is not just the applications', async () => {
    prismaMock.application.count.mockResolvedValue(4);
    prismaMock.applicationDocument.count.mockResolvedValue(9);
    prismaMock.courseInquiry.count.mockResolvedValue(2);

    const { meta } = await service.listActivity({ page: 1, pageSize: 5 });

    expect(meta.total).toBe(15);
    expect(meta.totalPages).toBe(3);
  });

  it('filters documents by uploader, not by a column they do not have', async () => {
    await service.listActivity({ agentId: 'u1', page: 1, pageSize: 20 });

    expect(prismaMock.application.findMany.mock.calls[0][0].where).toEqual({ agentId: 'u1' });
    // ApplicationDocument has no agentId. `{ agentId }` here is not a narrower
    // query, it is a query for a column that does not exist — Prisma rejects it,
    // and the feed would 500 the moment an admin filtered by agency.
    expect(prismaMock.applicationDocument.findMany.mock.calls[0][0].where).toEqual({
      archivedAt: null,
      uploadedById: 'u1',
    });
  });

  it('counts only live documents, matching what it lists', async () => {
    await service.listActivity({ page: 1, pageSize: 20 });
    expect(prismaMock.applicationDocument.count.mock.calls[0][0].where).toEqual({ archivedAt: null });
  });
});

describe('listAgentSummary', () => {
  it('keeps agents who have filed nothing — they are the ones worth calling', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Alpha', email: 'a@x.com', createdAt: at('2026-01-01') },
      { id: 'u2', name: 'Beta', email: 'b@x.com', createdAt: at('2026-02-01') },
    ]);
    prismaMock.application.groupBy
      .mockResolvedValueOnce([{ agentId: 'u2', _count: { _all: 5 } }])
      .mockResolvedValueOnce([{ agentId: 'u2', _max: { createdAt: at('2026-09-01') } }]);
    prismaMock.courseInquiry.groupBy.mockResolvedValue([]);

    const rows = await service.listAgentSummary({ limit: 10 });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'Beta', applications: 5, inquiries: 0 });
    // An inner join would have dropped this one entirely.
    expect(rows[1]).toMatchObject({ name: 'Alpha', applications: 0, lastActiveAt: null });
  });

  it('asks for nothing else when there are no agents', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    expect(await service.listAgentSummary({})).toEqual([]);
    expect(prismaMock.application.groupBy).not.toHaveBeenCalled();
  });
});
