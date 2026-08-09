// Where each role belongs.
//
// The app has three portals — student, partner, admin — sharing ONE session: one
// access token, one httpOnly refresh cookie, one useAuth store. That is a
// deliberate simplification (a single sign-in works everywhere the role allows),
// but it means a signed-in user can land on a portal their role cannot enter, and
// what happens next has to be defined.
//
// Previously each guard was handed a fixed `redirectPath`, and the partner guard's
// was `/partner/dashboard` — itself inside the guarded area. So a signed-in student
// who reached any /partner/* URL was redirected to a route that rejected them and
// redirected again: the guard rendered nothing but a <Navigate>, and the user got a
// blank white page. One click from the student login page's "Partner portal" link.
//
// A redirect target must be somewhere the user is actually allowed to be, which
// means it depends on their role, not on which door they knocked on.

export const HOME_BY_ROLE = {
  STUDENT: '/programs',
  AGENT: '/partner/dashboard',
  ADMIN: '/admin',
  SUPER_ADMIN: '/admin',
};

// Signed out, or a role we do not recognise, belongs at the student sign-in — the
// public entry point.
export const ANONYMOUS_HOME = '/login';

export function homePathFor(role) {
  return HOME_BY_ROLE[role] ?? ANONYMOUS_HOME;
}

// Which sign-in page to send an unauthenticated visitor to, based on the area they
// were trying to reach, so they come back to where they were headed.
export function loginPathForArea(pathname = '') {
  if (pathname.startsWith('/admin')) return '/admin/login';
  if (pathname.startsWith('/partner')) return '/partner/login';
  return '/login';
}
