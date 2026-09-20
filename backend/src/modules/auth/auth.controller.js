import * as authService from './auth.service.js';
import { config } from '../../config.js';

// The refresh token travels in an httpOnly cookie, not the JSON body. In the body
// it had to be stored somewhere reachable by JavaScript, which put a 7-day
// credential within reach of any XSS on the page. httpOnly takes it out of
// script's hands entirely.
function setRefreshCookie(res, token, expiresAt) {
  res.cookie(config.cookie.refreshName, token, {
    httpOnly: true,
    sameSite: 'strict', // this API is only called by its own frontend
    secure: config.isProduction, // no HTTPS on localhost, required everywhere else
    domain: config.cookie.domain,
    expires: expiresAt,
    path: '/api/auth', // never sent to any other endpoint
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(config.cookie.refreshName, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    domain: config.cookie.domain,
    path: '/api/auth',
  });
}

export async function loginHandler(req, res) {
  const { email, password } = req.body;
  const { accessToken, refreshToken, refreshExpiresAt, user } = await authService.login(email, password);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  const { getAgencyProfileForUser } = await import('../agency/agency.service.js');
  const agencyProfile = await getAgencyProfileForUser(user.id);
  res.json({ accessToken, user, agencyProfile });
}

export async function refreshHandler(req, res) {
  const presented = req.cookies?.[config.cookie.refreshName];
  const { accessToken, refreshToken, refreshExpiresAt, user } = await authService.refresh(presented);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  const { getAgencyProfileForUser } = await import('../agency/agency.service.js');
  const agencyProfile = await getAgencyProfileForUser(user.id);
  res.json({ accessToken, user, agencyProfile });
}

export async function logoutHandler(req, res) {
  await authService.logout(req.cookies?.[config.cookie.refreshName]);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function meHandler(req, res) {
  const user = await authService.getUserById(req.user.sub);
  // Resolve the agency profile so the client doesn't need a second request
  // on every page load.
  const { getAgencyProfileForUser } = await import('../agency/agency.service.js');
  const agencyProfile = await getAgencyProfileForUser(req.user.sub);
  res.json({ user, agencyProfile });
}

// Public: the link arrives by email and is clicked by someone who is, by
// definition, not yet signed in.
export async function verifyEmailHandler(req, res) {
  const result = await authService.verifyEmail(req.body.token);
  res.json({ verified: true, ...result });
}

/*
 * Requires a session on purpose. An unauthenticated "resend to this address"
 * endpoint is both an account-enumeration oracle and a way to have this server
 * mail anyone repeatedly; taking the address from the token instead means a
 * caller can only ever trigger mail to themselves.
 */
export async function resendVerificationHandler(req, res) {
  await authService.sendEmailVerification(req.user.sub);
  // Same answer whether or not anything was sent — the account may already be
  // verified, and that is not worth a different response.
  res.json({ sent: true });
}

// Public. Always creates an AGENT; the schema rejects a `role` in the body.
export async function registerHandler(req, res) {
  res.status(201).json(await authService.register(req.body));
}

// Public student self-registration — always creates a STUDENT.
export async function registerStudentHandler(req, res) {
  res.status(201).json(await authService.registerStudent(req.body));
}

// SUPER_ADMIN only — see auth.routes.js.
export async function createUserHandler(req, res) {
  res.status(201).json(await authService.createUser(req.body));
}

// Sub-agent management. parentAgentId always comes from the token, never the body —
// otherwise an agent could graft staff onto someone else's agency.
export async function createSubAgentHandler(req, res) {
  res.status(201).json(
    await authService.createSubAgent({ parentAgentId: req.user.sub, ...req.body })
  );
}

export async function listSubAgentsHandler(req, res) {
  const items = await authService.listSubAgents({ parentAgentId: req.user.sub });
  res.json({
    items: items.map(({ _count, ...u }) => ({ ...u, applicationCount: _count.applications })),
  });
}

export async function removeSubAgentHandler(req, res) {
  await authService.removeSubAgent({
    parentAgentId: req.user.sub,
    subAgentId:    req.params.id,
  });
  res.status(204).send();
}

export async function listAllUsersHandler(req, res) {
  res.json(await authService.listAllUsers(req.query));
}

export async function getUserDetailHandler(req, res) {
  res.json(await authService.getUserDetail(req.params.id));
}

export async function updateUserHandler(req, res) {
  res.json(await authService.updateUser(req.params.id, req.body, req.user.sub));
}

export async function setUserActiveHandler(req, res) {
  // Validated by setUserActiveBody on the route; the actor is passed so the
  // service can refuse a self-deactivation or the removal of the last admin.
  res.json(await authService.setUserActive(req.params.id, req.body.isActive, req.user.sub));
}

export async function revokeUserSessionsHandler(req, res) {
  res.json(await authService.revokeAllUserSessions(req.params.id));
}

export async function adminResetPasswordHandler(req, res) {
  // Length and type are enforced by adminResetPasswordBody on the route.
  res.json(await authService.adminResetPassword(req.params.id, req.body.newPassword));
}

// Always 200, and always the same body. Whether the address is registered is
// exactly the fact this endpoint must not disclose.
export async function forgotPasswordHandler(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({
    message: 'If that email is registered, a reset link is on its way.',
  });
}

export async function resetPasswordHandler(req, res) {
  res.json(await authService.resetPassword(req.body.token, req.body.newPassword));
}
