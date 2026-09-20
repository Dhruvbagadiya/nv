-- Email verification for self-registered students.
--
-- The portal let anyone create an account with any address and immediately file
-- applications against real partner institutions: the registration endpoint is
-- public, accepts name/email/password, and nothing was ever sent to the address.
-- This is the storage half of closing that.
--
-- EXISTING ACCOUNTS STAY UNVERIFIED. emailVerifiedAt is nullable with no
-- default and no backfill, so every row already in the table reads as unproven.
-- The alternative -- stamping everyone as verified so nobody is inconvenienced --
-- would mean the flag asserts something that was never checked, which is worse
-- than not having it. Existing students get the banner and one click.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Deliberately the same shape as "PasswordResetToken": it is the same kind of
-- object, a single-use bearer credential that travels by email and then lives in
-- an inbox. Only the SHA-256 of the token is stored, so a database dump does not
-- hand over the ability to confirm accounts.
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "tokenHash" TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- Unique because the hash is how a token is looked up when it is spent; a
-- duplicate would make that lookup ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key"
    ON "EmailVerificationToken" ("tokenHash");

-- Issuing a new link invalidates the outstanding ones for that user, which is a
-- write filtered by userId.
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx"
    ON "EmailVerificationToken" ("userId");

-- For sweeping expired rows.
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx"
    ON "EmailVerificationToken" ("expiresAt");

-- CASCADE so deleting a user takes their outstanding links with them; a live
-- confirmation link pointing at a deleted account is a dangling credential.
ALTER TABLE "EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
