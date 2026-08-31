-- Per-course ISO 4217 currency for tuitionFee.
--
-- Country.currencyCode remains the fallback and is correct for most rows, but
-- a country default cannot express a UK university's Dubai campus quoting AED,
-- or Lincoln University (New Zealand) quoting NZD while filed under the UK.
-- Nullable on purpose: NULL means "no per-course currency published, use the
-- country's", which is different from a course whose currency is genuinely
-- unknown.
ALTER TABLE "Course" ADD COLUMN "currencyCode" TEXT;
