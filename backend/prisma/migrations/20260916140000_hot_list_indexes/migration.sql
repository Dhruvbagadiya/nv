-- Composite indexes for the lists that filter on one column and sort by another.
--
-- Every index here already exists as its two single columns, which is not the
-- same thing. Postgres can use ONE index per scan: given
-- `WHERE archivedAt IS NULL ORDER BY createdAt DESC LIMIT 12`, it either walks
-- the archivedAt index and sorts the result, or walks createdAt in order and
-- discards the archived rows as it goes. At 93,000 courses both are work the
-- database should not be doing -- a composite in (filter, sort) order returns
-- the page by reading twelve rows and stopping.
--
-- Order within each index is load-bearing: the equality column first, the sort
-- column second, in the direction the query asks for. Reversed, the index still
-- answers the filter and the sort still has to happen.
--
-- CONCURRENTLY is deliberately NOT used. It cannot run inside a transaction and
-- Prisma wraps each migration in one; these tables are small enough that the
-- brief lock is not worth splitting the migration to avoid.

-- The catalogue's default query: active courses, newest first.
CREATE INDEX IF NOT EXISTS "Course_archivedAt_createdAt_idx"
  ON "Course"("archivedAt", "createdAt" DESC);

-- The same page narrowed to one destination or one school, which is how the
-- country strip and the institution filter are used.
CREATE INDEX IF NOT EXISTS "Course_institutionId_archivedAt_createdAt_idx"
  ON "Course"("institutionId", "archivedAt", "createdAt" DESC);

-- Application History, and the dashboard's "recent applications" panel: one
-- agent's rows, newest first. `agentId, createdAt` exists but ascending, and a
-- DESC scan of an ASC index is fine -- what is missing is the pairing for the
-- admin view, which has no agent and sorts the whole table.
CREATE INDEX IF NOT EXISTS "Application_createdAt_idx"
  ON "Application"("createdAt" DESC);

-- The dashboard's deadline panel: this agent's applications due from now on,
-- soonest first. `deadlineAt` alone makes Postgres read every future deadline
-- across every agency and then discard the ones that are not this agent's.
CREATE INDEX IF NOT EXISTS "Application_agentId_deadlineAt_idx"
  ON "Application"("agentId", "deadlineAt");

-- The Report screen's stage tiles, per agent. groupBy(stage) WHERE agentId
-- otherwise scans that agent's whole history to count eight buckets.
CREATE INDEX IF NOT EXISTS "Application_agentId_stage_idx"
  ON "Application"("agentId", "stage");

-- The notification feed and its badge. `(userId, readAt)` and `(userId,
-- createdAt)` both exist; this is the one the list actually runs -- unread
-- only, newest first.
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt" DESC);

-- The activity feed reads each of its three streams newest-first, capped.
CREATE INDEX IF NOT EXISTS "CourseInquiry_createdAt_idx"
  ON "CourseInquiry"("createdAt" DESC);
