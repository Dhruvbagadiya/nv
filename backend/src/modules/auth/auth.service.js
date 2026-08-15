import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../../utils/prisma.js';
import { config } from '../../config.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../utils/httpErrors.js';

// parentAgentId is included because the frontend needs it to decide whether to
// offer sub-agent management — only a top-level agent can have sub-agents.
const PUBLIC_USER_FIELDS = {
  id: true, name: true, email: true, role: true,
  isActive: true, phone: true, bio: true, avatarUrl: true,
  parentAgentId: true, createdAt: true,
};

// A hash of a value no password will ever produce. Used to spend comparable CPU
// on a missing-user login so response time doesn't leak whether an email exists.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.wsQBpQmvJTFTOxDvsFdmgtrLu5cKUJa';

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  });
}

// Opaque random string, not a JWT. Its only job is to match a stored hash, and
// staying opaque means a leaked refresh token discloses no claims.
const generateRefreshToken = () => crypto.randomBytes(48).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const refreshExpiry = () =>
  new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);

async function issueRefreshToken(userId, tx = prisma) {
  const token = generateRefreshToken();
  const row = await tx.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: refreshExpiry() },
  });
  return { token, expiresAt: row.expiresAt };
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same message and comparable work either way, so the response cannot be used
  // to enumerate which emails exist.
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  if (!user.isActive) {
    throw new UnauthorizedError('This account has been deactivated. Contact an administrator.');
  }

  const { token: refreshToken, expiresAt } = await issueRefreshToken(user.id);

  return {
    accessToken: signAccessToken(user),
    refreshToken, // the controller puts this in an httpOnly cookie, never the body
    refreshExpiresAt: expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      parentAgentId: user.parentAgentId,
    },
  };
}

// Exchange a refresh token for a new access token, rotating the refresh token as
// we go. Rotation matters: without it a stolen token is usable for its whole
// lifetime and there is no way to tell it was stolen.
export async function refresh(presentedToken) {
  if (!presentedToken) throw new UnauthorizedError('No refresh token provided');

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presentedToken) },
    include: { user: true },
  });

  if (!existing) throw new UnauthorizedError('Invalid refresh token');

  if (existing.revokedAt) {
    // Only a ROTATED token implies theft: it was already exchanged, so whoever
    // still holds it should not. Revoke every session for that user.
    if (existing.revokedReason === 'ROTATED') {
      await prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'REPLAY' },
      });
      throw new UnauthorizedError('Refresh token was already used — all sessions revoked');
    }

    // Anything else (a deliberate logout, or collateral from someone else's
    // replay) is mundane. Refusing this one request is the whole response —
    // logging out on your phone must not sign you out on your laptop, and a
    // stale tab retrying after logout is not an attack.
    throw new UnauthorizedError('Refresh token is no longer valid');
  }

  if (existing.expiresAt < new Date()) throw new UnauthorizedError('Refresh token expired');

  // Revoke-and-reissue atomically, so a crash between the two cannot leave the
  // user with no valid refresh token (logged out) or two (defeating rotation).
  const { token: nextToken, expiresAt } = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
    });
    return issueRefreshToken(existing.userId, tx);
  });

  return {
    accessToken: signAccessToken(existing.user),
    refreshToken: nextToken,
    refreshExpiresAt: expiresAt,
    user: {
      id: existing.user.id,
      name: existing.user.name,
      email: existing.user.email,
      role: existing.user.role,
      parentAgentId: existing.user.parentAgentId,
    },
  };
}

export async function logout(presentedToken) {
  if (!presentedToken) return;
  // updateMany, not update: logging out twice must not 404.
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
  });
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_FIELDS });
  // The token verified but the account is gone — treat as unauthenticated so the
  // client clears its session instead of retrying forever.
  if (!user) throw new UnauthorizedError('Account no longer exists');
  return user;
}

// PUBLIC self-registration for AGENTS.
export async function register({ name, email, password }) {
  return createUserWithRole({ name, email, password, role: 'AGENT' });
}

// PUBLIC self-registration for STUDENTS.
export async function registerStudent({ name, email, password }) {
  const user = await createUserWithRole({ name, email, password, role: 'STUDENT' });
  // Create a blank StudentProfile immediately so profile endpoints always find one.
  await prisma.studentProfile.create({ data: { id: crypto.randomUUID(), userId: user.id } });
  return user;
}

// PRIVILEGED. Callers must already be SUPER_ADMIN — enforced at the route.
export async function createUser({ name, email, password, role }) {
  return createUserWithRole({ name, email, password, role });
}

// Sub-agents: an agency creates logins for its own staff. Enforced one level deep
// — a sub-agent cannot create sub-agents of its own, because nothing in the UI or
// the application scoping models an arbitrary-depth tree, and silently allowing
// one would make "my applications" ambiguous.
export async function createSubAgent({ parentAgentId, name, email, password }) {
  const parent = await prisma.user.findUnique({
    where: { id: parentAgentId },
    select: { id: true, role: true, parentAgentId: true },
  });
  if (!parent) throw new UnauthorizedError('Account no longer exists');
  if (parent.parentAgentId) {
    throw new ForbiddenError('Sub-agents cannot create their own sub-agents');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('Email already in use');

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    // role is hard-coded, exactly as in public registration: a sub-agent is always
    // an AGENT, and this endpoint is reachable by agents.
    data: { name, email, passwordHash, role: 'AGENT', parentAgentId },
    select: PUBLIC_USER_FIELDS,
  });
}

export async function listSubAgents({ parentAgentId }) {
  return prisma.user.findMany({
    where: { parentAgentId },
    select: { ...PUBLIC_USER_FIELDS, _count: { select: { applications: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// Detach a sub-agent from the agency. Their account and applications are kept —
// they become an independent agent (parentAgentId = null).
export async function removeSubAgent({ parentAgentId, subAgentId }) {
  const sub = await prisma.user.findUnique({
    where: { id: subAgentId },
    select: { id: true, parentAgentId: true },
  });
  if (!sub) throw new NotFoundError('Sub-agent not found');
  if (sub.parentAgentId !== parentAgentId) {
    throw new ForbiddenError('That user is not a sub-agent of your agency');
  }
  return prisma.user.update({
    where: { id: subAgentId },
    data: { parentAgentId: null },
    select: PUBLIC_USER_FIELDS,
  });
}

// SUPER_ADMIN only — full user list for the admin panel.
export async function listAllUsers({ role, search, page = 1, pageSize = 25 } = {}) {
  const safePage     = Math.max(1, Math.trunc(Number(page)     || 1));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(Number(pageSize) || 25)));
  const where = {
    ...(role && { role }),
    ...(search && {
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  const skip = (safePage - 1) * safePageSize;
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...PUBLIC_USER_FIELDS,
        // `subAgents` is the relation name in the schema (User.subAgents)
        _count: { select: { applications: true, subAgents: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safePageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    items: items.map(({ _count, ...u }) => ({
      ...u,
      applicationCount: _count.applications,
      subAgentCount:    _count.subAgents,
    })),
    meta: {
      total,
      page:       safePage,
      pageSize:   safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    },
  };
}

async function createUserWithRole({ name, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('Email already in use');

  // 12 rounds rather than the previous 10 — still a few hundred ms, and the
  // hashes outlive the hardware they were made on.
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: { name, email, passwordHash, role },
    select: PUBLIC_USER_FIELDS,
  });
}

// ============================================================
// User management — ADMIN / SUPER_ADMIN only
// ============================================================

import { NotFoundError } from '../../utils/httpErrors.js';

/**
 * Full profile + activity breakdown for a single user.
 * Returns everything the admin user-detail panel needs in one call.
 */
export async function getUserDetail(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...PUBLIC_USER_FIELDS,
      updatedAt: true,
      parentAgent:  { select: { id: true, name: true, email: true } },
      subAgents:    { select: { id: true, name: true, email: true, isActive: true, createdAt: true } },
      // Active (non-revoked, non-expired) refresh tokens = active sessions
      refreshTokens: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          applications:    true,
          courseInquiries: true,
          subAgents:       true,
          refreshTokens:   { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
        },
      },
    },
  });

  if (!user) throw new NotFoundError('User not found');

  // Applications grouped by stage for the mini stat tiles
  const appsByStage = await prisma.application.groupBy({
    by: ['stage'],
    where: { agentId: id },
    _count: { _all: true },
  });

  // Last 10 applications for the activity feed
  const recentApplications = await prisma.application.findMany({
    where: { agentId: id },
    select: {
      id: true, reference: true, studentName: true, stage: true,
      stageNote: true, createdAt: true, updatedAt: true,
      course: {
        select: {
          title: true,
          institution: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Last 5 course inquiries
  const recentInquiries = await prisma.courseInquiry.findMany({
    where: { agentId: id },
    select: {
      id: true, nationality: true, stage: true, intake: true, courseType: true,
      createdAt: true,
      country: { select: { name: true, flagEmoji: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const { _count, refreshTokens, ...rest } = user;

  return {
    ...rest,
    activeSessions:      _count.refreshTokens,
    applicationCount:    _count.applications,
    inquiryCount:        _count.courseInquiries,
    subAgentCount:       _count.subAgents,
    sessions:            refreshTokens,
    applicationsByStage: Object.fromEntries(appsByStage.map((r) => [r.stage, r._count._all])),
    recentApplications,
    recentInquiries,
  };
}

/** Update a user's name and/or role. */
export async function updateUser(id, { name, role }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');

  return prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
    },
    select: PUBLIC_USER_FIELDS,
  });
}

/** Flip isActive. Deactivating also revokes every active session immediately. */
export async function setUserActive(id, isActive) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isActive } });
    if (!isActive) {
      // Revoke all sessions so the user is kicked out immediately, not just
      // blocked on next login.
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
      });
    }
  });

  return prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_FIELDS });
}

/** Revoke every active session for a user (force re-login everywhere). */
export async function revokeAllUserSessions(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');

  const { count } = await prisma.refreshToken.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
  });

  return { revokedCount: count };
}
