-- Documents an agent attaches to an application: the passport scan, the
-- transcripts, the mandatory declaration form.
--
-- Distinct from "Document", which is the admin-curated Document Bank -- material
-- an agent READS, scoped by category and country and owned by nobody. These are
-- owned by one application and written by the agent filing it, so they carry an
-- uploader and their own access rules.
--
-- Hand-written rather than generated: `prisma migrate dev` offers to reset when
-- it detects drift, and the trigram/GIN indexes on this database exist only in
-- raw SQL, so a reset drops them silently. Production applies this with
-- `migrate deploy`, which only ever rolls forward.

CREATE TYPE "ApplicationDocumentKind" AS ENUM (
  'PASSPORT',
  'ACADEMIC_TRANSCRIPT',
  'ENGLISH_TEST',
  'STATEMENT_OF_PURPOSE',
  'LETTER_OF_RECOMMENDATION',
  'DECLARATION_FORM',
  'FINANCIAL',
  'OTHER'
);

CREATE TABLE "ApplicationDocument" (
  "id"            TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "kind"          "ApplicationDocumentKind" NOT NULL DEFAULT 'OTHER',
  "label"         TEXT,
  "fileUrl"       TEXT NOT NULL,
  "fileName"      TEXT NOT NULL,
  "contentType"   TEXT NOT NULL,
  "sizeBytes"     INTEGER NOT NULL,
  "uploadedById"  TEXT NOT NULL,
  "archivedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- The list query for one application, newest first.
CREATE INDEX "ApplicationDocument_applicationId_createdAt_idx"
  ON "ApplicationDocument"("applicationId", "createdAt");
-- Every list on this model filters on archivedAt.
CREATE INDEX "ApplicationDocument_archivedAt_idx"
  ON "ApplicationDocument"("archivedAt");

-- Cascade: deleting an application takes its attachments with it, because they
-- are meaningless on their own and the files are addressed only from here.
ALTER TABLE "ApplicationDocument"
  ADD CONSTRAINT "ApplicationDocument_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: an application is a record of what was submitted, and
-- deleting the user who uploaded a file must not quietly remove it from that
-- record.
ALTER TABLE "ApplicationDocument"
  ADD CONSTRAINT "ApplicationDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
