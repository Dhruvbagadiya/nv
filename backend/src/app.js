import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import institutionRoutes from './modules/institutions/institutions.routes.js';
import applicationRoutes from './modules/applications/applications.routes.js';
import courseInquiryRoutes from './modules/courseInquiries/courseInquiries.routes.js';
import moiRoutes from './modules/moiInstitutions/moiInstitutions.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Each module owns its own routes + controller + service —
// this file only wires them onto the API surface.
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/course-inquiries', courseInquiryRoutes);
app.use('/api/moi-institutions', moiRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

export default app;
