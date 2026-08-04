import { z } from 'zod';

export const APPLICATION_STAGES = [
  'PROFILE_ASSESSMENT',
  'APPLICATION',
  'CONDITIONAL_OFFER',
  'UNCONDITIONAL_OFFER',
  'FEES_PAYMENT',
  'CAS_LETTER',
  'VISA_APPLICATION',
  'VISA_APPROVAL',
];

export const listApplicationsQuery = z.object({
  country: z.string().trim().max(8).optional(),
  institutionId: z.string().uuid().optional(),
  stage: z.enum(APPLICATION_STAGES).optional(),
  passportNo: z.string().trim().max(40).optional(),
  studentName: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createApplicationBody = z
  .object({
    studentName: z.string().trim().min(1).max(160),
    // Loose on format because passport numbering varies by country, but bounded
    // and trimmed. Note it is NOT normalised to uppercase: it is copied from a
    // document and should be stored as written.
    passportNo: z.string().trim().min(4).max(40),
    courseId: z.string().uuid(),
    intakeLabel: z.string().trim().max(40).optional(),
  })
  .strict();

// agentId is deliberately absent: it comes from the authenticated token, never
// the body. Accepting it would let an agent file applications under someone else.
export const updateStageBody = z
  .object({
    stage: z.enum(APPLICATION_STAGES),
    stageNote: z.string().trim().max(500).nullable().optional(),
    deadlineAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const idParam = z.object({ id: z.string().uuid() });
