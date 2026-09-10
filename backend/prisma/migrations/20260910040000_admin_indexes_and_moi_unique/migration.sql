-- Indexes the queries already depend on, and the uniqueness MoiAcceptance
-- always needed.
--
-- The trigram/GIN indexes are NOT repeated here: 20260809120000_scale_indexes
-- already creates them with IF NOT EXISTS, so `migrate deploy` restores them on
-- a rebuilt database. They remain invisible to `prisma db push`, which is one
-- more reason this project uses `migrate deploy` only.

-- ---------------------------------------------------------------------------
-- archivedAt: every list on these models filters on it, and none had an index.
-- Institution and Course already do.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "UniversityCommission_archivedAt_idx" ON "UniversityCommission"("archivedAt");
CREATE INDEX IF NOT EXISTS "EntryRequirement_archivedAt_idx"     ON "EntryRequirement"("archivedAt");
CREATE INDEX IF NOT EXISTS "ImportantUpdate_archivedAt_idx"      ON "ImportantUpdate"("archivedAt");
CREATE INDEX IF NOT EXISTS "Document_archivedAt_idx"             ON "Document"("archivedAt");
CREATE INDEX IF NOT EXISTS "SupportContact_archivedAt_idx"       ON "SupportContact"("archivedAt");
CREATE INDEX IF NOT EXISTS "UsefulInformation_archivedAt_idx"    ON "UsefulInformation"("archivedAt");

-- The admin user list orders by this.
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- ---------------------------------------------------------------------------
-- MoiAcceptance: one record per (institution, course type).
--
-- Without the constraint, two rows for the same award split the agent-facing
-- course-type dropdown into two options — which is exactly what happened when
-- the source published "Bachelor's Degree" with a curly apostrophe 23 times and
-- a straight one once.
--
-- Duplicates are collapsed before the index is added, keeping the oldest row of
-- each pair: it is the one any existing reference points at. Currently a no-op
-- on production (the import normalises the apostrophes), but a database that
-- predates that fix still has them.
-- ---------------------------------------------------------------------------
DELETE FROM "MoiAcceptance" a
USING "MoiAcceptance" b
WHERE a."institutionId" = b."institutionId"
  AND a."courseType"    = b."courseType"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS "MoiAcceptance_institutionId_courseType_key"
  ON "MoiAcceptance"("institutionId", "courseType");
