// The skip/take arithmetic and the totalPages division were copy-pasted across
// five services, with two different default page sizes (12 for courses, 20
// everywhere else) and no shared notion of a maximum.
//
// List responses are also normalised here. They used to be
//   { items, total, page, pageSize, totalPages }
// which mixes the payload and its metadata at the same level, so a caller had to
// know which keys were rows and which were bookkeeping. Now:
//   { items, meta: { total, page, pageSize, totalPages } }

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Deepest offset we will serve. OFFSET makes Postgres walk every skipped row, so
// cost grows linearly with page number: measured over a million rows, page 1 took
// 7ms, page 10,000 took 421ms and page 50,000 took 3.8 SECONDS — each holding a
// connection for the duration. Nobody browses to page 50,000; something automated
// does. Past this point the answer is to filter, not to page.
export const MAX_OFFSET = 10_000;

export class PageTooDeepError extends Error {
  constructor(maxPage) {
    super(
      `That page is too deep to serve. Narrow the results with a filter or search — the last reachable page is ${maxPage}.`
    );
    this.status = 400;
  }
}

export function toSkipTake({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  // Defensive clamping even though zod validates at the edge: services are also
  // called from scripts and seeds, which do not go through middleware.
  const safePage = Math.max(1, Math.trunc(Number(page) || 1));
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(pageSize) || DEFAULT_PAGE_SIZE)));
  const skip = (safePage - 1) * safeSize;
  if (skip > MAX_OFFSET) throw new PageTooDeepError(Math.floor(MAX_OFFSET / safeSize) + 1);
  return { skip, take: safeSize, page: safePage, pageSize: safeSize };
}

/**
 * The deepest page this API will actually serve, given MAX_OFFSET.
 *
 * totalPages stays truthful -- 93,076 courses really are 7,757 pages of 12 --
 * but offering a page the server refuses is a broken control. A client should
 * paginate to maxPage and filter beyond it.
 */
export function maxReachablePage(totalPages, pageSize) {
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(pageSize) || DEFAULT_PAGE_SIZE)));
  return Math.max(1, Math.min(totalPages, Math.floor(MAX_OFFSET / safeSize) + 1));
}

export function paginated(items, total, { page, pageSize }) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      maxPage: maxReachablePage(totalPages, pageSize),
      // Math.ceil(0 / 20) is 0, which reads as "no pages" rather than "one empty
      // page" — the Pagination component treats <= 1 as nothing to render, so
      // both agree.
      totalPages,
    },
  };
}

// Convenience for the common "findMany + count with the same where" pair.
export async function paginateQuery(model, { where, include, orderBy, select }, pageArgs) {
  const { skip, take, page, pageSize } = toSkipTake(pageArgs);
  const [items, total] = await Promise.all([
    model.findMany({ where, ...(include && { include }), ...(select && { select }), orderBy, skip, take }),
    model.count({ where }),
  ]);
  return paginated(items, total, { page, pageSize });
}
