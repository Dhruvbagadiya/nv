-- Give MoiAcceptance a machine-readable level beside its free-text courseType.
--
-- `courseType` is a String an admin typed, so "Bachelor's Degree", "Bachelors",
-- "BACHELOR DEGREE" and "UG" are four different course types as far as the
-- database is concerned -- the agent-facing dropdown is built with a groupBy on
-- this column, so each spelling became its own option for the same award.
--
-- It also meant the table could never be JOINED to anything. A course carries a
-- ProgramLevel enum; an MOI row carried prose. So "show me the courses this
-- school accepts an MOI letter for" was a question the schema could not answer,
-- however obviously the two belonged together.
--
-- ADDED rather than replaced, and NULLABLE. Existing rows hold whatever was
-- typed and a blind cast would either fail on the first unrecognised spelling or
-- silently file it as OTHER; ops/backfill-moi-program-level.mjs maps what it can
-- and prints what it cannot. courseType stays as the label the agent screens
-- already render, and is written from the new enum going forward, so the two
-- cannot drift apart again.

ALTER TABLE "MoiAcceptance" ADD COLUMN "programLevel" "ProgramLevel";

-- The filter this exists for: courses whose level their institution accepts MOI
-- for. Postgres reaches this through institutionId, so the pair is the index.
CREATE INDEX "MoiAcceptance_programLevel_idx" ON "MoiAcceptance"("programLevel");
CREATE INDEX "MoiAcceptance_institutionId_programLevel_idx"
  ON "MoiAcceptance"("institutionId", "programLevel");
