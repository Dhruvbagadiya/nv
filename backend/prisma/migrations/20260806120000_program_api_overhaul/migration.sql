-- Migration: program_api_overhaul
-- Adds slug/province/city to Institution, replaces Course.degreeLevel with
-- programLevel enum, replaces intakes String[] with CourseIntake table, adds
-- new Course fields (slug, shortName, languageOfInstruction, minLength,
-- maxLength, abAppCreationEnabled, successScore*, commissionAmount), adds
-- typed commission fields to UniversityCommission.

-- ============================================================
-- 1. New enums
-- ============================================================

CREATE TYPE "ProgramLevel" AS ENUM (
  'MASTERS_DEGREE',
  'POST_GRADUATE_CERTIFICATE',
  'DIPLOMA',
  'CERTIFICATE',
  'BACHELORS_DEGREE',
  'THREE_YEAR_BACHELORS',
  'FOUR_YEAR_BACHELORS',
  'FOUNDATION',
  'OTHER'
);

CREATE TYPE "SuccessScoreIntent" AS ENUM (
  'positive',
  'negative',
  'neutral'
);

-- ============================================================
-- 2. Institution — add slug, province, city
-- ============================================================

ALTER TABLE "Institution"
  ADD COLUMN "slug"     TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "city"     TEXT;

-- Populate slug from name (lowercase, spaces→hyphens, strip non-alnum)
UPDATE "Institution"
SET "slug" = lower(regexp_replace(regexp_replace("name", '[^a-zA-Z0-9 ]', '', 'g'), ' +', '-', 'g'));

-- Make slug NOT NULL and UNIQUE once populated
ALTER TABLE "Institution"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- ============================================================
-- 3. Course — add new columns before dropping old ones
-- ============================================================

-- 3a. Add programLevel column (nullable first so existing rows don't break)
ALTER TABLE "Course"
  ADD COLUMN "programLevel" "ProgramLevel";

-- 3b. Migrate degreeLevel → programLevel
UPDATE "Course" SET "programLevel" =
  CASE
    WHEN lower("degreeLevel") LIKE '%master%'              THEN 'MASTERS_DEGREE'::"ProgramLevel"
    WHEN lower("degreeLevel") LIKE '%postgraduate%'        THEN 'POST_GRADUATE_CERTIFICATE'::"ProgramLevel"
    WHEN lower("degreeLevel") LIKE '%post graduate%'       THEN 'POST_GRADUATE_CERTIFICATE'::"ProgramLevel"
    WHEN lower("degreeLevel") LIKE '%graduate certificate%' THEN 'POST_GRADUATE_CERTIFICATE'::"ProgramLevel"
    WHEN lower("degreeLevel") LIKE '%diploma%'             THEN 'DIPLOMA'::"ProgramLevel"
    WHEN lower("degreeLevel") LIKE '%certificate%'         THEN 'CERTIFICATE'::"ProgramLevel"
    WHEN lower("degreeLevel") LIKE '%bachelor%'            THEN 'BACHELORS_DEGREE'::"ProgramLevel"
    ELSE 'OTHER'::"ProgramLevel"
  END;

-- Set NOT NULL default after migration
ALTER TABLE "Course"
  ALTER COLUMN "programLevel" SET NOT NULL,
  ALTER COLUMN "programLevel" SET DEFAULT 'OTHER';

-- 3c. Add new Course columns
ALTER TABLE "Course"
  ADD COLUMN "slug"                     TEXT,
  ADD COLUMN "shortName"                TEXT,
  ADD COLUMN "languageOfInstruction"    TEXT NOT NULL DEFAULT 'eng',
  ADD COLUMN "minLength"                INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxLength"                INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "abAppCreationEnabled"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "commissionAmount"         DECIMAL(65,30),
  ADD COLUMN "successScoreIntent"       "SuccessScoreIntent",
  ADD COLUMN "successScoreLabel"        TEXT;

-- 3d. Derive slug from title (same pattern as institution)
UPDATE "Course"
SET "slug" = lower(regexp_replace(regexp_replace("title", '[^a-zA-Z0-9 ]', '', 'g'), ' +', '-', 'g'));

-- Where two courses would produce the same slug (same title at different institutions),
-- append the first 8 chars of the course id to disambiguate.
UPDATE "Course" c1
SET "slug" = c1."slug" || '-' || left(c1."id"::text, 8)
WHERE EXISTS (
  SELECT 1 FROM "Course" c2
  WHERE c2."slug" = c1."slug"
    AND c2."id" != c1."id"
);

ALTER TABLE "Course"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- 3e. Parse durationText → minLength / maxLength (months)
--     Handles "12 - 24 months", "12 months", "36 months", "48 months"
UPDATE "Course"
SET
  "minLength" = COALESCE(
    (regexp_match("durationText", '^(\d+)\s*[-–]\s*\d+'))[1]::integer,
    (regexp_match("durationText", '^(\d+)'))[1]::integer,
    0
  ),
  "maxLength" = COALESCE(
    (regexp_match("durationText", '\d+\s*[-–]\s*(\d+)'))[1]::integer,
    (regexp_match("durationText", '^(\d+)'))[1]::integer,
    0
  );

-- 3f. Drop replaced columns
ALTER TABLE "Course"
  DROP COLUMN "degreeLevel",
  DROP COLUMN "durationText",
  DROP COLUMN "city",
  DROP COLUMN "intakes";

-- ============================================================
-- 4. CourseIntake — new table
-- ============================================================

CREATE TABLE "CourseIntake" (
  "id"                 SERIAL PRIMARY KEY,
  "courseId"           TEXT NOT NULL,
  "startDate"          TIMESTAMP(3) NOT NULL,
  "openDate"           TIMESTAMP(3),
  "submissionDeadline" TIMESTAMP(3),
  "overallScore"       DOUBLE PRECISION,
  "scoreDetails"       JSONB NOT NULL DEFAULT '[]',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseIntake_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE
);

CREATE INDEX "CourseIntake_courseId_idx" ON "CourseIntake"("courseId");
CREATE INDEX "CourseIntake_startDate_idx" ON "CourseIntake"("startDate");

-- ============================================================
-- 5. UniversityCommission — add typed commission fields
-- ============================================================

ALTER TABLE "UniversityCommission"
  ADD COLUMN "commissionType"          TEXT,
  ADD COLUMN "rateFrom"                DOUBLE PRECISION,
  ADD COLUMN "rateTo"                  DOUBLE PRECISION,
  ADD COLUMN "amountFrom"              DECIMAL(65,30),
  ADD COLUMN "amountTo"                DECIMAL(65,30),
  ADD COLUMN "isTierAdjusted"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxNumberOfInstallments" INTEGER,
  ADD COLUMN "tuitionBasis"            TEXT;

-- ============================================================
-- 6. Drop old degreeLevel index (column no longer exists), add new indexes
-- ============================================================

DROP INDEX IF EXISTS "Course_degreeLevel_idx";

CREATE INDEX "Course_programLevel_idx" ON "Course"("programLevel");
CREATE INDEX "Course_slug_idx"         ON "Course"("slug");
