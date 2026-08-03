import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { prisma } from './utils/prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/httpErrors.js';

import authRoutes from './modules/auth/auth.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import institutionRoutes from './modules/institutions/institutions.routes.js';
import applicationRoutes from './modules/applications/applications.routes.js';
import courseInquiryRoutes from './modules/courseInquiries/courseInquiries.routes.js';
import moiRoutes from './modules/moiInstitutions/moiInstitutions.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';

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

// Credential stuffing had nothing standing in its way before. Deliberately
// narrow — auth routes only — so ordinary browsing is never throttled.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/course-inquiries', courseInquiryRoutes);
app.use('/api/moi-institutions', moiRoutes);
app.use('/api/notifications', notificationRoutes);

// Unknown /api/* used to fall through to Express's default HTML 404, which a
// JSON client cannot parse. Must stay above errorHandler.
app.use('/api', (req, _res, next) => {
  next(new NotFoundError(`No such endpoint: ${req.method} ${req.baseUrl}${req.path}`));
});

app.use(errorHandler);

export default app;
