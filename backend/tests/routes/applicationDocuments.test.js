import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});
// The real one writes to disk or S3. What matters here is the authorisation
// order, not where the bytes land.
vi.mock('../../src/utils/storage.js', async (importOriginal) => ({
  ...(await importOriginal()),
  putObject: vi.fn(async () => ({ fileUrl: '/uploads/application-documents/x.pdf', storage: 'local' })),
}));

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const { clearAuthCache } = await import('../../src/utils/userCache.js');
const storage = await import('../../src/utils/storage.js');
const app = (await import('../../src/app.js')).default;
const { bearer } = await import('../helpers/authToken.js');

const AGENT = '11111111-1111-4111-8111-111111111111';
const APP_ID = '22222222-2222-4222-8222-222222222222';
const DOC_ID = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
  storage.putObject.mockClear();
  prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });
});

const asAgent = (req) => req.set('Authorization', bearer({ role: 'AGENT', sub: AGENT }));

/** What the scope check asks for, so the assertions can read it back. */
const scopeWhere = () => prismaMock.application.findFirst.mock.calls[0][0].where;

/**
 * An agent had nowhere to attach a passport scan or the declaration form: the
 * Application model carried no documents, and /api/uploads is ADMIN-only, so
 * there was no upload endpoint an agent could reach at all.
 *
 * The risk in adding one is addressing the child directly. A document id carries
 * no agent, so a check on the DOCUMENT would let any agent reach any agency's
 * file by id. Every operation resolves the parent application under the caller's
 * scope first, and these pin that.
 */
describe('application documents are scoped to the agent who owns the application', () => {
  it('lists only within an application the agent owns', async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: APP_ID });
    prismaMock.applicationDocument.findMany.mockResolvedValue([]);

    await asAgent(request(app).get(`/api/applications/${APP_ID}/documents`)).expect(200);

    expect(scopeWhere()).toMatchObject({ id: APP_ID, agentId: AGENT });
  });

  // The same 404 an unknown id produces. Telling an agent that an application
  // exists but is not theirs is itself a disclosure.
  it('answers 404, not 403, for another agency’s application', async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);

    await asAgent(request(app).get(`/api/applications/${APP_ID}/documents`)).expect(404);
  });

  it('stores nothing when the application is not the agent’s', async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);

    await asAgent(
      request(app)
        .post(`/api/applications/${APP_ID}/documents`)
        .field('kind', 'PASSPORT')
        .attach('file', Buffer.from('%PDF-1.4 test'), 'passport.pdf')
    ).expect(404);

    // The upload and the authorisation decision are the same request, so a
    // refused one leaves no orphan file behind.
    expect(prismaMock.applicationDocument.create).not.toHaveBeenCalled();
  });

  it('records the file’s real name, type and size, not the client’s claims', async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: APP_ID });
    prismaMock.applicationDocument.create.mockResolvedValue({ id: DOC_ID });

    await asAgent(
      request(app)
        .post(`/api/applications/${APP_ID}/documents`)
        .field('kind', 'DECLARATION_FORM')
        .field('label', 'Signed declaration')
        .attach('file', Buffer.from('%PDF-1.4 hello'), 'declaration.pdf')
    ).expect(201);

    const { data } = prismaMock.applicationDocument.create.mock.calls[0][0];
    expect(data).toMatchObject({
      applicationId: APP_ID,
      uploadedById: AGENT,
      kind: 'DECLARATION_FORM',
      label: 'Signed declaration',
      fileName: 'declaration.pdf',
      contentType: 'application/pdf',
    });
    expect(data.sizeBytes).toBeGreaterThan(0);
  });

  it('refuses a kind the enum does not have', async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: APP_ID });

    await asAgent(
      request(app)
        .post(`/api/applications/${APP_ID}/documents`)
        .field('kind', 'NOT_A_KIND')
        .attach('file', Buffer.from('x'), 'a.pdf')
    ).expect(400);
  });

  // Without applicationId in the WHERE, a document id belonging to another
  // application would archive on the strength of the caller owning *some*
  // application.
  it('archives only a document that belongs to that application', async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: APP_ID });
    prismaMock.applicationDocument.updateMany.mockResolvedValue({ count: 1 });

    await asAgent(
      request(app).delete(`/api/applications/${APP_ID}/documents/${DOC_ID}`)
    ).expect(204);

    expect(prismaMock.applicationDocument.updateMany.mock.calls[0][0].where)
      .toMatchObject({ id: DOC_ID, applicationId: APP_ID, archivedAt: null });
  });

  it('soft-deletes rather than removing the row', async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: APP_ID });
    prismaMock.applicationDocument.updateMany.mockResolvedValue({ count: 1 });

    await asAgent(request(app).delete(`/api/applications/${APP_ID}/documents/${DOC_ID}`)).expect(204);

    expect(prismaMock.applicationDocument.delete).not.toHaveBeenCalled();
    expect(prismaMock.applicationDocument.updateMany.mock.calls[0][0].data.archivedAt).toBeInstanceOf(Date);
  });

  // An ADMIN is not scoped to one agency, so the scope clause must be absent
  // rather than set to their own id.
  it('does not scope an admin to their own applications', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });
    prismaMock.application.findFirst.mockResolvedValue({ id: APP_ID });
    prismaMock.applicationDocument.findMany.mockResolvedValue([]);

    await request(app)
      .get(`/api/applications/${APP_ID}/documents`)
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(scopeWhere().agentId).toBeUndefined();
  });

  it('refuses a student outright', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'STUDENT' });

    await request(app)
      .get(`/api/applications/${APP_ID}/documents`)
      .set('Authorization', bearer({ role: 'STUDENT' }))
      .expect(403);
  });
});
