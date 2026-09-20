import { z } from 'zod';
import { ApplicationStage } from '@prisma/client';
import { passportNumber } from '../applications/applications.schemas.js';
import { phoneNumber } from '../auth/auth.schemas.js';

export const updateProfileBody = z.object({
  // Nullable like its four siblings and like the column itself. It was the one
  // field with no way to express "clear this", so a student who emptied the box
  // got a success message and the old value back.
  nationality:  z.string().trim().max(80).optional().nullable(),
  dateOfBirth:  z.coerce.date().optional().nullable(),
  passportNo:   z.string().trim().max(40).optional().nullable(),
  /*
   * Required, and NOT nullable — unlike its siblings.
   *
   * Registration now demands a mobile number, so allowing this form to clear it
   * afterwards would make that requirement decorative: sign up with a number,
   * blank it on the next screen, and the applicant is unreachable again.
   *
   * The cost is that a student who predates the requirement has to supply one
   * before their next profile save succeeds. That is the intended nudge, and
   * the message names the field, so it reads as "add your number" rather than
   * as a broken form.
   */
  phone:        phoneNumber,
  address:      z.string().trim().max(300).optional().nullable(),
}).strict();

export const createApplicationBody = z.object({
  courseId:    z.string().uuid(),
  intakeLabel: z.string().trim().max(80).optional(),
  studentName: z.string().trim().min(1).max(200),
  // The shared rule, not a second copy of it. This schema kept its own
  // `min(4)` when the agent-side one was tightened, so the student apply form
  // was still accepting "aaaa" after that was supposedly fixed.
  passportNo:  passportNumber,
}).strict();

export const listApplicationsQuery = z.object({
  // The ApplicationStage enum, not a free string. It was spread into the Prisma
  // `where` unfiltered, so ?stage=foo reached the database as an invalid enum
  // value and returned a 500. Every other module uses the enum here.
  stage:    z.enum(Object.values(ApplicationStage)).optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

export const idParam = z.object({ id: z.string().uuid() });
