import { create } from 'zustand';
import { applyTheme, resetTheme } from '../hooks/useTheme.js';

let _queryClient = null;

function clearQueryCache() {
  if (_queryClient) _queryClient.clear();
}

export const useAuth = create((set, get) => ({
  user:          null,
  accessToken:   null,
  agencyProfile: null,   // { id, agencyName, logoUrl, website } | null
  status:        'loading', // 'loading' | 'authenticated' | 'anonymous'

  isAuthenticated: () => get().status === 'authenticated',

  setQueryClient: (qc) => { _queryClient = qc; },

  // Full session set — clears stale cache from previous user first.
  setSession: ({ user, accessToken, agencyProfile = null }) => {
    clearQueryCache();
    // Apply accent theme immediately so the UI reflects the agency color
    // before the first render settles — no flash of default orange.
    applyTheme(agencyProfile?.accentColor ?? null);
    set({ user, accessToken, agencyProfile, status: 'authenticated' });
  },

  // Update branding only (after settings page saves) and re-apply the theme.
  setAgencyProfile: (agencyProfile) => {
    applyTheme(agencyProfile?.accentColor ?? null);
    set({ agencyProfile });
  },

  // Patch the in-memory user after a profile save (name, avatarUrl, etc).
  patchUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),

  setAnonymous: () => {
    clearQueryCache();
    resetTheme();  // remove any per-agency overrides when logging out
    set({ user: null, accessToken: null, agencyProfile: null, status: 'anonymous' });
  },

  bootstrap: async () => {
    const { refresh } = await import('../api/auth.js');
    try {
      const { accessToken, user, agencyProfile } = await refresh();
      // Apply theme before state update so ProtectedRoute renders already themed.
      applyTheme(agencyProfile?.accentColor ?? null);
      set({ user, accessToken, agencyProfile: agencyProfile ?? null, status: 'authenticated' });
    } catch {
      resetTheme();
      set({ user: null, accessToken: null, agencyProfile: null, status: 'anonymous' });
    }
  },

  logout: async () => {
    const { logout: logoutRequest } = await import('../api/auth.js');
    try { await logoutRequest(); } catch { /* always clear local state */ }
    clearQueryCache();
    resetTheme();
    set({ user: null, accessToken: null, agencyProfile: null, status: 'anonymous' });
  },
}));

export const getAccessToken   = ()      => useAuth.getState().accessToken;
export const setAccessToken   = (token) => useAuth.setState({ accessToken: token });
export const getCurrentUserId = ()      => useAuth.getState().user?.id ?? null;
