-- Add accentColor to AgencyProfile.
-- Stores a hex color string, e.g. "#C96E0E". NULL means use NV default orange.
ALTER TABLE "AgencyProfile" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;
