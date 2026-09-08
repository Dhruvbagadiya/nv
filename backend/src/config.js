import dotenv from 'dotenv';
import { z } from 'zod';

/*
 * Two files, in precedence order, and dotenv never overwrites a variable that is
 * already set:
 *
 *   process.env   whatever the platform injects — always wins
 *   .env.local    THIS machine only. Gitignored, never deployed.
 *   .env          the deployable configuration
 *
 * `.env` alone was not enough. Working on this machine meant editing the file
 * that gets deployed — NODE_ENV flipped to development, localhost added to the
 * CORS list, the database host swapped for its public name — and every one of
 * those is wrong in production. `NODE_ENV=development` alone would disable the
 * `secure` flag on the refresh cookie and start returning stack traces on 500s.
 *
 * Local overrides now live in .env.local, so .env stays deployable as written.
 * Loading .env.local FIRST is what gives it precedence: dotenv only fills in
 * variables that are still unset.
 */
dotenv.config({ path: '.env.local' });
dotenv.config();

// Every process.env read in the app goes through here. The point is to fail at
// boot with a readable message instead of at request time with a 500 — a missing
// JWT_ACCESS_SECRET used to surface as an opaque jwt.sign() crash on the first
// login attempt, which is a terrible way to find out your deploy is misconfigured.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Rejecting the placeholder from .env.example is deliberate: it is the most
  // likely secret to reach production untouched.
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .refine((v) => v !== 'change-me', 'JWT_ACCESS_SECRET is still the example placeholder'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .refine((v) => v !== 'change-me-too', 'JWT_REFRESH_SECRET is still the example placeholder'),

  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Comma-separated so staging/preview origins can be added without a code change.
  // An explicit list, never a wildcard: `cors({ origin: undefined })` reflects
  // whatever Origin the caller sends, which with credentials:true is a real hole.
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  COOKIE_DOMAIN: z.string().optional(),
  JSON_BODY_LIMIT: z.string().default('1mb'),

  // ---- Document storage (S3 / Cloudflare R2) ----
  // All optional. Uploads stay disabled until every one of them is present, and
  // `storage.enabled` below is what the upload endpoint checks. Half-configured
  // storage is worse than none: it fails at the moment a user tries to upload
  // rather than at boot.
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  // R2 needs an account-specific endpoint
  // (https://<account>.r2.cloudflarestorage.com). Plain AWS S3 can leave it unset.
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Where uploaded files are served from, which is not the same host you upload
  // to. For R2 this is the public bucket or custom domain.
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),

  // ---- Password reset email ----
  // Where reset links point. The first CORS origin is the sensible default: it
  // is already the frontend's address in every deployment that works at all.
  APP_URL: z.string().url().optional(),
  // Transactional email over HTTPS, so no SMTP library is needed. Unset means
  // reset links are logged instead of sent — usable in development, and a
  // deliberate no-op rather than a silent failure in production.
  MAIL_PROVIDER: z.enum(['resend', 'sendgrid']).optional(),
  MAIL_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  // ---- Rate limiting ----
  // Unset means the in-memory store, which is correct for a single instance.
  // Behind more than one instance each process keeps its own counters, so the
  // effective limit multiplies by the instance count and a restart clears it.
  REDIS_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // Thrown, not process.exit(), so tests can assert on it.
  throw new Error(`Invalid environment configuration:\n${details}\n\nSee backend/.env.example.`);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jsonBodyLimit: env.JSON_BODY_LIMIT,

  corsOrigins: env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.ACCESS_TOKEN_TTL,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },

  cookie: {
    domain: env.COOKIE_DOMAIN,
    // Set by POST /auth/login, cleared by POST /auth/logout. httpOnly means no
    // script on the page can read it, which is the whole reason the refresh
    // token moved out of the JSON body.
    refreshName: 'nv_refresh',
  },

  storage: {
    // A single flag the upload route checks, so "is this configured" lives here
    // rather than being re-derived at every call site. Half-configured storage is
    // worse than none — it fails when a user tries to upload, not at boot.
    enabled: Boolean(
      env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ),
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    // Falls back to the standard AWS virtual-hosted URL when no public base is
    // given — right for plain S3, wrong for R2, hence the setting.
    publicBaseUrl:
      env.S3_PUBLIC_BASE_URL ??
      (env.S3_BUCKET && env.S3_REGION
        ? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`
        : undefined),
    presignTtlSeconds: env.S3_PRESIGN_TTL_SECONDS,
  },

  redisUrl: env.REDIS_URL,

  mail: {
    // Same "half-configured is worse than none" rule as storage: a provider
    // without a key would fail at the moment someone needs a reset link.
    enabled: Boolean(env.MAIL_PROVIDER && env.MAIL_API_KEY && env.MAIL_FROM),
    provider: env.MAIL_PROVIDER,
    apiKey: env.MAIL_API_KEY,
    from: env.MAIL_FROM,
  },

  appUrl: env.APP_URL ?? env.CORS_ORIGIN.split(',')[0].trim(),
};
