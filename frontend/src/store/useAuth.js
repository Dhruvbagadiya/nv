import { create } from 'zustand';

// NOTE on security: storing the access token in localStorage is simple
// and matches what api/client.js already reads, but it's readable by
// any script on the page (XSS risk). Before shipping to production,
// the stronger pattern is: access token in memory only (this store,
// no persistence), refresh token in an httpOnly cookie set by the
// backend — which means updating POST /auth/login on the server to
// set that cookie instead of returning refreshToken in the JSON body.
// Flagging it here rather than silently leaving it as a surprise later.

const STORAGE_KEY = 'accessToken';

export const useAuth = create((set) => ({
  user: null,
  accessToken: localStorage.getItem(STORAGE_KEY) || null,
  isAuthenticated: !!localStorage.getItem(STORAGE_KEY),

  setSession: ({ user, accessToken }) => {
    localStorage.setItem(STORAGE_KEY, accessToken);
    set({ user, accessToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
