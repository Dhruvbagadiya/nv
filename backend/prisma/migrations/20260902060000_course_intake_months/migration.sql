-- Recurring intake months for a course, 1-12, independent of year.
--
-- CourseIntake requires an absolute startDate, so it can only describe a dated
-- instance. That suits ApplyBoard, which publishes real dates and deadlines,
-- and cannot describe instantapply at all -- it publishes "Feb, Jul" with no
-- year, which left 16,491 courses with zero intake rows and invisible to every
-- intake filter. Inventing a year to fit the model would have put a deadline in
-- front of a student that no provider ever stated.
--
-- The two facts are now stored separately: the recurring pattern here, which
-- never goes stale, and dated instances in CourseIntake where they exist.
ALTER TABLE "Course" ADD COLUMN "intakeMonths" INTEGER[] NOT NULL DEFAULT '{}';

-- Backfill the pattern from the dated intakes ApplyBoard already supplies, so
-- both feeds answer "which months does this run?" from the same column.
UPDATE "Course" c
SET "intakeMonths" = sub.months
FROM (
  SELECT "courseId",
         array_agg(DISTINCT EXTRACT(MONTH FROM "startDate")::int
                   ORDER BY EXTRACT(MONTH FROM "startDate")::int) AS months
  FROM "CourseIntake"
  GROUP BY "courseId"
) sub
WHERE c.id = sub."courseId";

-- Filtering by month is the reason this column exists.
CREATE INDEX "Course_intakeMonths_idx" ON "Course" USING GIN ("intakeMonths");
