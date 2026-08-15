-- Add phone, bio and avatarUrl to User for profile management.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone"     TEXT,
  ADD COLUMN IF NOT EXISTS "bio"       TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
