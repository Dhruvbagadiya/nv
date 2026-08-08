import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
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
    email: z.string().email().toLowerCase().trim(),
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
    email:    z.string().email().toLowerCase().trim(),
    password: z.string().min(10).max(200),
    role:     z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT', 'STUDENT']),
  })
  .strict();

// Same shape as public registration and, like it, with no `role` field: a
// sub-agent is always an AGENT under the caller's agency.
export const createSubAgentBody = z
  .object({
    name: z.string().min(1).max(120).trim(),
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(10, 'Password must be at least 10 characters').max(200),
  })
  .strict();
