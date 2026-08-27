import { useCallback, useState } from "react";

const PAGE_SIZES = [10, 20, 50] as const;

/**
 * Server-side limit/offset pagination. Default page size is 10.
 * @param initialRows - Default page size
 */
export function useServerPagination(initialRows: number = 10) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(initialRows);
  const [total, setTotal] = useState(0);

  const resetPage = useCallback(() => setOffset(0), []);

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit) || 1);

  return {
    offset,
    limit,
    total,
    setTotal,
    setLimit: (rows: number) => {
      setLimit(rows);
      setOffset(0);
    },
    resetPage,
    page,
    pageCount,
    pageSizes: PAGE_SIZES,
    canPrev: offset > 0,
    canNext: offset + limit < total,
    prev: () => setOffset((o) => Math.max(0, o - limit)),
    next: () => setOffset((o) => o + limit),
  };
}
