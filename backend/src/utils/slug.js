/**
 * URL-safe slug from a title or name.
 *
 * One implementation, because there were three byte-identical copies — two in
 * the frontend admin screens and one in institutions.service.js — and a slug
 * that differs between the client and the server produces a duplicate row
 * rather than an error.
 */
export function slugify(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
