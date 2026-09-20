import { z } from 'zod';
import { ApplicationDocumentKind } from '@prisma/client';
import { optionalBody, optionalEnum, optionalText, optionalUuid } from '../../utils/queryTypes.js';
// The same rule student registration uses — one definition of what a phone
// number is, so the two forms cannot drift apart.
import { phoneNumber } from '../auth/auth.schemas.js';

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

/*
 * Passport numbers, validated by what they CANNOT be rather than by format.
 *
 * There is no useful regex here. Numbering varies across ~190 issuing
 * authorities — lengths differ, some are all digits, some mix letters, some
 * carry checksums — and any pattern tight enough to reject junk also rejects
 * real documents. A visa portal turning away a genuine applicant because their
 * passport does not match our guess is far worse than accepting a bad one, which
 * a human sees on the next screen anyway.
 *
 * So this only refuses strings that cannot be anybody's passport:
 *   - fewer than 6 characters (the shortest national formats are 6-7)
 *   - a single character repeated ("aaaa", "111111"), the shape placeholder
 *     input actually takes
 *
 * The old rule was min(4), which accepted "aaaa".
 */
const PASSPORT_MIN = 6;

export const passportNumber = z
  .string()
  .trim()
  .min(PASSPORT_MIN, `Passport number must be at least ${PASSPORT_MIN} characters`)
  .max(40)
  .refine((v) => new Set(v.toUpperCase()).size > 1, {
    message: 'That does not look like a passport number',
  });

export const listApplicationsQuery = z.object({
  country: optionalText(8),
  institutionId: optionalUuid(),
  stage: optionalEnum(APPLICATION_STAGES),
  passportNo: optionalText(40),
  studentName: optionalText(160),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createApplicationBody = z
  .object({
    studentName: z.string().trim().min(1).max(160),
    // NOT normalised to uppercase: it is copied from a document and should be
    // stored as written. See passportNumber above for why there is no format check.
    passportNo: passportNumber,
    /*
     * Required. Both of these used to be absent entirely, which is why a
     * stage-change email on an agent-filed application went to the agent — there
     * was no applicant address to send it to — and why the history list had
     * nothing to show under "Student name & info" but a passport.
     *
     * Lowercased like every other email in this codebase, so the same person
     * typed two ways is the same string.
     */
    studentEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
    studentPhone: phoneNumber,
    courseId: z.string().uuid(),
    intakeLabel: optionalBody(z.string().trim().max(40)),
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

// ── Documents ───────────────────────────────────────────────────────────────

export const documentIdParam = z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
});

/**
 * The metadata that rides alongside the file in the multipart body.
 *
 * Everything else about the document — its size, type and stored URL — is taken
 * from the upload itself rather than the client, because a client-supplied size
 * or content type is a claim, not a fact.
 */
export const addDocumentBody = z.object({
    // nativeEnum against Prisma's own type, not a hand-written list. The list was
    // written out once and would have needed editing again for each of the 46
    // kinds added since -- and a zod enum that has drifted from the database
    // rejects a value the column would happily store, with a 400 that names a
    // field the client set correctly.
    kind: z.nativeEnum(ApplicationDocumentKind).default(ApplicationDocumentKind.OTHER),
    label: optionalBody(z.string().trim().max(160)),
}).strict();

export const documentListQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(24),
});
