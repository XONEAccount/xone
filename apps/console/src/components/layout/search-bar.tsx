import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type SearchBarProps = {
  onSearch: () => void;
  searching?: boolean;
  children: React.ReactNode;
};

/**
 * Filter row + explicit Search button (queries only run on click).
 */
export function SearchBar({ onSearch, searching, children }: SearchBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <Button type="button" onClick={onSearch} disabled={searching}>
        {searching ? (
          <Spinner className="size-4" />
        ) : (
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        )}
        {searching ? "Searching…" : "Search"}
      </Button>
    </div>
  );
}
