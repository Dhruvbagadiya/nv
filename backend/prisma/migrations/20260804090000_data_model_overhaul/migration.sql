-- Phase 2 data-model overhaul.
--
-- Hand-authored rather than taken straight from `prisma migrate dev`, because the
-- generated version DROPPED four populated columns. Everything destructive here
-- is a rename or a backfill instead:
--
--   Course.status      -> RENAMEd to Course.badges          (12 rows preserved)
--   CourseInquiry.status -> backfilled into the stage enum   (1 row preserved)
--   Application.primaryStatus/secondaryStatus
--                      -> backfilled into stage + stageNote  (1 row preserved)
--
-- New NOT NULL `updatedAt` columns are added WITH a default so existing rows
-- satisfy them, then the default is dropped so the column matches what Prisma's
-- @updatedAt expects and no schema drift is reported afterwards.

-- CreateEnum
CREATE TYPE "StudyLevel" AS ENUM ('UG', 'PG');
-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('VISA_DOCUMENT', 'REFUND_FORM', 'INSTITUTE_BROCHURE', 'SOP', 'LOR');
-- CreateEnum
CREATE TYPE "AnnouncementVariant" AS ENUM ('DANGER', 'INFO', 'WARNING');
-- CreateEnum
CREATE TYPE "CourseInquiryStage" AS ENUM ('INQUIRY', 'PENDING', 'OFFERED', 'APPLIED');
-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('PROFILE_ASSESSMENT', 'APPLICATION', 'CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER', 'FEES_PAYMENT', 'CAS_LETTER', 'VISA_APPLICATION', 'VISA_APPROVAL');
-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('NEW_APPLICATION', 'INFO_QUERY', 'DOCUMENT_QUERY', 'STAGE_CHANGE', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_agentId_fkey";
-- DropForeignKey
ALTER TABLE "CourseInquiry" DROP CONSTRAINT "CourseInquiry_agentId_fkey";
-- DropForeignKey
ALTER TABLE "MoiAcceptance" DROP CONSTRAINT "MoiAcceptance_institutionId_fkey";

-- ---------------------------------------------------------------------------
-- Country / Institution / MoiAcceptance / User: additive only
-- ---------------------------------------------------------------------------
ALTER TABLE "Country"
  ADD COLUMN "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "currencyCode" TEXT         NOT NULL DEFAULT 'USD',
  ADD COLUMN "flagEmoji"    TEXT,
  ADD COLUMN "sortOrder"    INTEGER      NOT NULL DEFAULT 0;
ALTER TABLE "Country" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Institution"
  ADD COLUMN "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "isTrending" BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "Institution" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "MoiAcceptance"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MoiAcceptance" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "User"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Course.status -> Course.badges
-- Both are TEXT[], so a rename carries the existing pill labels across intact.
-- The generated migration dropped the column and added an empty one, silently
-- wiping "Instant Offer" / "Instant Submission" from all 12 rows.
-- ---------------------------------------------------------------------------
ALTER TABLE "Course" RENAME COLUMN "status" TO "badges";
ALTER TABLE "Course"
  ADD COLUMN "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Course" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- CourseInquiry.status (free text) -> stage (enum)
-- ---------------------------------------------------------------------------
ALTER TABLE "CourseInquiry"
  ADD COLUMN "stage"     "CourseInquiryStage" NOT NULL DEFAULT 'INQUIRY',
  ADD COLUMN "updatedAt" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CourseInquiry" ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "CourseInquiry" SET "stage" =
  CASE lower(coalesce("status", ''))
    WHEN 'open'    THEN 'INQUIRY'::"CourseInquiryStage"
    WHEN 'pending' THEN 'PENDING'::"CourseInquiryStage"
    WHEN 'offered' THEN 'OFFERED'::"CourseInquiryStage"
    WHEN 'applied' THEN 'APPLIED'::"CourseInquiryStage"
    ELSE 'INQUIRY'::"CourseInquiryStage"
  END;

ALTER TABLE "CourseInquiry" DROP COLUMN "status";

-- ---------------------------------------------------------------------------
-- Application.primaryStatus/secondaryStatus -> stage + stageNote
--
-- secondaryStatus was always the human detail ("Profile Under Review"), so it
-- moves verbatim into stageNote. primaryStatus mapped onto the 8 Report stages;
-- anything unrecognised falls back to PROFILE_ASSESSMENT, the first stage, which
-- is the safe direction to be wrong in (it understates progress rather than
-- claiming a visa was approved).
-- ---------------------------------------------------------------------------
ALTER TABLE "Application"
  ADD COLUMN "reference"   SERIAL       NOT NULL,
  ADD COLUMN "intakeLabel" TEXT,
  ADD COLUMN "stage"       "ApplicationStage" NOT NULL DEFAULT 'PROFILE_ASSESSMENT',
  ADD COLUMN "stageNote"   TEXT,
  ADD COLUMN "deadlineAt"  TIMESTAMP(3),
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Application" ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "Application" SET
  "stageNote" = "secondaryStatus",
  "stage" = CASE
    WHEN "primaryStatus" ILIKE '%visa%approv%'        THEN 'VISA_APPROVAL'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%visa%'               THEN 'VISA_APPLICATION'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%cas%'                THEN 'CAS_LETTER'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%fee%'                THEN 'FEES_PAYMENT'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%uncondition%'        THEN 'UNCONDITIONAL_OFFER'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%condition%'          THEN 'CONDITIONAL_OFFER'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%application%request%' THEN 'APPLICATION'::"ApplicationStage"
    WHEN "primaryStatus" ILIKE '%assess%'             THEN 'PROFILE_ASSESSMENT'::"ApplicationStage"
    ELSE 'PROFILE_ASSESSMENT'::"ApplicationStage"
  END;

ALTER TABLE "Application" DROP COLUMN "primaryStatus", DROP COLUMN "secondaryStatus";

-- ---------------------------------------------------------------------------
-- Recreate the FKs Prisma drops so it can re-add them with onDelete rules.
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "UniversityCommission" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "tiers" JSONB NOT NULL,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversityCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryRequirement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" "StudyLevel" NOT NULL,
    "englishRequirement" TEXT NOT NULL,
    "academicRequirement" TEXT NOT NULL,
    "offerTimeline" TEXT NOT NULL,
    "credibilityInterview" BOOLEAN NOT NULL DEFAULT false,
    "financialInformation" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3) NOT NULL,
    "countryId" TEXT,
    "institutionId" TEXT,
    "attachmentUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportantUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "countryId" TEXT,
    "institutionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "variant" "AnnouncementVariant" NOT NULL,
    "message" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsefulInformation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsefulInformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UniversityCommission_institutionId_key" ON "UniversityCommission"("institutionId");

-- CreateIndex
CREATE INDEX "EntryRequirement_level_idx" ON "EntryRequirement"("level");

-- CreateIndex
CREATE INDEX "EntryRequirement_credibilityInterview_idx" ON "EntryRequirement"("credibilityInterview");

-- CreateIndex
CREATE UNIQUE INDEX "EntryRequirement_institutionId_level_key" ON "EntryRequirement"("institutionId", "level");

-- CreateIndex
CREATE INDEX "ImportantUpdate_publishDate_idx" ON "ImportantUpdate"("publishDate");

-- CreateIndex
CREATE INDEX "ImportantUpdate_countryId_idx" ON "ImportantUpdate"("countryId");

-- CreateIndex
CREATE INDEX "ImportantUpdate_institutionId_idx" ON "ImportantUpdate"("institutionId");

-- CreateIndex
CREATE INDEX "Document_category_countryId_institutionId_idx" ON "Document"("category", "countryId", "institutionId");

-- CreateIndex
CREATE INDEX "Document_category_sortOrder_idx" ON "Document"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "SupportContact_sortOrder_idx" ON "SupportContact"("sortOrder");

-- CreateIndex
CREATE INDEX "Announcement_isActive_sortOrder_idx" ON "Announcement"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "UsefulInformation_sortOrder_idx" ON "UsefulInformation"("sortOrder");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_applicationId_idx" ON "Notification"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_agentId_createdAt_idx" ON "Application"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_courseId_idx" ON "Application"("courseId");

-- CreateIndex
CREATE INDEX "Application_stage_idx" ON "Application"("stage");

-- CreateIndex
CREATE INDEX "Application_deadlineAt_idx" ON "Application"("deadlineAt");

-- CreateIndex
CREATE INDEX "Application_passportNo_idx" ON "Application"("passportNo");

-- CreateIndex
CREATE INDEX "Country_sortOrder_idx" ON "Country"("sortOrder");

-- CreateIndex
CREATE INDEX "Course_institutionId_idx" ON "Course"("institutionId");

-- CreateIndex
CREATE INDEX "Course_degreeLevel_idx" ON "Course"("degreeLevel");

-- CreateIndex
CREATE INDEX "Course_archivedAt_idx" ON "Course"("archivedAt");

-- CreateIndex
CREATE INDEX "Course_createdAt_idx" ON "Course"("createdAt");

-- CreateIndex
CREATE INDEX "CourseInquiry_agentId_createdAt_idx" ON "CourseInquiry"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseInquiry_countryId_idx" ON "CourseInquiry"("countryId");

-- CreateIndex
CREATE INDEX "CourseInquiry_stage_idx" ON "CourseInquiry"("stage");

-- CreateIndex
CREATE INDEX "Institution_countryId_idx" ON "Institution"("countryId");

-- CreateIndex
CREATE INDEX "Institution_isBlacklisted_idx" ON "Institution"("isBlacklisted");

-- CreateIndex
CREATE INDEX "Institution_isTrending_idx" ON "Institution"("isTrending");

-- CreateIndex
CREATE INDEX "Institution_archivedAt_idx" ON "Institution"("archivedAt");

-- CreateIndex
CREATE INDEX "MoiAcceptance_institutionId_idx" ON "MoiAcceptance"("institutionId");

-- CreateIndex
CREATE INDEX "MoiAcceptance_courseType_idx" ON "MoiAcceptance"("courseType");

-- CreateIndex
CREATE INDEX "User_parentAgentId_idx" ON "User"("parentAgentId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentAgentId_fkey" FOREIGN KEY ("parentAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoiAcceptance" ADD CONSTRAINT "MoiAcceptance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityCommission" ADD CONSTRAINT "UniversityCommission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequirement" ADD CONSTRAINT "EntryRequirement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantUpdate" ADD CONSTRAINT "ImportantUpdate_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportantUpdate" ADD CONSTRAINT "ImportantUpdate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInquiry" ADD CONSTRAINT "CourseInquiry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInquiry" ADD CONSTRAINT "CourseInquiry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

