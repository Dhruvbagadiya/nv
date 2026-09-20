-- Contact details on the application itself.
--
-- Nullable, and deliberately not backfilled: for the applications that already
-- exist there is nothing to backfill FROM. An agent-filed application stores a
-- name and a passport and nothing else, and the account behind it belongs to
-- the agent, not the applicant — so borrowing the agent's address would put a
-- staff member's email on a student's record and mail their offer letter to the
-- wrong person.
--
-- New applications are required to carry both (createApplicationBody), so the
-- nulls are a closed set that only shrinks as old applications complete.

ALTER TABLE "Application" ADD COLUMN "studentEmail" TEXT;
ALTER TABLE "Application" ADD COLUMN "studentPhone" TEXT;
