import axios from 'axios';
import { getAccessToken, getCurrentUserId, useAuth } from '../store/useAuth.js';

export const api = axios.create({
  baseURL: '/api',
  // Required for the httpOnly refresh cookie to be sent on /auth/refresh.
  withCredentials: true,
});

// A bare client with no interceptors, used only to call /auth/refresh. Reusing
// `api` here would recurse: a failing refresh returns 401, which would trigger
// the interceptor, which would call refresh again.
const refreshClient = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Drop params with no value before they reach the wire. An unset filter is
  // absent, not empty: a screen holding { countryId: '', stage: '' } in its filter
  // state would otherwise send `?countryId=&stage=`, and the API's zod schemas
  // validate a present-but-empty value rather than skipping it.
  //
  // The API tolerates empty values too (see utils/queryTypes.js) — this is the
  // other half, and it also keeps the URLs readable.
  if (config.params) {
    config.params = Object.fromEntries(
      Object.entries(config.params).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined
      )
    );
  }
  return config;
});

// One shared in-flight refresh. Without this, a page that fires six queries at
// once (the Dashboard does) would send six refresh calls the moment the access
// token expires — and because refresh tokens rotate, five of them would present
// an already-rotated token, which the server correctly treats as a replay and
// answers by revoking every session. The user gets logged out by their own app.
let refreshPromise = null;

function refreshSession() {
  refreshPromise ??= refreshClient
    .post('/auth/refresh')
    .then(({ data }) => {
      const prevUserId = getCurrentUserId();
      useAuth.getState().setSession({
        user:          data.user,
        accessToken:   data.accessToken,
        agencyProfile: data.agencyProfile ?? null,
      });
      if (prevUserId && prevUserId !== data.user.id && import.meta.env.DEV) {
        console.warn('[auth] Refresh returned a different user — cache cleared.');
      }
      return data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (response?.status !== 401 || !config) return Promise.reject(error);

    // Never try to refresh a failed auth call — a bad password is not a stale
    // token, and retrying it would just burn the rate limit.
    if (config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // Retry each request at most once, so a persistently-401 endpoint cannot
    // spin forever.
    if (config._retried) {
      useAuth.getState().setAnonymous();
      return Promise.reject(error);
    }
    config._retried = true;

    try {
      const token = await refreshSession();
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    } catch (refreshError) {
      // Refresh itself failed — the session is genuinely over. Clear state and
      // let ProtectedRoute redirect through the router, rather than the previous
      // `window.location.href = '/login'`, which forced a full page reload and
      // discarded any unsaved form the user was in the middle of.
      useAuth.getState().setAnonymous();
      return Promise.reject(refreshError);
    }
  }
);
