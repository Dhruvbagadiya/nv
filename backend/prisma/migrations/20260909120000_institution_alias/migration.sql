-- Forwarding addresses for merged institutions.
--
-- The importer resolves a school by (source, externalId) and creates the row
-- when that lookup misses. So merging two feed rows for the same university
-- deleted one identity, and the next sync of that feed rebuilt it and moved
-- its courses back onto the rebuilt duplicate. Every merge undid itself.
--
-- This table is what the importer consults before creating: it maps a feed
-- identity onto the institution that identity now belongs to.
CREATE TABLE "InstitutionAlias" (
    "source"        TEXT NOT NULL,
    "externalId"    INTEGER NOT NULL,
    "institutionId" TEXT NOT NULL,
    "note"          TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionAlias_pkey" PRIMARY KEY ("source", "externalId")
);

CREATE INDEX "InstitutionAlias_institutionId_idx" ON "InstitutionAlias"("institutionId");

ALTER TABLE "InstitutionAlias"
    ADD CONSTRAINT "InstitutionAlias_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
