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
  const { accessToken, refreshToken, refreshExpiresAt, user } = await authService.login(
    email,
    password
  );
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.json({ accessToken, user });
}

export async function refreshHandler(req, res) {
  const presented = req.cookies?.[config.cookie.refreshName];
  const { accessToken, refreshToken, refreshExpiresAt, user } =
    await authService.refresh(presented);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  res.json({ accessToken, user });
}

export async function logoutHandler(req, res) {
  await authService.logout(req.cookies?.[config.cookie.refreshName]);
  clearRefreshCookie(res);
  res.status(204).send();
}

// Lets the frontend rebuild its session on a page refresh instead of guessing.
// Without it, `user` was null after every reload while the app still believed it
// was authenticated — which is what silently disabled the admin route guard.
export async function meHandler(req, res) {
  res.json({ user: await authService.getUserById(req.user.sub) });
}

// Public. Always creates an AGENT; the schema rejects a `role` in the body.
export async function registerHandler(req, res) {
  res.status(201).json(await authService.register(req.body));
}

// SUPER_ADMIN only — see auth.routes.js.
export async function createUserHandler(req, res) {
  res.status(201).json(await authService.createUser(req.body));
}
