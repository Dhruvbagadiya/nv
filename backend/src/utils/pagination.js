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

export function toSkipTake({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  // Defensive clamping even though zod validates at the edge: services are also
  // called from scripts and seeds, which do not go through middleware.
  const safePage = Math.max(1, Math.trunc(Number(page) || 1));
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(pageSize) || DEFAULT_PAGE_SIZE)));
  return { skip: (safePage - 1) * safeSize, take: safeSize, page: safePage, pageSize: safeSize };
}

export function paginated(items, total, { page, pageSize }) {
  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      // Math.ceil(0 / 20) is 0, which reads as "no pages" rather than "one empty
      // page" — the Pagination component treats <= 1 as nothing to render, so
      // both agree.
      totalPages: Math.ceil(total / pageSize),
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
