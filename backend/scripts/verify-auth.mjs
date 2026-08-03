// Integration check for the auth flows that unit tests cannot cover, because the
// interesting behaviour (rotation, replay detection, revocation) only exists in
// the database.
//
//   cd backend && npm run verify:auth
//
// Requires a migrated + seeded database and the agent@example.com seed user. It
// cleans up after itself; safe to re-run. Not a substitute for the Vitest suite
// planned in Phase 9 — it is what was available without a backend test runner,
// and it caught a real bug (logout being conflated with token theft).
//
// NOTE for WSL users: Postgres on the Windows host is not reachable from inside
// WSL unless you open the firewall, but a Windows-side node process resolves
// localhost fine. Run it as:  node.exe scripts/verify-auth.mjs
import { PrismaClient } from '@prisma/client';
import * as auth from '../src/modules/auth/auth.service.js';
const p = new PrismaClient();
const ok = (c, m) => console.log(`${c ? '  PASS' : '  FAIL'}  ${m}`);
let failures = 0;
const check = (c, m) => { if (!c) failures++; ok(c, m); };

const EMAIL = 'agent@example.com', PASS = 'password123';
try {
  const user = await p.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error('seed user missing; run npm run prisma:seed');
  await p.refreshToken.deleteMany({ where: { userId: user.id } });

  console.log('\n1. login issues an access token + a stored refresh token');
  const s1 = await auth.login(EMAIL, PASS);
  check(!!s1.accessToken, 'access token returned');
  check(!!s1.refreshToken, 'refresh token returned');
  check(s1.user.role === 'AGENT', `user role echoed (${s1.user.role})`);
  const stored = await p.refreshToken.findMany({ where: { userId: user.id } });
  check(stored.length === 1, 'exactly one refresh row persisted');
  check(!stored[0].tokenHash.includes(s1.refreshToken), 'stored as a hash, not plaintext');
  check(stored[0].tokenHash.length === 64, 'hash is sha-256 hex (64 chars)');

  console.log('\n2. wrong password / unknown user are rejected identically');
  for (const [label, fn] of [
    ['wrong password', () => auth.login(EMAIL, 'nope-nope-nope')],
    ['unknown email',  () => auth.login('ghost@example.com', PASS)],
  ]) {
    try { await fn(); check(false, `${label} rejected`); }
    catch (e) { check(e.message === 'Invalid email or password', `${label} -> "${e.message}"`); }
  }

  console.log('\n3. refresh rotates: old token revoked, new one issued');
  const s2 = await auth.refresh(s1.refreshToken);
  check(s2.refreshToken !== s1.refreshToken, 'a different refresh token came back');
  check(!!s2.accessToken, 'new access token issued');
  const afterRotate = await p.refreshToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  check(afterRotate.length === 2, 'old row kept for replay detection, new row added');
  check(afterRotate[0].revokedAt !== null, 'old row is revoked');
  check(afterRotate[1].revokedAt === null, 'new row is live');

  console.log('\n4. REPLAY: presenting the already-rotated token nukes every session');
  try {
    await auth.refresh(s1.refreshToken);
    check(false, 'replay should have thrown');
  } catch (e) {
    check(/already been used|already used/i.test(e.message), `replay rejected -> "${e.message}"`);
  }
  const afterReplay = await p.refreshToken.findMany({ where: { userId: user.id } });
  check(afterReplay.every(r => r.revokedAt !== null), 'ALL sessions revoked after replay');

  console.log('\n5. the rotated-to token is dead as well (blast radius is total)');
  try { await auth.refresh(s2.refreshToken); check(false, 'should have thrown'); }
  catch (e) { check(true, `rejected -> "${e.message}"`); }

  console.log('\n6. garbage and empty tokens');
  for (const [label, tok] of [['unknown token', 'not-a-real-token'], ['empty', '']]) {
    try { await auth.refresh(tok); check(false, `${label} should throw`); }
    catch (e) { check(true, `${label} -> "${e.message}"`); }
  }

  console.log('\n7. logout revokes, and is idempotent');
  const s3 = await auth.login(EMAIL, PASS);
  await auth.logout(s3.refreshToken);
  const revoked = await p.refreshToken.findFirst({
    where: { userId: user.id, revokedAt: { not: null } }, orderBy: { createdAt: 'desc' } });
  check(!!revoked, 'row revoked on logout');
  try { await auth.logout(s3.refreshToken); check(true, 'second logout did not throw'); }
  catch { check(false, 'second logout threw'); }
  try { await auth.refresh(s3.refreshToken); check(false, 'logged-out token still worked'); }
  catch (e) {
    check(/no longer valid/i.test(e.message), `logged-out token refused -> "${e.message}"`);
    check(!/all sessions revoked/i.test(e.message), 'logout replay is NOT treated as theft');
  }

  console.log('\n7b. logging out one device leaves the others signed in');
  const laptop = await auth.login(EMAIL, PASS);
  const phone  = await auth.login(EMAIL, PASS);
  await auth.logout(phone.refreshToken);
  try {
    // a stale tab on the phone retries with the token that was just logged out
    await auth.refresh(phone.refreshToken);
    check(false, 'stale logged-out token should be refused');
  } catch (e) { check(/no longer valid/i.test(e.message), `stale token refused -> "${e.message}"`); }
  try {
    const still = await auth.refresh(laptop.refreshToken);
    check(!!still.accessToken, 'the laptop session SURVIVED the phone logout');
  } catch (e) { check(false, `laptop session was killed: ${e.message}`); }

  console.log('\n8. an expired refresh token is refused');
  const s4 = await auth.login(EMAIL, PASS);
  const crypto = await import('node:crypto');
  const h = crypto.createHash('sha256').update(s4.refreshToken).digest('hex');
  await p.refreshToken.update({ where: { tokenHash: h }, data: { expiresAt: new Date(Date.now() - 1000) } });
  try { await auth.refresh(s4.refreshToken); check(false, 'expired token accepted'); }
  catch (e) { check(/expired/i.test(e.message), `expired -> "${e.message}"`); }

  console.log('\n9. register cannot escalate even if role is forced in');
  const email = `probe-${Date.now()}@example.com`;
  const created = await auth.register({ name: 'Probe', email, password: 'longenoughpw', role: 'SUPER_ADMIN' });
  check(created.role === 'AGENT', `service pins role to AGENT (got ${created.role})`);
  check(!('passwordHash' in created), 'password hash not returned');
  try { await auth.register({ name: 'Dup', email, password: 'longenoughpw' }); check(false, 'duplicate allowed'); }
  catch (e) { check(/already in use/i.test(e.message), `duplicate email -> "${e.message}"`); }
  await p.user.delete({ where: { email } });

  await p.refreshToken.deleteMany({ where: { userId: user.id } });
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
} catch (e) {
  console.log('\nHARNESS ERROR:', e.message);
  failures++;
} finally { await p.$disconnect(); process.exit(failures ? 1 : 0); }
