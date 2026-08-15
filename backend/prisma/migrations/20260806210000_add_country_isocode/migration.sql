-- Add isoCode column to Country.
-- ISO 3166-1 alpha-2 code used for flag CDN lookups (e.g. "GB" for the portal's "UK").
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "isoCode" TEXT;
