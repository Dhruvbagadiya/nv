// config.js is imported first on purpose: it loads dotenv and validates the
// whole environment, so a misconfigured deploy dies here with a readable list
// of what's wrong rather than on the first request that needs a secret.
import { config } from './src/config.js';
import app from './src/app.js';
import { prisma } from './src/utils/prisma.js';

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
