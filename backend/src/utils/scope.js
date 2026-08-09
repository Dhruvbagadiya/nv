// Who sees everything, and who sees only their own rows.
//
// This existed as `req.user.role === 'AGENT' ? req.user.sub : undefined` copied
// into several controllers — a NEGATION: "not an agent" implicitly meant "staff,
// show them everything". That held while the only roles were AGENT/ADMIN/
// SUPER_ADMIN. Adding STUDENT silently made every student a staff member:
// /reports/summary handed a brand-new student the whole pipeline, including other
// students' names and deadlines.
//
// Stated positively instead, so a new role defaults to seeing nothing rather than
// everything. Adding a role to the enum can no longer widen access by accident.

const UNRESTRICTED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const OWN_ROWS_ROLES = new Set(['AGENT']);

/**
 * Returns the agentId a query should be scoped to:
 *   undefined -> unrestricted (staff)
 *   a user id -> only that agent's rows
 * Throws for any role that has no business reading agent-owned data at all,
 * rather than silently returning undefined and showing them everything.
 */
export function agentScopeFor(user) {
  if (UNRESTRICTED_ROLES.has(user.role)) return undefined;
  if (OWN_ROWS_ROLES.has(user.role)) return user.sub;
  // Defence in depth: the routes also carry requireRole guards, so reaching here
  // means a guard is missing. Fail closed and make it loud rather than leaking.
  const error = new Error(
    `Role ${user.role} must not query agent-scoped data — this route is missing a requireRole guard`
  );
  error.status = 403;
  throw error;
}
