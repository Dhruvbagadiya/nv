import { config } from '../config.js';
import { HttpError } from '../utils/httpErrors.js';

// Prisma's known request errors carry a code that maps cleanly onto HTTP.
// Without this, deleting a course that still has applications surfaced the raw
// FK violation as a 500 — a client-fixable conflict reported as a server fault.
// A friendly name for the columns a unique constraint can collide on, so the
// 409 says which field rather than "That value is already taken" — which names
// neither the field nor the value, and is what an admin saw when two courses
// derived the same URL slug from the same title.
const UNIQUE_FIELD_LABEL = {
  slug: 'URL slug',
  email: 'email address',
  code: 'code',
  isoCode: 'ISO code',
  externalId: 'import id',
  reference: 'reference',
};

/** "A record with that email address already exists." */
function uniqueMessage(err) {
  const columns = [].concat(err?.meta?.target ?? []).filter((c) => typeof c === 'string');
  if (!columns.length) return 'That value is already taken';
  const named = columns.map((c) => UNIQUE_FIELD_LABEL[c] ?? c);
  const list = named.length === 1
    ? named[0]
    : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
  return `Another record already uses that ${list}.`;
}

const PRISMA_STATUS = {
  P2002: [409, 'That value is already taken'], // unique constraint
  P2025: [404, 'Record not found'], // update/delete on a missing row
  P2014: [409, 'That change would break a required relation'],
};

// P2003 is a foreign key violation, and it means two opposite things depending
// on the direction of the write. Deleting a country that still has institutions
// is "something points at this". Creating an institution with a countryId that
// does not exist is "this points at nothing". Reporting the first message for
// the second told an admin their new record was "still referenced by other
// data", which is both wrong and unactionable — it happened on six endpoints.
function foreignKeyFailure(method) {
  return method === 'DELETE'
    ? [409, 'That record is still referenced by other data']
    : [400, 'That record references something that does not exist'];
}

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Internal server error';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err?.code === 'P2003') {
    [status, message] = foreignKeyFailure(req.method);
  } else if (err?.code === 'P2002') {
    // Named from meta.target, so the caller is told WHICH field collided.
    status = 409;
    message = uniqueMessage(err);
  } else if (err?.code && PRISMA_STATUS[err.code]) {
    [status, message] = PRISMA_STATUS[err.code];
  } else if (err?.name === 'PrismaClientValidationError') {
    // A malformed query — a missing required field, a bad enum value. It carries
    // no `.code`, so it fell through to 500 even though the caller caused it and
    // can fix it. POST /courses without a slug did exactly this.
    status = 400;
    message = 'That request does not match what this endpoint expects';
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
