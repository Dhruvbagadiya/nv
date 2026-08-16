-- Explicit ISO 3166-1 alpha-2 per country, so flag images no longer depend on
-- decoding flagEmoji's Regional Indicator code points at render time.

-- IF NOT EXISTS because 20260806210000_add_country_isocode already adds this
-- column. Both were written against databases that only had one of them, so the
-- collision only appears on a fresh database applying the full history in order
-- — which is to say, on the first real deployment. The backfill below is still
-- worth running either way, and is safe to repeat.
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "isoCode" TEXT;

-- Backfill from the existing emoji: each Regional Indicator code point maps to a
-- letter (U+1F1E6 = 'A'), so the pair decodes straight back to the ISO code.
-- Everything currently seeded has a valid two-codepoint flag emoji.
UPDATE "Country"
SET "isoCode" = upper(
      chr(ascii(substring("flagEmoji", 1, 1)) - 127462 + 65) ||
      chr(ascii(substring("flagEmoji", 2, 1)) - 127462 + 65)
    )
WHERE "flagEmoji" IS NOT NULL AND length("flagEmoji") = 2;
