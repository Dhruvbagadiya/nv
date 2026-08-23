-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProgramLevel" ADD VALUE 'INTEGRATED_MASTERS';
ALTER TYPE "ProgramLevel" ADD VALUE 'POST_GRADUATE_DIPLOMA';
ALTER TYPE "ProgramLevel" ADD VALUE 'ADVANCED_DIPLOMA';
ALTER TYPE "ProgramLevel" ADD VALUE 'DOCTORAL_PHD';
ALTER TYPE "ProgramLevel" ADD VALUE 'TOPUP_DEGREE';
ALTER TYPE "ProgramLevel" ADD VALUE 'ENGLISH';
ALTER TYPE "ProgramLevel" ADD VALUE 'NON_CREDENTIAL';
ALTER TYPE "ProgramLevel" ADD VALUE 'SECONDARY_SCHOOL';

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "externalId" INTEGER;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "externalId" INTEGER;

-- CreateTable
CREATE TABLE "SchoolPhoto" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "externalId" INTEGER,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "bytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPhoto_externalId_key" ON "SchoolPhoto"("externalId");

-- CreateIndex
CREATE INDEX "SchoolPhoto_institutionId_idx" ON "SchoolPhoto"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_externalId_key" ON "Institution"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_externalId_key" ON "Course"("externalId");

-- AddForeignKey
ALTER TABLE "SchoolPhoto" ADD CONSTRAINT "SchoolPhoto_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

