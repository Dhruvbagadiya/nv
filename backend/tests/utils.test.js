import { describe, it, expect, vi } from 'vitest';
import { toSkipTake, paginated, MAX_PAGE_SIZE } from '../src/utils/pagination.js';
import {
  HttpError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} from '../src/utils/httpErrors.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validate } from '../src/middleware/validate.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { z } from 'zod';

describe('pagination', () => {
  it('turns page/pageSize into skip/take', () => {
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({
      skip: 40,
      take: 20,
      page: 3,
      pageSize: 20,
    });
  });

  // Services are also called from seeds and scripts, which do not pass through the
  // validation middleware, so the util clamps defensively too.
  it('clamps nonsense rather than producing NaN offsets', () => {
    expect(toSkipTake({ page: 0 }).page).toBe(1);
    expect(toSkipTake({ page: -5 }).page).toBe(1);
    expect(toSkipTake({ page: 'abc' }).skip).toBe(0);
    expect(toSkipTake({ pageSize: 99999 }).take).toBe(MAX_PAGE_SIZE);
    expect(toSkipTake({}).skip).toBe(0);
    expect(toSkipTake(undefined).take).toBeGreaterThan(0);
  });

  it('separates rows from their metadata', () => {
    const result = paginated([{ id: 1 }], 41, { page: 2, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta).toEqual({ total: 41, page: 2, pageSize: 20, totalPages: 3, maxPage: 3 });
  });

  // A catalogue can be deeper than the offset limit allows: 93,076 courses is
  // 7,757 pages of 12, and anything past page 834 is refused. totalPages stays
  // truthful; maxPage is what a client may actually navigate to, so it does not
  // render a control that always fails.
  it('caps the navigable page when the list is deeper than the offset limit', () => {
    const meta = paginated([], 93076, { page: 1, pageSize: 12 }).meta;
    expect(meta.totalPages).toBe(7757);
    expect(meta.maxPage).toBe(834);
  });

  it('leaves maxPage equal to totalPages when everything is reachable', () => {
    const meta = paginated([], 41, { page: 1, pageSize: 20 }).meta;
    expect(meta.maxPage).toBe(meta.totalPages);
  });

  // 0 pages, not 1: the Pagination component renders nothing for <= 1, so both
  // agree that an empty list has no pager.
  it('reports zero pages for an empty result', () => {
    expect(paginated([], 0, { page: 1, pageSize: 20 }).meta.totalPages).toBe(0);
  });
});

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

const req = { method: 'GET', originalUrl: '/api/test' };

describe('errorHandler', () => {
  it('uses the status and message from a typed error', () => {
    const res = mockRes();
    errorHandler(new NotFoundError('Course not found'), req, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Course not found');
  });

  it('carries validation details through', () => {
    const res = mockRes();
    errorHandler(new BadRequestError('Invalid', [{ field: 'page' }]), req, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toEqual([{ field: 'page' }]);
  });

  // F-13: deleting a course with applications raised a raw FK violation that
  // surfaced as a 500 — a client-fixable conflict reported as a server fault.
  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2025', 404],
    ['P2014', 409],
  ])('maps Prisma %s onto %i', (code, status) => {
    const res = mockRes();
    errorHandler({ code }, req, res, () => {});
    expect(res.statusCode).toBe(status);
  });

  it('falls back to 500 for an unknown error and never leaks its message', () => {
    const res = mockRes();
    errorHandler(new Error('connection string is postgres://user:hunter2@host'), req, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(JSON.stringify(res.body.error)).not.toMatch(/hunter2/);
  });

  it('still honours legacy { status, message } throws', () => {
    const res = mockRes();
    errorHandler({ status: 418, message: 'Legacy' }, req, res, () => {});
    expect(res.statusCode).toBe(418);
  });

  it('gives 401 and 403 distinct meanings', () => {
    const a = mockRes();
    errorHandler(new ForbiddenError(), req, a, () => {});
    expect(a.statusCode).toBe(403);
    const b = mockRes();
    errorHandler(new ConflictError('Email already in use'), req, b, () => {});
    expect(b.statusCode).toBe(409);
  });

  it('HttpError subclasses report their own name', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new HttpError(500, 'x').name).toBe('HttpError');
  });
});

describe('validate middleware', () => {
  const schema = z.object({ page: z.coerce.number().int().positive().default(1) });

  it('replaces the raw input with the parsed result, so handlers get real types', () => {
    const request = { query: { page: '4' } };
    const next = vi.fn();
    validate(schema, 'query')(request, null, next);
    expect(request.query.page).toBe(4);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes a BadRequestError naming the offending field', () => {
    const next = vi.fn();
    validate(schema, 'query')({ query: { page: 'abc' } }, null, next);
    const error = next.mock.calls[0][0];
    expect(error.status).toBe(400);
    expect(error.details[0].field).toBe('page');
  });
});

describe('asyncHandler', () => {
  // Express 4 does not catch rejections from async handlers; an uncaught one hangs
  // the request forever. This wrapper is the only reason controllers have no
  // try/catch.
  it('forwards a rejection to next()', async () => {
    const next = vi.fn();
    const boom = new Error('boom');
    await asyncHandler(async () => {
      throw boom;
    })({}, {}, next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('does not call next when the handler resolves', async () => {
    const next = vi.fn();
    await asyncHandler(async () => 'ok')({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('also catches a synchronous throw', async () => {
    const next = vi.fn();
    await asyncHandler(() => {
      throw new Error('sync');
    })({}, {}, next);
    expect(next).toHaveBeenCalled();
  });
});
