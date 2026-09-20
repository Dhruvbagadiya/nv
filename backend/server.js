// config.js is imported first on purpose: it loads dotenv and validates the
// whole environment, so a misconfigured deploy dies here with a readable list
// of what's wrong rather than on the first request that needs a secret.
import { config } from './src/config.js';
import app from './src/app.js';
import { prisma } from './src/utils/prisma.js';

/*
 * Say it at boot, not at the moment someone needs it.
 *
 * Students cannot sign in until they confirm their address, and the only way to
 * confirm is the emailed link. So unconfigured mail is not a degraded feature
 * here — it is a site where every new applicant registers successfully and then
 * finds they can never get in. sendMail warns per message, but that warning
 * arrives in the middle of request logs long after the deploy that caused it.
 *
 * Checked at start-up instead, where a deploy is being watched. Not fatal: the
 * rest of the API works, and an admin locked out by a hard exit cannot fix the
 * key.
 */
if (!config.mail.enabled) {
  console.warn(
    '[boot] WARNING: mail is not configured (needs MAIL_PROVIDER, MAIL_API_KEY, MAIL_FROM).\n' +
      '        Confirmation links will only be written to these logs, and because an\n' +
      '        unconfirmed student cannot sign in, NEW STUDENT SIGNUPS ARE EFFECTIVELY DEAD.\n' +
      '        Password resets will not arrive either.'
  );
}

/*
 * REFRESH_TOKEN_TTL_DAYS was one window for everybody. It is now three settings
 * — a staff idle window, a student idle window, and an absolute cap — so a
 * leftover value in an env file is no longer read by anything.
 *
 * Said out loud rather than ignored: a variable that looks like it configures
 * session length, sitting in .env.production doing nothing, is the kind of
 * thing somebody edits during an incident and then trusts.
 */
if (process.env.REFRESH_TOKEN_TTL_DAYS) {
  console.warn(
    '[boot] REFRESH_TOKEN_TTL_DAYS is set but no longer used. Session length is now\n' +
      '        SESSION_IDLE_STAFF_HOURS, SESSION_IDLE_STUDENT_DAYS and SESSION_ABSOLUTE_DAYS.\n' +
      '        Remove it to avoid confusion.'
  );
}

const server = app.listen(config.port, () => {
  console.log(`NV Immigration API (${config.env}) listening on http://localhost:${config.port}`);
});

// Without this, `node --watch` restarts and container rollouts drop in-flight
// requests and leak Postgres connections until the pool is exhausted.
async function shutdown(signal) {
  console.log(`\n${signal} received — draining connections...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forcing exit after 10s grace period.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
