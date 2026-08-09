-- Indexes for text search and sorting at scale.
--
-- Measured on a 1,000,101-row Course table: an ILIKE '%term%' predicate cannot use
-- a btree index, so search was a sequential scan — 377 ms to fetch a page and
-- 880 ms for the matching COUNT, on every keystroke-driven request. Sorting by a
-- non-indexed column cost 444 ms for 12 rows.
--
-- pg_trgm turns ILIKE '%x%' into an indexable operation via a GIN index.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text searched by the course finder and the admin catalogue.
CREATE INDEX IF NOT EXISTS "Course_title_trgm_idx"      ON "Course"      USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Course_shortName_trgm_idx"  ON "Course"      USING GIN ("shortName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Institution_name_trgm_idx"  ON "Institution" USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Institution_city_trgm_idx"  ON "Institution" USING GIN (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Document_title_trgm_idx"    ON "Document"    USING GIN (title gin_trgm_ops);

-- Sort columns. Ordering by an unindexed column made Postgres sort the whole
-- table to return twelve rows.
CREATE INDEX IF NOT EXISTS "Course_title_idx"       ON "Course" (title);
CREATE INDEX IF NOT EXISTS "Institution_name_idx"   ON "Institution" (name);

-- Student- and passport-name lookups on Application (also ILIKE contains).
CREATE INDEX IF NOT EXISTS "Application_studentName_trgm_idx" ON "Application" USING GIN ("studentName" gin_trgm_ops);
