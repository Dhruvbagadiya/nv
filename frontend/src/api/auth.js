import axios from 'axios';
// The shared client, for the one call here that needs a session.
import { api } from './client.js';

// login/refresh/logout use a plain client rather than `api`, because `api`'s
// response interceptor treats a 401 as "refresh and retry" — which is wrong for
// these three: a bad password is not a stale token, and refreshing a failed
// refresh would recurse.
const authClient = axios.create({ baseURL: '/api', withCredentials: true });

export async function login(email, password) {
  const { data } = await authClient.post('/auth/login', { email, password });
  return data; // { accessToken, user } — the refresh token is an httpOnly cookie
}

export async function refresh() {
  const { data } = await authClient.post('/auth/refresh');
  return data; // { accessToken, user }
}

export async function logout() {
  await authClient.post('/auth/logout');
}

export async function register(payload) {
  const { data } = await authClient.post('/auth/register', payload);
  return data;
}


// Password reset. Both use authClient for the same reason login does: a 401 or
// 400 here is a real answer, not a stale access token to refresh and retry.
export async function forgotPassword(email) {
  const { data } = await authClient.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token, newPassword) {
  const { data } = await authClient.post('/auth/reset-password', { token, newPassword });
  return data;
}

/*
 * Email confirmation.
 *
 * verifyEmail uses authClient for the same reason the reset pair does: it is
 * called by someone arriving from an inbox who may have no session at all, and a
 * 400 here is a real answer — "this link is spent" — not a stale access token
 * worth refreshing and retrying.
 *
 * resendVerification uses the ordinary `api` client, because it is only callable
 * with a session and a 401 there genuinely should trigger the refresh-and-retry.
 */
export async function verifyEmail(token) {
  const { data } = await authClient.post('/auth/verify-email', { token });
  return data;
}

export async function resendVerification() {
  const { data } = await api.post('/auth/resend-verification');
  return data;
}
