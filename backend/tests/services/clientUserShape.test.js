import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../src/modules/auth/auth.service.js'),
  'utf8'
);

/*
 * Guards a bug that shipped and was invisible from the server side.
 *
 * /me selected ten fields through PUBLIC_USER_FIELDS while login and refresh
 * hand-built five, and emailVerifiedAt was only in the first set. So confirming
 * an email worked, the banner cleared, and then the next silent token refresh
 * replaced the user object with one that had no emailVerifiedAt and the banner
 * came back. Every endpoint returned a 200; nothing logged an error; clicking
 * the confirmation link again could never help.
 *
 * The fix was to derive all three from one source. These tests fail if anyone
 * hand-builds a client-facing user object again.
 */
describe('the client-facing user shape', () => {
  it('is derived from PUBLIC_USER_FIELDS, not written out by hand', () => {
    expect(src).toMatch(/const toClientUser = \(u\) =>\s*Object\.fromEntries\(Object\.keys\(PUBLIC_USER_FIELDS\)/);
  });

  it('is what login and refresh both return', () => {
    // Exactly two call sites: login and refresh. The definition is an arrow
    // (`const toClientUser = (u) =>`) so it does not match this pattern itself.
    expect(src.match(/toClientUser\(/g) ?? []).toHaveLength(2);
  });

  it('carries emailVerifiedAt, which the whole verification flow depends on', () => {
    const fields = src.match(/const PUBLIC_USER_FIELDS = \{([\s\S]*?)\};/);
    expect(fields).not.toBeNull();
    expect(fields[1]).toContain('emailVerifiedAt');
  });

  it('has no hand-built user payload left in the module', () => {
    // The shape that caused this: an object literal listing id/name/email/role
    // and stopping before the rest.
    expect(src).not.toMatch(/user: \{\s*id: \w+\.id,\s*name: \w+\.name,\s*email: \w+\.email,/);
  });
});
