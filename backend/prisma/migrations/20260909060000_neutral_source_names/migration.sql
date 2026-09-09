-- Replace upstream vendor names in the `source` column with neutral ones.
--
-- `source` is functional, not cosmetic: it pairs with externalId in a unique
-- key, the importers match on it, and archive-by-source uses it. So this is a
-- rename in place rather than a new column, and every script that writes these
-- values changes in the same commit.
--
--   applyboard   -> catalogue_a
--   instantapply -> catalogue_b
--
-- 'manual' is left alone: it means "entered by a person here", which is already
-- neutral and is what the admin panel writes.
UPDATE "Course"      SET source = 'catalogue_a' WHERE source = 'applyboard';
UPDATE "Course"      SET source = 'catalogue_b' WHERE source = 'instantapply';
UPDATE "Institution" SET source = 'catalogue_a' WHERE source = 'applyboard';
UPDATE "Institution" SET source = 'catalogue_b' WHERE source = 'instantapply';
UPDATE "SchoolPhoto" SET source = 'catalogue_a' WHERE source = 'applyboard';
UPDATE "SchoolPhoto" SET source = 'catalogue_b' WHERE source = 'instantapply';
