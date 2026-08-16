import { z } from 'zod';

export const updateProfileBody = z.object({
  name:      z.string().trim().min(1).max(120).optional(),
  phone:     z.string().trim().max(30).nullable().optional(),
  bio:       z.string().trim().max(500).nullable().optional(),
  // Accept full URLs or local /uploads/ paths from the avatar upload endpoint
  avatarUrl: z
    .string().max(500)
    .refine(
      (v) => { try { new URL(v); return true; } catch { return v.startsWith('/uploads/'); } },
      { message: 'Must be a valid URL or a /uploads/ path' }
    )
    .nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Provide at least one field');

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(10, 'New password must be at least 10 characters').max(200),
}).strict();
