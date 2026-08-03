-- Distinguishes WHY a refresh token was revoked. Only a ROTATED token being
-- presented again implies theft; a LOGOUT token being presented again is a stale
-- tab and must not revoke the user's other sessions.

-- CreateEnum
CREATE TYPE "RefreshRevokeReason" AS ENUM ('ROTATED', 'LOGOUT', 'REPLAY');

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "revokedReason" "RefreshRevokeReason";

-- Backfill: any already-revoked row predates this column. ROTATED is the
-- conservative choice — it is the stricter of the two behaviours, so an existing
-- revoked token cannot be replayed more freely than before.
UPDATE "RefreshToken" SET "revokedReason" = 'ROTATED' WHERE "revokedAt" IS NOT NULL;
