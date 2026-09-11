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
 * THE RULE THIS MAP DEPENDS ON: **one key root per entity, variants after the
 * root, never beside it.** Keys are matched by prefix, so ['institutions'] also
 * clears ['institutions', { country: 'UK' }] and ['institutions', 'picker', …].
 * A cache keyed on a root of its own — as the institution picker, the student
 * programme browser and the admin entry-requirements tabs each were — shares a
 * prefix with nothing, so no entry here can reach it and it goes stale
 * permanently. Name a new cache under the entity it holds and it is covered for
 * free; give it a new root and it is invisible to all of this.
 */
export const RELATED_KEYS = {
  // Admin list, the shared dropdown cache and the picker, the course lists that
  // embed an institution name, and the MOI screens keyed off institutions.
  institutions: [
    ['admin-institutions'], ['institutions'],
    ['admin-courses'], ['courses'], ['course'],
    ['moi-institutions'], ['document-facets'], ['admin-stats'],
  ],
  countries: [['admin-countries'], ['countries'], ['admin-stats']],
  // ['courses'] also covers the picker and the student browser, both of which
  // live under that root.
  courses: [['admin-courses'], ['courses'], ['course'], ['admin-stats']],
  documents: [
    ['admin-documents'], ['documents'],
    // The Document Bank filters are built from what exists, so a newly scoped
    // document has to re-derive them or its filter never appears.
    ['document-facets'], ['admin-stats'],
  ],
  // ['users'] covers the admin table and the detail panel, both keyed under it;
  // ['sub-agents'] is the agent-facing view of the same rows.
  users: [['users'], ['sub-agents'], ['admin-stats']],
  // Commission is read onto agent-facing program cards, not just its own screen.
  commissions: [['commissions'], ['courses'], ['course']],
  // ['entry-requirements'] covers both the agent screen and the admin tabs.
  // english-tests is derived server-side from the requirement text, so a new
  // test named in a requirement only reaches the filter if this re-derives it.
  'entry-requirements': [['entry-requirements'], ['english-tests']],
  'important-updates': [['important-updates']],
  'support-contacts': [['support-contacts']],
  // The banner tile on the dashboard counts active announcements.
  announcements: [['announcements'], ['admin-stats']],
  'moi-institutions': [['moi-institutions'], ['moi-course-types']],
  // The Report panel is composed from applications, inquiries, deadlines,
  // notifications and these notes, so each of them has to re-derive it.
  'useful-information': [['useful-information'], ['report-summary']],
  'course-inquiries': [['course-inquiries'], ['report-summary']],
  applications: [
    ['applications'], ['application'],
    ['admin-applications'],
    ['student-applications'], ['student-application'],
    ['report-summary'], ['admin-stats'],
  ],
  notifications: [['notifications'], ['report-summary']],
  // A person's own profile, under either portal's key.
  profile: [['my-profile'], ['student-profile']],
};

/**
 * Invalidate a resource and everything derived from it.
 *
 * An unmapped resource still clears its own key, so a screen wired up before its
 * entry is added here degrades to the old behaviour rather than silently
 * refetching nothing. `relatedKeys.test.js` asserts every name here is a key
 * root some useQuery actually uses — a typo is otherwise invisible at runtime.
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
