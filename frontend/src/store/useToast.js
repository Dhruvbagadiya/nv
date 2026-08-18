import { create } from 'zustand';

// Success and error feedback was inline and per-page, in five different styles
// (.profile-saved-msg, .form-error, .login-error, .student-auth-error,
// .admin-login-error), and several mutations had no success channel at all.
//
// The worst of it: AdminUsers stored its status as a string prefixed with a "✓"
// character and then called actionMsg.startsWith('✓') to decide what colour to
// render — an emoji doing the job of a state variable. Tone is an argument here,
// not something parsed back out of the message text.
//
// Built on zustand to match the existing useAuth/useCountryFilter stores; no new
// dependency, and it can be called from mutation callbacks that have no
// component in scope.

let nextId = 0;
const DEFAULT_TTL = 4000;

export const useToast = create((set, get) => ({
  toasts: [],

  push: (tone, message, ttl = DEFAULT_TTL) => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    // Errors stay until dismissed. A success is a confirmation you can miss
    // safely; a failure is something you may need to read twice and act on.
    if (tone !== 'error' && ttl > 0) {
      setTimeout(() => get().dismiss(id), ttl);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// Call these from anywhere, including outside React.
export const toast = {
  success: (message, ttl) => useToast.getState().push('success', message, ttl),
  error: (message, ttl) => useToast.getState().push('error', message, ttl),
  info: (message, ttl) => useToast.getState().push('info', message, ttl),
};
