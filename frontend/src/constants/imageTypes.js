/**
 * What an image upload accepts, for the `accept` attribute and the hint beside
 * it.
 *
 * Mirrors IMAGE_TYPES in backend/src/utils/storage.js. The two cannot import
 * from each other, so this is the one place the frontend states the list —
 * rather than the four hard-coded copies it replaced, which had already drifted
 * from the server and from each other.
 *
 * SVG is deliberately absent on both sides: an SVG is an XML document that can
 * carry <script>, and uploads are served from the portal's own origin.
 */
export const IMAGE_MIME = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

/** The same list as prose, so the hint and the filter cannot disagree. */
export const IMAGE_FORMATS = 'PNG, JPEG, WebP, GIF or AVIF';
