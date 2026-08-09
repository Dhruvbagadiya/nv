import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  loginSchema,
  registerSchema,
  createUserSchema,
  createSubAgentBody,
} from './auth.schemas.js';
import {
  loginHandler,
  registerHandler,
  registerStudentHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  createUserHandler,
  createSubAgentHandler,
  listSubAgentsHandler,
  listAllUsersHandler,
} from './auth.controller.js';

const router = Router();

// ---- public ----
router.post('/login', validate(loginSchema), asyncHandler(loginHandler));

// Self-registration only ever produces an AGENT: registerSchema is .strict() and
// has no `role` field, so a body carrying one is rejected with a 400 rather than
// silently downgraded. This endpoint previously accepted any role, unauthenticated.
router.post('/register', validate(registerSchema), asyncHandler(registerHandler));
// Student self-registration — same fields, role hard-coded to STUDENT.
router.post('/register/student', validate(registerSchema), asyncHandler(registerStudentHandler));

// Authenticated by the httpOnly cookie rather than the (expired) access token,
// which is the whole point — this is what the client calls when the access token
// has run out.
router.post('/refresh', asyncHandler(refreshHandler));
router.post('/logout', asyncHandler(logoutHandler));

// ---- authenticated ----
router.get('/me', requireAuth, asyncHandler(meHandler));

// ---- sub-agents: an agency managing its own staff ----
// Any authenticated agent may do this for themselves; the service refuses if the
// caller is itself a sub-agent, keeping the hierarchy one level deep.
router.get('/sub-agents', requireAuth, requireRole('AGENT'), asyncHandler(listSubAgentsHandler));
router.post(
  '/sub-agents',
  requireAuth,
  requireRole('AGENT'),
  validate(createSubAgentBody),
  asyncHandler(createSubAgentHandler)
);

// ---- privileged: creating a user with an explicit role ----
router.post(
  '/users',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validate(createUserSchema),
  asyncHandler(createUserHandler)
);

// SUPER_ADMIN only — full user list for the admin panel.
router.get(
  '/users',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  asyncHandler(listAllUsersHandler)
);

export default router;
