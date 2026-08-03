import { config } from '../config.js';
import { HttpError } from '../utils/httpErrors.js';

// Prisma's known request errors carry a code that maps cleanly onto HTTP.
// Without this, deleting a course that still has applications surfaced the raw
// FK violation as a 500 — a client-fixable conflict reported as a server fault.
const PRISMA_STATUS = {
  P2002: [409, 'That value is already taken'], // unique constraint
  P2003: [409, 'That record is still referenced by other data'], // FK constraint
  P2025: [404, 'Record not found'], // update/delete on a missing row
  P2014: [409, 'That change would break a required relation'],
};

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err?.code && PRISMA_STATUS[err.code]) {
    [status, message] = PRISMA_STATUS[err.code];
  } else if (err?.status && err?.message) {
    // Legacy `throw { status, message }` objects still present in some services.
    status = err.status;
    message = err.message;
  }

  // 4xx are the caller's problem and would otherwise drown the log — a wrong
  // password is not an incident. 5xx always gets a full stack.
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  } else if (config.env === 'development') {
    console.warn(`[${req.method} ${req.originalUrl}] ${status} ${message}`);
  }

  const body = { error: message };
  if (details) body.details = details;
  // Stacks are a disclosure risk, so they never leave a production process.
  if (!config.isProduction && status >= 500) body.stack = err?.stack;

  res.status(status).json(body);
}
