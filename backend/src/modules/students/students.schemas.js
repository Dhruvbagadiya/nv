import { z } from 'zod';

export const updateProfileBody = z.object({
  nationality:  z.string().trim().max(80).optional(),
  dateOfBirth:  z.coerce.date().optional().nullable(),
  passportNo:   z.string().trim().max(40).optional().nullable(),
  phone:        z.string().trim().max(30).optional().nullable(),
  address:      z.string().trim().max(300).optional().nullable(),
}).strict();

export const createApplicationBody = z.object({
  courseId:    z.string().uuid(),
  intakeLabel: z.string().trim().max(80).optional(),
  studentName: z.string().trim().min(1).max(200),
  passportNo:  z.string().trim().min(4).max(40),
}).strict();

export const listApplicationsQuery = z.object({
  stage:    z.string().trim().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

export const idParam = z.object({ id: z.string().uuid() });
