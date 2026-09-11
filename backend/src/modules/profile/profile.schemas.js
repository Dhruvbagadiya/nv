import { z } from 'zod';
import { uploadedUrl } from '../../utils/queryTypes.js';

export const updateProfileBody = z.object({
  name:      z.string().trim().min(1).max(120).optional(),
  phone:     z.string().trim().max(30).nullable().optional(),
  bio:       z.string().trim().max(500).nullable().optional(),
  // Accept full URLs or local /uploads/ paths from the avatar upload endpoint
  avatarUrl: uploadedUrl(500).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, 'Provide at least one field');

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(10, 'New password must be at least 10 characters').max(200),
}).strict();
