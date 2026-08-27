import { Button } from "@/components/ui/button";

type SearchBarProps = {
  onSearch: () => void;
  searching?: boolean;
  children: React.ReactNode;
};

/**
 * Filter row + explicit Search button (queries only run on click / pager).
 */
export function SearchBar({ onSearch, searching, children }: SearchBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {children}
      <Button type="button" onClick={onSearch} disabled={searching}>
        {searching ? "Searching…" : "Search"}
      </Button>
    </div>
  );
}
