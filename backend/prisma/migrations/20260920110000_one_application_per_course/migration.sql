-- One application per person per course, per account.
--
-- Nothing stopped a student submitting the same programme repeatedly: the create
-- path looked up the course and inserted, with no check that the same person had
-- already applied. The service layer now refuses it with a readable 409; this
-- constraint is what holds when two requests race, because a double-clicked
-- submit button passes both service checks before either has written and only
-- the database can serialise that.
--
-- (agentId, courseId, passportNo), NOT (agentId, courseId). An agent files for
-- many different students under one account, so the pair would refuse the second
-- application an agency ever sends to a popular course. The passport is what
-- distinguishes the people; a student has exactly one, so the triple collapses to
-- the pair for them.

-- Existing duplicates have to go first, or the index cannot be built. Keeps the
-- OLDEST of each group: it is the one whose reference number has been quoted in
-- emails, and the one any documents were attached to.
DELETE FROM "Application" a
USING "Application" b
WHERE a."agentId"    = b."agentId"
  AND a."courseId"   = b."courseId"
  AND a."passportNo" = b."passportNo"
  AND (a."createdAt" > b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

CREATE UNIQUE INDEX IF NOT EXISTS "Application_agentId_courseId_passportNo_key"
    ON "Application" ("agentId", "courseId", "passportNo");
