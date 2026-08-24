import type { DocsView } from "@/lib/view";
import { cn } from "@/lib/utils";

type SiteNavProps = {
  view: DocsView;
  onView: (view: DocsView) => void;
};

/**
 * Docs / Playground switch used in the site chrome.
 * @param props - Active view and change handler
 */
export function SiteNav({ view, onView }: SiteNavProps) {
  return (
    <div
      className="grid grid-cols-2 gap-0.5 rounded-md border border-border bg-muted p-0.5"
      role="tablist"
      aria-label="Site section"
    >
      {(["docs", "playground"] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          onClick={() => onView(id)}
          className={cn(
            "rounded-[5px] px-2 py-1.5 text-xs font-medium transition-colors",
            view === id
              ? "bg-white text-foreground shadow-[0_1px_2px_rgba(10,10,10,0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {id === "docs" ? "Docs" : "Playground"}
        </button>
      ))}
    </div>
  );
}
