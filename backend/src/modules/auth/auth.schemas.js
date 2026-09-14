import { z } from 'zod';
import { Role } from '@prisma/client';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

// Note what is NOT here: `role`. This is the public, unauthenticated endpoint,
// and it previously forwarded the whole body into a service whose signature was
// `{ ..., role = 'AGENT' }` — a default, not a constraint. Anyone could POST
// {"role":"SUPER_ADMIN"} and mint themselves a super admin.
//
// `.strict()` makes that a 400 rather than a silent drop, so a caller probing
// for the old behaviour gets told no instead of quietly getting an AGENT.
export const registerSchema = z
  .object({
    name: z.string().min(1).max(120).trim(),
    email: z.string().trim().toLowerCase().email(),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(200, 'Password must be at most 200 characters'),
  })
  .strict();

/**
 * The roles this API will assign.
 *
 * SUPER_ADMIN is deliberately not among them. There is exactly one super admin
 * and there is meant to stay exactly one: it is the account that can create
 * users, change roles and reset anyone's password, so a second one is a second
 * copy of the keys to everything, handed out through a dropdown.
 *
 * Enforced HERE and not only in the admin screen's <select>. Dropping the option
 * from the UI changes what is easy to do, not what is possible — this route
 * takes a JSON body, and a request that names SUPER_ADMIN has to be refused by
 * the thing that reads the body.
 *
 * `Role` in the database keeps the value: the existing super admin must still
 * load, still render with their own badge, and still be findable by the role
 * filter. What is removed is the ability to MINT one, not the concept.
 */
export const ASSIGNABLE_ROLES = ['ADMIN', 'AGENT', 'STUDENT'];

// The privileged path. Same shape, but role is allowed and required — and the
// route is behind requireRole('SUPER_ADMIN').
export const createUserSchema = z
  .object({
    name:     z.string().min(1).max(120).trim(),
    email:    z.string().trim().toLowerCase().email(),
    password: z.string().min(10).max(200),
    role:     z.enum(ASSIGNABLE_ROLES),
  })
  .strict();

// Admin user management. `PUT /users/:id` forwarded req.body straight into
// prisma.user.update, so `role` was writable by anyone who reached the route —
// the same hole registerSchema above closes, reopened on the update path.
// `.strict()` for the same reason: a caller probing for the old behaviour is
// told no rather than quietly getting a no-op.
export const idParam = z.object({ id: z.string().uuid() });

export const updateUserBody = z
  .object({
    name: z.string().min(1).max(120).trim().optional(),
    // Same list as creation: promoting an existing account is the other half of
    // the same door, and leaving it open would make "no new super admins" a
    // two-step process instead of an impossible one.
    role: z.enum(ASSIGNABLE_ROLES).optional(),
  })
  .strict();

// Same shape as public registration and, like it, with no `role` field: a
// sub-agent is always an AGENT under the caller's agency.
export const createSubAgentBody = z
  .object({
    name: z.string().min(1).max(120).trim(),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(10, 'Password must be at least 10 characters').max(200),
  })
  .strict();

// Password reset. The request side takes only an email — deliberately no hint
// about which portal the user belongs to, since the reset link works for any
// role and asking would leak account shape.
export const forgotPasswordBody = z
  .object({ email: z.string().trim().toLowerCase().email() })
  .strict();

export const resetPasswordBody = z
  .object({
    token: z.string().min(1),
    // Same floor as registration, so a reset cannot be used to set a weaker
    // password than signup would have allowed.
    newPassword: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(200, 'Password must be at most 200 characters'),
  })
  .strict();


// ---- admin user management ----

/**
 * The user list's query. It had no validation at all, so `role` was spread into
 * the Prisma `where` exactly as typed: `?role=NOPE` reached the database as an
 * invalid enum value and came back a 500, and Express's extended parser meant
 * `?role[contains]=A` arrived as an object and was injected into the clause.
 */
export const listUsersQuery = z.object({
  role: z.enum(Object.values(Role)).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Replaces a hand-rolled `!newPassword || newPassword.length < 10` check, which
 * a body of {"newPassword": {"length": 20}} or a 20-element array satisfied —
 * bcrypt then threw on the non-string and the caller got a 500. Also bounds the
 * upper end, which the check never did.
 */
export const adminResetPasswordBody = z
  .object({ newPassword: z.string().min(10).max(200) })
  .strict();

/** Was checked by hand in the controller and accepted unknown keys. */
export const setUserActiveBody = z.object({ isActive: z.boolean() }).strict();
