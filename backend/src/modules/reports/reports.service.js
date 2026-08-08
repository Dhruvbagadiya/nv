import { prisma } from '../../utils/prisma.js';
import * as applicationsService from '../applications/applications.service.js';
import * as inquiriesService from '../courseInquiries/courseInquiries.service.js';
import * as institutionsService from '../institutions/institutions.service.js';

const APPLICATION_STAGES = [
  'PROFILE_ASSESSMENT',
  'APPLICATION',
  'CONDITIONAL_OFFER',
  'UNCONDITIONAL_OFFER',
  'FEES_PAYMENT',
  'CAS_LETTER',
  'VISA_APPLICATION',
  'VISA_APPROVAL',
];

const INQUIRY_STAGES = ['INQUIRY', 'PENDING', 'OFFERED', 'APPLIED'];

// groupBy omits stages with no rows, but a dashboard tile showing nothing is
// worse than one showing 0 — the reference screenshots show explicit zeros.
const withZeros = (counts, keys) => Object.fromEntries(keys.map((k) => [k, counts[k] ?? 0]));

// One endpoint for the whole Report screen (images 19-20) rather than six.
// It is a dashboard: every panel is needed at once, and six round trips would
// each pay their own latency and auth cost for no benefit.
export async function getReportSummary({ agentId, userId }) {
  const [applicationCounts, inquiryCounts, trending, deadlines, usefulInformation, recentNotifications] =
    await Promise.all([
      applicationsService.countByStage({ agentId }),
      inquiriesService.countByStage({ agentId }),
      institutionsService.listTrending({ limit: 12 }),
      applicationsService.listUpcomingDeadlines({ agentId, limit: 5 }),
      prisma.usefulInformation.findMany({
        where: { archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }],
        take: 5,
      }),
      prisma.notification.findMany({
        where: { userId },
        include: {
          application: {
            select: {
              id: true,
              reference: true,
              intakeLabel: true,
              course: { select: { institution: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

  return {
    applications: withZeros(applicationCounts, APPLICATION_STAGES),
    courseInquiries: withZeros(inquiryCounts, INQUIRY_STAGES),
    trending,
    deadlines,
    usefulInformation,
    recentNotifications,
  };
}

// Admin dashboard stat cards — one count query per entity.
export async function getAdminStats() {
  const [institutions, courses, users, applications, activeBanners, documents] = await Promise.all([
    prisma.institution.count({ where: { archivedAt: null } }),
    prisma.course.count({ where: { archivedAt: null } }),
    prisma.user.count(),
    prisma.application.count(),
    prisma.announcement.count({ where: { isActive: true } }),
    prisma.document.count({ where: { archivedAt: null } }),
  ]);
  return { institutions, courses, users, applications, activeBanners, documents };
}
