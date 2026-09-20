-- A reason for the new expiry, so the revoked rows say WHY they were revoked.
-- Distinguishable from REPLAY on purpose: REPLAY means a token was presented
-- twice and is a possible theft signal worth investigating, EXPIRED is a
-- session that simply got old and is entirely routine.
ALTER TYPE "RefreshRevokeReason" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Track when a session began, so it can be capped independently of activity.
--
-- Refresh tokens rotate, and each rotation issues a new row with a new
-- expiresAt. That makes expiresAt a measure of IDLENESS only — keep using the
-- portal and the session renews forever, and the password is never asked for
-- again. sessionStartedAt is copied across each rotation unchanged, so the cap
-- is measured from the sign-in rather than from the most recent refresh.
--
-- DEFAULT now() means sessions that are already open are treated as having
-- started at migration time. They therefore get the full cap from here rather
-- than being logged out mid-deploy, which is the kinder reading and costs one
-- window.

ALTER TABLE "RefreshToken"
  ADD COLUMN "sessionStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
