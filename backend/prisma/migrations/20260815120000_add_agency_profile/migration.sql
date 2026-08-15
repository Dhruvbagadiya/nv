-- AgencyProfile: lets a top-level agent set their own agency name and logo.
CREATE TABLE "AgencyProfile" (
  "id"         TEXT        NOT NULL,
  "userId"     TEXT        NOT NULL,
  "agencyName" TEXT        NOT NULL,
  "logoUrl"    TEXT,
  "website"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgencyProfile_pkey"   PRIMARY KEY ("id"),
  CONSTRAINT "AgencyProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "AgencyProfile_userId_key" ON "AgencyProfile"("userId");
