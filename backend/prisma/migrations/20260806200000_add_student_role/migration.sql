-- Migration: add_student_role
-- Adds STUDENT to the Role enum and creates the StudentProfile table.

-- 1. Add STUDENT to the Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STUDENT';

-- 2. Create StudentProfile table
CREATE TABLE "StudentProfile" (
  "id"          TEXT        NOT NULL,
  "userId"      TEXT        NOT NULL,
  "nationality" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "passportNo"  TEXT,
  "phone"       TEXT,
  "address"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
