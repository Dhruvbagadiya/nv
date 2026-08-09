-- Explicit ISO 3166-1 alpha-2 per country, so flag images no longer depend on
-- decoding flagEmoji's Regional Indicator code points at render time.

ALTER TABLE "Country" ADD COLUMN "isoCode" TEXT;

-- Backfill from the existing emoji: each Regional Indicator code point maps to a
-- letter (U+1F1E6 = 'A'), so the pair decodes straight back to the ISO code.
-- Everything currently seeded has a valid two-codepoint flag emoji.
UPDATE "Country"
SET "isoCode" = upper(
      chr(ascii(substring("flagEmoji", 1, 1)) - 127462 + 65) ||
      chr(ascii(substring("flagEmoji", 2, 1)) - 127462 + 65)
    )
WHERE "flagEmoji" IS NOT NULL AND length("flagEmoji") = 2;
