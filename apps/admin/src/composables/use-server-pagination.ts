import { ref } from "vue";

/** Default page size options for admin tables. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Shared server-side pagination state for admin DataTables.
 * @param initialRows - Initial page size
 * @returns Pagination refs and helpers
 */
export function useServerPagination(initialRows = 20) {
  const first = ref(0);
  const rows = ref(initialRows);
  const total = ref(0);

  /**
   * Current request offset derived from first + rows.
   * @returns Offset for API queries
   */
  function offset(): number {
    return first.value;
  }

  /**
   * Current page size for API queries.
   * @returns Limit
   */
  function limit(): number {
    return rows.value;
  }

  /**
   * Resets to the first page (e.g. after search/filter).
   */
  function resetPage() {
    first.value = 0;
  }

  /**
   * Handles PrimeVue DataTable `page` event for lazy mode.
   * @param event - Page event from DataTable
   * @param reload - Callback to reload data for the new page
   */
  function onPage(
    event: { first: number; rows: number },
    reload: () => void | Promise<void>,
  ) {
    first.value = event.first;
    rows.value = event.rows;
    void reload();
  }

  return {
    first,
    rows,
    total,
    offset,
    limit,
    resetPage,
    onPage,
  };
}
