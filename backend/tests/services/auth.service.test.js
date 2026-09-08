import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/auth/auth.service.js');

const SUPER = { id: 'u-super', role: 'SUPER_ADMIN', isActive: true, name: 'Root' };
const AGENT = { id: 'u-agent', role: 'AGENT', isActive: true, name: 'Agent' };

beforeEach(() => {
  resetPrismaMock();
  prismaMock.user.update.mockResolvedValue(SUPER);
});

// None of these had any guard. A Super Admin could demote themselves, or
// deactivate the last remaining Super Admin, and the only way back was editing
// the database by hand.
describe('protecting administrative access', () => {
  it('refuses to let a Super Admin change their own role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(SUPER);

    await expect(service.updateUser('u-super', { role: 'AGENT' }, 'u-super'))
      .rejects.toMatchObject({ status: 400 });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('refuses to let a Super Admin deactivate themselves', async () => {
    prismaMock.user.findUnique.mockResolvedValue(SUPER);

    await expect(service.setUserActive('u-super', false, 'u-super'))
      .rejects.toMatchObject({ status: 400 });
  });

  it('refuses to demote the last active Super Admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...SUPER, id: 'u-other' });
    prismaMock.user.count.mockResolvedValue(0); // nobody else holds the role

    await expect(service.updateUser('u-other', { role: 'ADMIN' }, 'u-super'))
      .rejects.toMatchObject({ status: 409 });
  });

  it('refuses to deactivate the last active Super Admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...SUPER, id: 'u-other' });
    prismaMock.user.count.mockResolvedValue(0);

    await expect(service.setUserActive('u-other', false, 'u-super'))
      .rejects.toMatchObject({ status: 409 });
  });

  it('allows the demotion when another Super Admin remains', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...SUPER, id: 'u-other' });
    prismaMock.user.count.mockResolvedValue(1);

    await service.updateUser('u-other', { role: 'ADMIN' }, 'u-super');
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  // The guard is about administrative access, so it must not obstruct ordinary
  // user management.
  it('does not interfere with editing a non-admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue(AGENT);

    await service.updateUser('u-agent', { name: 'Renamed' }, 'u-super');
    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });

  it('lets a Super Admin rename themselves', async () => {
    prismaMock.user.findUnique.mockResolvedValue(SUPER);

    await service.updateUser('u-super', { name: 'New Name' }, 'u-super');
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});
