import crypto from 'node:crypto';
import { prisma } from '../../utils/prisma.js';
import { NotFoundError, ForbiddenError } from '../../utils/httpErrors.js';
import { paginateQuery } from '../../utils/pagination.js';
import { assertNotDuplicate } from '../applications/duplicateGuard.js';

const PROFILE_SELECT = {
  id: true, userId: true, nationality: true,
  dateOfBirth: true, passportNo: true, phone: true, address: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
};

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: PROFILE_SELECT,
  });
  if (!profile) throw new NotFoundError('Student profile not found');
  return profile;
}

export async function upsertProfile(userId, data) {
  return prisma.studentProfile.upsert({
    where:  { userId },
    update: { ...data, updatedAt: new Date() },
    create: { id: crypto.randomUUID(), userId, ...data },
    select: PROFILE_SELECT,
  });
}

// ── Applications (student's own) ────────────────────────────────────────────

const APPLICATION_INCLUDE = {
  course: {
    include: {
      institution: {
        include: {
          country: { select: { code: true, name: true, flagEmoji: true, currencyCode: true, isoCode: true } },
        },
      },
      intakes: { orderBy: { startDate: 'asc' } },
    },
  },
};

export async function listStudentApplications({ studentId, stage, page, pageSize }) {
  return paginateQuery(
    prisma.application,
    {
      where: {
        agentId: studentId,
        ...(stage && { stage }),
      },
      include: APPLICATION_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    },
    { page, pageSize }
  );
}

export async function createStudentApplication({ studentId, courseId, intakeLabel, studentName, passportNo }) {
  /*
   * The gate. Browsing programs needs no proof of anything, but filing an
   * application does: these go to real partner institutions under NV's name, and
   * an agency's relationship with those institutions is the asset that a stream
   * of applications from unreachable addresses damages.
   *
   * Checked HERE rather than only by disabling the button. The button is a
   * courtesy; this route takes a JSON body and is the thing that actually has to
   * refuse.
   */
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { emailVerifiedAt: true },
  });
  if (!student?.emailVerifiedAt) {
    throw new ForbiddenError(
      'Confirm your email address before submitting an application. '
      + 'Check your inbox for the confirmation link, or request a new one from your profile.'
    );
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, archivedAt: null },
    select: { id: true },
  });
  if (!course) throw new NotFoundError('Course not available');

  // One application per student per course. byAccount, because a student IS the
  // account — see the note in duplicateGuard.js.
  await assertNotDuplicate({ agentId: studentId, courseId, byAccount: true });

  return prisma.application.create({
    data: {
      agentId:     studentId,  // students own their own applications
      studentName,
      passportNo,
      courseId,
      intakeLabel,
      stageNote:   'Application received',
    },
    include: APPLICATION_INCLUDE,
  });
}

export async function getStudentApplication({ id, studentId }) {
  const app = await prisma.application.findFirst({
    where: { id, agentId: studentId },
    include: APPLICATION_INCLUDE,
  });
  if (!app) throw new NotFoundError('Application not found');
  return app;
}
