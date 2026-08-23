-- Multi-source upstream ids.
--
-- `externalId` was unique on its own, which only holds while there is exactly
-- one feed. There are now two, and their integer ids overlap: instantapply
-- university 116 is Otago Polytechnic, ApplyBoard 116 is SUNY
-- Fulton-Montgomery. The identifying key is the (source, externalId) pair.
--
-- NULL externalId stays legal, and Postgres treats NULLs as distinct in a
-- unique index, so any number of hand-created rows can coexist.

-- DropIndex
DROP INDEX "Institution_externalId_key";

-- DropIndex
DROP INDEX "Course_externalId_key";

-- DropIndex
DROP INDEX "SchoolPhoto_externalId_key";

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "SchoolPhoto" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- Backfill. The column defaults to 'manual', but every row that already has an
-- externalId came from the ApplyBoard import — leaving those as 'manual' would
-- tell the importer a human created them and must not be overwritten.
UPDATE "Institution" SET "source" = 'applyboard' WHERE "externalId" IS NOT NULL;
UPDATE "Course"      SET "source" = 'applyboard' WHERE "externalId" IS NOT NULL;
UPDATE "SchoolPhoto" SET "source" = 'applyboard' WHERE "externalId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Institution_source_idx" ON "Institution"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_source_externalId_key" ON "Institution"("source", "externalId");

-- CreateIndex
CREATE INDEX "Course_source_idx" ON "Course"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Course_source_externalId_key" ON "Course"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPhoto_source_externalId_key" ON "SchoolPhoto"("source", "externalId");
