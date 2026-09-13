-- A rendered first page for each Document Bank PDF.
--
-- The grid showed 87 identical PDF glyphs, so it told a reader nothing but the
-- title -- and the titles are things like "FD Cover Letter" next to "Loan Cover
-- Letter", which are easy to tell apart on sight and much less so by name.
--
-- Nullable, and it stays nullable: the render is best-effort. A PDF poppler
-- cannot parse still uploads, and the grid falls back to the typed tile rather
-- than the upload failing because a picture of it could not be drawn.
ALTER TABLE "Document" ADD COLUMN "thumbnailUrl" TEXT;
