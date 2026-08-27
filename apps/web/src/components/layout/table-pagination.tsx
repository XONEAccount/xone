import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TABLE_PAGE_SIZES,
  type TablePageSize,
} from "@/hooks/use-client-pagination";
import { cn } from "@/lib/utils";

type TablePaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: TablePageSize;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: TablePageSize) => void;
  className?: string;
};

/**
 * shadcn Pagination bar with page-size select (10 / 20 / 50).
 */
export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const pages = visiblePages(page, pageCount);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        共 {total} 条 · 第 {page}/{pageCount} 页
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as TablePageSize)}
        >
          <SelectTrigger className="h-8 w-[7.5rem]" aria-label="每页条数">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLE_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / 页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="上一页"
                className={cn("gap-1 pl-2.5", !canPrev && "pointer-events-none opacity-50")}
                onClick={(event) => {
                  event.preventDefault();
                  if (canPrev) onPrev();
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>上一页</span>
              </PaginationLink>
            </PaginationItem>
            {pages.map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`e-${index}`}>
                  <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">
                    …
                  </span>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === page}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="下一页"
                className={cn("gap-1 pr-2.5", !canNext && "pointer-events-none opacity-50")}
                onClick={(event) => {
                  event.preventDefault();
                  if (canNext) onNext();
                }}
              >
                <span>下一页</span>
                <ChevronRight className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}

/**
 * Builds a compact page list with ellipsis windows.
 * @param page - Current page (1-based)
 * @param pageCount - Total pages
 */
function visiblePages(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }

  const sorted = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && current - prev > 1) {
      result.push("ellipsis");
    }
    result.push(current);
  }
  return result;
}
