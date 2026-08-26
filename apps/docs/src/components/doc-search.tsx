import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { type DocNavGroup } from "@/lib/doc-nav";
import { buildDocSections, searchDocs, type DocSearchHit } from "@/lib/doc-search";
import { cn } from "@/lib/utils";

type DocSearchProps = {
  markdown: string;
  nav: DocNavGroup[];
  onSelect: (id: string) => void;
};

/**
 * Docs search: sidebar trigger + command palette (⌘/Ctrl+K).
 */
export function DocSearch({ markdown, nav, onSelect }: DocSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const sections = useMemo(() => buildDocSections(markdown, nav), [markdown, nav]);
  const hits = useMemo(() => searchDocs(sections, query), [sections, query]);

  useEffect(() => {
    /**
     * Opens search on ⌘/Ctrl+K or custom event.
     */
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpen(): void {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("xone-docs-search-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("xone-docs-search-open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  /**
   * Closes the dialog.
   */
  function close(): void {
    setOpen(false);
  }

  /**
   * Navigates to a hit and closes.
   */
  function choose(hit: DocSearchHit): void {
    onSelect(hit.id);
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 flex w-full items-center gap-2 rounded-md border border-border bg-white px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Search docs…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5  text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close search"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-white shadow-[0_16px_48px_rgba(10,10,10,0.12)]"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search methods, tools, errors…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const hit = hits[active];
                    if (hit) choose(hit);
                  }
                }}
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2 docs-scroll">
              {query.trim() && hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No results for “{query.trim()}”
                </p>
              ) : null}

              {!query.trim() ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Type to search API methods, tools, and concepts.
                </p>
              ) : null}

              <ul className="space-y-0.5">
                {hits.map((hit, index) => (
                  <li key={`${hit.id}-${index}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(hit)}
                      className={cn(
                        "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                        active === index ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{hit.title}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {hit.group}
                        </span>
                      </div>
                      {hit.snippet ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {hit.snippet}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
