import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { config } from './config.js';
import { prisma } from './utils/prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/httpErrors.js';
import { createRateLimitStore } from './utils/rateLimitStore.js';

import authRoutes from './modules/auth/auth.routes.js';
import countryRoutes from './modules/countries/countries.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import institutionRoutes from './modules/institutions/institutions.routes.js';
import applicationRoutes from './modules/applications/applications.routes.js';
import courseInquiryRoutes from './modules/courseInquiries/courseInquiries.routes.js';
import moiRoutes from './modules/moiInstitutions/moiInstitutions.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import commissionRoutes from './modules/commissions/commissions.routes.js';
import entryRequirementRoutes from './modules/entryRequirements/entryRequirements.routes.js';
import importantUpdateRoutes from './modules/importantUpdates/importantUpdates.routes.js';
import documentRoutes from './modules/documents/documents.routes.js';
import uploadRoutes from './modules/uploads/uploads.routes.js';
import usefulInformationRoutes from './modules/usefulInformation/usefulInformation.routes.js';
import announcementRoutes from './modules/announcements/announcements.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import reportRoutes  from './modules/reports/reports.routes.js';
import studentRoutes from './modules/students/students.routes.js';
import agencyRoutes  from './modules/agency/agency.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';

const app = express();

// Needed for correct client IPs — and therefore correct rate limiting — once
// this sits behind nginx or a load balancer. 1 = trust exactly one proxy hop.
app.set('trust proxy', 1);

app.use(helmet());

// An explicit allow-list. The previous `origin: process.env.CORS_ORIGIN` became
// `origin: undefined` whenever the var was unset, which makes cors reflect
// whatever Origin the caller sent — with credentials:true that is exploitable.
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header at all = same-origin, curl, or server-to-server.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

// Unbounded bodies are a trivial memory-exhaustion vector.
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(cookieParser()); // reads the httpOnly refresh cookie
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// Credential stuffing had nothing standing in its way before. Scoped to the
// endpoints that actually verify a password: mounted on the whole /api/auth
// router it also counted /refresh, /me and the SUPER_ADMIN /users screen, so a
// couple of minutes of ordinary admin browsing spent the budget and then locked
// the user out of their own session — /refresh was throttled along with it.
//
// Top-level await: the store must exist before the limiter is constructed, and
// server.js imports this module before listening, so resolving it here means the
// API never serves a request with the wrong store attached.
const rateLimitStore = await createRateLimitStore();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
  ...(rateLimitStore ? { store: rateLimitStore } : {}),
});

// Liveness AND readiness: reporting "ok" while Postgres is unreachable is worse
// than reporting nothing, because orchestrators keep routing traffic to it.
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', env: config.env });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down', env: config.env });
  }
});

// Each module owns its routes + controller + service — this file only wires them.
// The limiter goes on the credential endpoints only; /register also covers
// /register/student, since app.use matches on path prefix.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// Reset endpoints are unauthenticated and touch credentials: without a limit,
// /forgot-password is a free email cannon at any address and /reset-password is
// a token oracle to brute-force.
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', authRoutes);
// The endpoint whose absence left every country dropdown in the app empty.
app.use('/api/countries', countryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/course-inquiries', courseInquiryRoutes);
app.use('/api/moi-institutions', moiRoutes);
app.use('/api/notifications', notificationRoutes);

// Reference data behind the screens from the design set: Universities Commission,
// UG/PG Entry Requirements, Important Updates, the five Document Bank categories,
// the global banners, Help & Support, and the Report dashboard.
app.use('/api/commissions', commissionRoutes);
app.use('/api/entry-requirements', entryRequirementRoutes);
app.use('/api/important-updates', importantUpdateRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/useful-information', usefulInformationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/support-contacts', supportRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/agency',   agencyRoutes);
app.use('/api/profile',  profileRoutes);

// Serve locally-uploaded files (logos, avatars, documents) when S3 is not configured.
// /uploads/<type>/<uuid>.ext  →  backend/uploads/<type>/<uuid>.ext
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

// Unknown /api/* used to fall through to Express's default HTML 404, which a
// JSON client cannot parse. Must stay above errorHandler.
app.use('/api', (req, _res, next) => {
  next(new NotFoundError(`No such endpoint: ${req.method} ${req.baseUrl}${req.path}`));
});

app.use(errorHandler);

export default app;
