-- Three more ProgramLevel values: HIGHER_DIPLOMA, UNDERGRADUATE_CERTIFICATE and
-- UNDERGRADUATE_DIPLOMA.
--
-- They already exist as course TITLES in the catalogue -- "UNDERGRADUATE DIPLOMA
-- IN HOSPITALITY AND TOURISM", "UNDERGRADUATE CERTIFICATE IN THE NURSING
-- PRACTICE" -- while the level column filed every one of them under something
-- else. A level an agent can read in the title and cannot filter by is the
-- catalogue lying quietly.
--
-- Written as a type REPLACEMENT rather than `ALTER TYPE ... ADD VALUE`, for the
-- reason the document-kinds migration records: ADD VALUE cannot be used in the
-- same transaction that later reads the new value, and Prisma runs each
-- migration in one transaction. The additive form works until something in the
-- same file touches the column, and then fails in a way that is hard to read.
--
-- Every existing name is preserved exactly, so the USING cast below finds a home
-- for every row. Adding a value is safe; renaming one would silently drop rows.

ALTER TYPE "ProgramLevel" RENAME TO "ProgramLevel_old";

CREATE TYPE "ProgramLevel" AS ENUM (
  'MASTERS_DEGREE',
  'POST_GRADUATE_CERTIFICATE',
  'DIPLOMA',
  'CERTIFICATE',
  'BACHELORS_DEGREE',
  'THREE_YEAR_BACHELORS',
  'FOUR_YEAR_BACHELORS',
  'FOUNDATION',
  'INTEGRATED_MASTERS',
  'POST_GRADUATE_DIPLOMA',
  'ADVANCED_DIPLOMA',
  'HIGHER_DIPLOMA',
  'UNDERGRADUATE_CERTIFICATE',
  'UNDERGRADUATE_DIPLOMA',
  'DOCTORAL_PHD',
  'TOPUP_DEGREE',
  'ENGLISH',
  'NON_CREDENTIAL',
  'SECONDARY_SCHOOL',
  'OTHER'
);

ALTER TABLE "Course"
  ALTER COLUMN "programLevel" DROP DEFAULT,
  ALTER COLUMN "programLevel" TYPE "ProgramLevel"
    USING ("programLevel"::text::"ProgramLevel"),
  ALTER COLUMN "programLevel" SET DEFAULT 'OTHER';

DROP TYPE "ProgramLevel_old";
