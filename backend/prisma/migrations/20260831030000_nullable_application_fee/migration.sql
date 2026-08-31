-- Let a course say "no application fee published" rather than encoding it as
-- zero plus a fee_unknown tag.
--
-- Zero and unknown are different facts. 47,938 ApplyBoard courses genuinely
-- charge nothing and must keep their 0; 15,864 instantapply courses simply do
-- not publish a figure, and showing those as free would tell an agent a
-- fee-charging course costs nothing to apply to.
ALTER TABLE "Course" ALTER COLUMN "applicationFee" DROP NOT NULL;

-- Backfill only rows the importer itself marked as unknown, so a real zero is
-- never turned into a null.
UPDATE "Course"
SET "applicationFee" = NULL
WHERE 'fee_unknown' = ANY(tags)
  AND "applicationFee" = 0;
