import { z } from 'zod';

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

// The privileged path. Same shape, but role is allowed and required — and the
// route is behind requireRole('SUPER_ADMIN').
export const createUserSchema = z
  .object({
    name:     z.string().min(1).max(120).trim(),
    email:    z.string().trim().toLowerCase().email(),
    password: z.string().min(10).max(200),
    role:     z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT', 'STUDENT']),
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
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT', 'STUDENT']).optional(),
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
