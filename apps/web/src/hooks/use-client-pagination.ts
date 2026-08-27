import { useEffect, useMemo, useState } from "react";

export const TABLE_PAGE_SIZES = [10, 20, 50] as const;

export type TablePageSize = (typeof TABLE_PAGE_SIZES)[number];

type UseClientPaginationResult<T> = {
  page: number;
  pageSize: TablePageSize;
  pageCount: number;
  total: number;
  pageItems: T[];
  canPrev: boolean;
  canNext: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: TablePageSize) => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Client-side list pagination (default 10 / page; 20 / 50 selectable).
 * @param items - Full list
 * @param initialPageSize - Rows per page
 */
export function useClientPagination<T>(
  items: readonly T[],
  initialPageSize: TablePageSize = 10,
): UseClientPaginationResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<TablePageSize>(initialPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), pageCount));
  }, [pageCount, total]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize) as T[];
  }, [items, page, pageSize]);

  /**
   * Updates page size and resets to the first page.
   * @param size - Rows per page
   */
  function setPageSize(size: TablePageSize): void {
    setPageSizeState(size);
    setPage(1);
  }

  return {
    page,
    pageSize,
    pageCount,
    total,
    pageItems,
    canPrev: page > 1,
    canNext: page < pageCount,
    setPage,
    setPageSize,
    onPrev: () => setPage((p) => Math.max(1, p - 1)),
    onNext: () => setPage((p) => Math.min(pageCount, p + 1)),
  };
}
