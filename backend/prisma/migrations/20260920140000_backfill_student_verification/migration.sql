-- Backfill existing students as verified, ahead of the hard login gate.
--
-- The earlier email_verification migration deliberately left every account
-- unverified, on the reasoning that stamping people as proven when nothing had
-- been checked would make the flag a lie. That was right for a SOFT gate, where
-- an unverified student could still sign in and browse.
--
-- The gate is now hard: STUDENT accounts without emailVerifiedAt cannot sign in.
-- Under that rule the same choice silently locks out every student who registered
-- before this feature existed — people who were never sent a confirmation email
-- and cannot reasonably be asked to produce one retroactively.
--
-- So they are grandfathered, and ONLY they. The test is not a date but evidence:
-- a student is grandfathered if no verification token was ever issued to them,
-- which is precisely the population that could not have confirmed. A student who
-- WAS sent a link and has not used it is left unverified on purpose — they have
-- a live link sitting in an inbox, and stamping them would throw away the only
-- check this feature performs.
--
-- A date cutoff was the obvious alternative and is worse: this migration and the
-- one that created EmailVerificationToken deploy in the same run, so "before
-- now" would sweep up today's genuine signups as well.
--
-- The flag still means "we have reason to accept this address". For these rows
-- the reason is that they predate the check, recorded here rather than left to
-- be guessed at later.
--
-- Non-students are untouched. They are not gated at all (an administrator
-- created them and vouched for the address), so marking them would assert
-- something unchecked for no benefit.

UPDATE "User" u
SET "emailVerifiedAt" = u."createdAt"
WHERE u."role" = 'STUDENT'
  AND u."emailVerifiedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "EmailVerificationToken" t WHERE t."userId" = u."id"
  );
