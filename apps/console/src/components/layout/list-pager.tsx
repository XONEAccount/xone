import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PagerProps = {
  page: number;
  pageCount: number;
  total: number;
  limit: number;
  pageSizes: readonly number[];
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onLimitChange: (n: number) => void;
};

/**
 * Compact list pager (same UX as admin).
 */
export function ListPager({
  page,
  pageCount,
  total,
  limit,
  pageSizes,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onLimitChange,
}: PagerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>
        {total} total · page {page}/{pageCount}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(limit)}
          onValueChange={(v) => onLimitChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-28 text-xs" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" disabled={!canPrev} onClick={onPrev}>
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Prev
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={onNext}>
          Next
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
