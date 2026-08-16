import { config } from '../config.js';

// express-rate-limit's default store keeps its counters in the process. That is
// correct for one instance and wrong for more than one: each process counts
// separately, so N instances mean N times the intended limit, and a restart
// wipes the window — which is exactly the moment a brute-force run would like a
// restart to happen.
//
// Redis is opt-in via REDIS_URL. Resolution is deliberately soft: an unset URL,
// a missing package, or an unreachable server all fall back to the in-memory
// store with a warning rather than refusing to boot. A rate limiter that is
// slightly too permissive is worse than one that is perfect, but a rate limiter
// that stops the API from starting is worse than both.
export async function createRateLimitStore() {
  if (!config.redisUrl) return undefined; // in-memory default

  try {
    const [{ createClient }, { default: RedisStore }] = await Promise.all([
      import('redis'),
      import('rate-limit-redis'),
    ]);

    const client = createClient({ url: config.redisUrl });
    // Without a handler a later connection drop reaches the process as an
    // unhandled 'error' event and takes the API down with it.
    client.on('error', (err) => console.error('[rate-limit] redis error:', err.message));
    await client.connect();

    console.log('[rate-limit] using redis store');
    return new RedisStore({ sendCommand: (...args) => client.sendCommand(args) });
  } catch (err) {
    console.warn(
      `[rate-limit] REDIS_URL is set but the redis store could not be used (${err.message}). ` +
        'Falling back to the in-memory store — limits are per-instance and reset on restart. ' +
        'Install the optional deps with: npm install redis rate-limit-redis'
    );
    return undefined;
  }
}
