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
  updateUserBody,
  idParam,
  forgotPasswordBody,
  resetPasswordBody,
  listUsersQuery,
  adminResetPasswordBody,
  setUserActiveBody,
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
  removeSubAgentHandler,
  listAllUsersHandler,
  getUserDetailHandler,
  updateUserHandler,
  setUserActiveHandler,
  revokeUserSessionsHandler,
  adminResetPasswordHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
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

// Self-service password reset. Both are public by necessity — the user cannot
// authenticate, that being the problem. app.js rate-limits /login and /register;
// these two are added to that list there for the same reason.
router.post('/forgot-password', validate(forgotPasswordBody), asyncHandler(forgotPasswordHandler));
router.post('/reset-password',  validate(resetPasswordBody),  asyncHandler(resetPasswordHandler));

// Authenticated by the httpOnly cookie rather than the (expired) access token,
// which is the whole point — this is what the client calls when the access token
// has run out.
router.post('/refresh', asyncHandler(refreshHandler));
router.post('/logout', asyncHandler(logoutHandler));

// ---- authenticated ----
router.get('/me', requireAuth, asyncHandler(meHandler));

// ---- sub-agents: an agency managing its own staff ----
router.get('/sub-agents', requireAuth, requireRole('AGENT'), asyncHandler(listSubAgentsHandler));
router.post('/sub-agents', requireAuth, requireRole('AGENT'), validate(createSubAgentBody), asyncHandler(createSubAgentHandler));
// Remove a sub-agent — detaches them from the agency (sets parentAgentId null).
// The sub-agent's own applications and account are preserved.
router.delete('/sub-agents/:id', requireAuth, requireRole('AGENT'), validate(idParam, 'params'), asyncHandler(removeSubAgentHandler));

// ---- privileged: creating a user with an explicit role ----
router.post('/users', requireAuth, requireRole('SUPER_ADMIN'), validate(createUserSchema), asyncHandler(createUserHandler));

// SUPER_ADMIN only — full user list for the admin panel.
router.get('/users', requireAuth, requireRole('SUPER_ADMIN'), validate(listUsersQuery, 'query'), asyncHandler(listAllUsersHandler));

// User management — SUPER_ADMIN, matching POST/GET /users above.
//
// These were ADMIN-or-SUPER_ADMIN while the list beside them was SUPER_ADMIN
// only, which is not a workable split: an ADMIN could not see the user list but
// could still write to any record whose id they knew. With `role` unvalidated on
// the update, that meant an ADMIN could PUT themselves to SUPER_ADMIN, or reset
// a SUPER_ADMIN's password and take the account. The admin UI gates the whole
// Users screen to SUPER_ADMIN already, so nothing was relying on ADMIN reaching
// these.
const superAdminAuth = [requireAuth, requireRole('SUPER_ADMIN')];
router.get('/users/:id',                  ...superAdminAuth, validate(idParam, 'params'), asyncHandler(getUserDetailHandler));
router.put('/users/:id',                  ...superAdminAuth, validate(idParam, 'params'), validate(updateUserBody), asyncHandler(updateUserHandler));
router.patch('/users/:id/active',         ...superAdminAuth, validate(idParam, 'params'), validate(setUserActiveBody), asyncHandler(setUserActiveHandler));
router.post('/users/:id/revoke-sessions', ...superAdminAuth, validate(idParam, 'params'), asyncHandler(revokeUserSessionsHandler));
router.post('/users/:id/reset-password',  ...superAdminAuth, validate(idParam, 'params'), validate(adminResetPasswordBody), asyncHandler(adminResetPasswordHandler));

export default router;
