import 'dotenv/config';
import { z } from 'zod';

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
};
