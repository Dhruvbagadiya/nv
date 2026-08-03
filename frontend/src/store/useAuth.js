import { create } from 'zustand';

// The access token lives in memory only — deliberately not in localStorage.
// Previously it was persisted, which put a bearer token within reach of any XSS
// on the page; and because only the token was persisted and never the user, a
// page refresh left the app "authenticated" with `user === null`, which silently
// disabled the admin route guard. See ProtectedRoute.jsx.
//
// Session continuity across reloads now comes from the httpOnly refresh cookie
// instead: bootstrap() calls POST /auth/refresh, which no script can read or forge.

export const useAuth = create((set, get) => ({
  user: null,
  accessToken: null,

  // Three states, not two. A boolean cannot express "we don't know yet", and
  // treating unknown as authenticated is exactly how the guard failed open.
  // Consumers must wait for status !== 'loading'.
  status: 'loading', // 'loading' | 'authenticated' | 'anonymous'

  isAuthenticated: () => get().status === 'authenticated',

  setSession: ({ user, accessToken }) => set({ user, accessToken, status: 'authenticated' }),

  setAnonymous: () => set({ user: null, accessToken: null, status: 'anonymous' }),

  // Called once on app mount. A 401 here is the ordinary "not logged in" path,
  // not an error worth surfacing.
  bootstrap: async () => {
    const { refresh } = await import('../api/auth.js');
    try {
      const { accessToken, user } = await refresh();
      set({ user, accessToken, status: 'authenticated' });
    } catch {
      set({ user: null, accessToken: null, status: 'anonymous' });
    }
  },

  logout: async () => {
    const { logout: logoutRequest } = await import('../api/auth.js');
    try {
      await logoutRequest(); // revokes the refresh token server-side
    } catch {
      // Drop local state even if the server call fails — the user asked to leave.
    }
    set({ user: null, accessToken: null, status: 'anonymous' });
  },
}));

// Read/write helpers for the axios interceptor, which needs the token outside
// React's render cycle and must not subscribe to the store.
export const getAccessToken = () => useAuth.getState().accessToken;
export const setAccessToken = (accessToken) => useAuth.setState({ accessToken });
