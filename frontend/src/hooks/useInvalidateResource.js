import { useQueryClient } from '@tanstack/react-query';

/**
 * Which caches go stale when a resource changes.
 *
 * Saving used to refetch only the list you were looking at. Everything else
 * derived from the same rows kept its cached copy — and the reference lists are
 * held for 30 minutes (`REFERENCE_QUERY` in useReferenceData.js) — so adding an
 * institution left it missing from every other screen's picker until the page
 * was reloaded by hand. That is the "I have to refresh every time" report.
 *
 * The fix is not another invalidate call at each site; it is one place that says
 * what depends on what. Add the derived key here and every screen that mutates
 * the resource picks it up.
 *
 * Keys are matched by prefix, so ['institutions'] also clears
 * ['institutions', { country: 'UK' }] and the other filter variants.
 */
export const RELATED_KEYS = {
  // Admin list, the shared dropdown cache, the course lists that embed an
  // institution name, and the MOI screens keyed off institutions.
  institutions: [
    ['admin-institutions'], ['institutions'],
    ['admin-courses'], ['courses'], ['course'],
    ['moi-institutions'], ['document-facets'], ['admin-stats'],
  ],
  countries: [['admin-countries'], ['countries'], ['admin-stats']],
  courses: [['admin-courses'], ['courses'], ['course'], ['admin-stats']],
  documents: [
    ['admin-documents'], ['documents'],
    // The Document Bank filters are built from what exists, so a newly scoped
    // document has to re-derive them or its filter never appears.
    ['document-facets'], ['admin-stats'],
  ],
  users: [['admin-users'], ['admin-user-detail'], ['admin-stats']],
  // Commission is read onto agent-facing program cards, not just its own screen.
  commissions: [['commissions'], ['courses'], ['course']],
  'entry-requirements': [['entry-requirements']],
  'important-updates': [['important-updates']],
  'support-contacts': [['support-contacts']],
  announcements: [['announcements']],
  'moi-institutions': [['moi-institutions'], ['moi-course-types']],
  'course-inquiries': [['course-inquiries']],

  // The config-driven screens pass their own queryKey straight through, so the
  // admin key is what arrives here. Each also clears the agent-facing cache that
  // reads the same rows.
  'admin-commissions': [['admin-commissions'], ['commissions'], ['courses'], ['course']],
  'admin-support-contacts': [['admin-support-contacts'], ['support-contacts']],
  'admin-important-updates': [['admin-important-updates'], ['important-updates']],
  'admin-moi': [['admin-moi'], ['moi-institutions'], ['moi-course-types']],
  'admin-announcements': [['admin-announcements'], ['announcements']],
};

/**
 * Invalidate a resource and everything derived from it.
 *
 * An unmapped resource still clears its own key, so a screen wired up before its
 * entry is added here degrades to the old behaviour rather than silently
 * refetching nothing.
 */
export function invalidateResource(queryClient, resource) {
  const keys = RELATED_KEYS[resource] ?? [[resource]];
  for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
}

/** Hook form for screens: `const invalidate = useInvalidateResource('institutions')`. */
export function useInvalidateResource(resource) {
  const queryClient = useQueryClient();
  return () => invalidateResource(queryClient, resource);
}
