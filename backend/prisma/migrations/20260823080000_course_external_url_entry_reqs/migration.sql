-- instantapply publishes two things ApplyBoard does not, and the portal had
-- nowhere to put either.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "externalUrl" TEXT;
ALTER TABLE "Course" ADD COLUMN "entryRequirements" JSONB;

-- Italy is offered by instantapply but was missing from Country, so every
-- Italian course would have been skipped for want of a countryId.
INSERT INTO "Country" ("id", "name", "code", "isoCode", "currencyCode", "flagEmoji", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Italy', 'IT', 'IT', 'EUR', '🇮🇹', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Country" WHERE "code" = 'IT');
