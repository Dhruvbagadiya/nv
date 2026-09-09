import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

// The bucket is the one thing these routes touch that a test must not reach.
// Only putObject is replaced — the multer layer, the guards and the allow-list
// still run, which is where the behaviour under test lives.
vi.mock('../../src/utils/storage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    putObject: vi.fn(async () => ({
      key: 'k',
      fileUrl: 'https://cdn.example.com/institution-logos/abc.png',
      storage: 's3',
    })),
  };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const { clearAuthCache } = await import('../../src/utils/userCache.js');
const storage = await import('../../src/utils/storage.js');
const app = (await import('../../src/app.js')).default;
const { bearer } = await import('../helpers/authToken.js');

const asAdmin = () => {
  prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });
  return bearer({ role: 'ADMIN' });
};

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
  vi.clearAllMocks();
});

/**
 * The admin forms asked for a "Logo URL" and a "Banner URL" as free text, so an
 * admin had to host the image somewhere else and paste a link back. Nothing in
 * the product could produce that link.
 */
describe('POST /api/uploads/image', () => {
  it('stores the image and returns the URL the form should save', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', asAdmin())
      .field('category', 'institution-logos')
      .attach('file', Buffer.from('fake-png'), { filename: 'logo.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.fileUrl).toBe('https://cdn.example.com/institution-logos/abc.png');
    // The category reaches putObject as a folder hint, so uploads stay sorted by
    // what they are rather than landing in one flat prefix.
    expect(storage.putObject.mock.calls[0][1].category).toBe('institution-logos');
  });

  it('refuses a non-image before it is ever stored', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', asAdmin())
      .attach('file', Buffer.from('%PDF-'), { filename: 'x.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    // Rejected at the multer filter, so the bytes never reach the bucket.
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('says so plainly when no file was attached', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', asAdmin())
      .field('category', 'institution-logos');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });
});

describe('POST /api/uploads/file', () => {
  it('accepts a document type the image route would refuse', async () => {
    const res = await request(app)
      .post('/api/uploads/file')
      .set('Authorization', asAdmin())
      .field('category', 'update-attachments')
      .attach('file', Buffer.from('%PDF-'), { filename: 'form.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    // No `allowed` override is passed: the default document list is used, so the
    // two paths cannot drift apart.
    expect(storage.putObject.mock.calls[0][1].allowed).toBeUndefined();
  });
});
