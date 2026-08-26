import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Menu, Search, Wallet, X } from "lucide-react";
import sdkReadme from "../../../sdk/README.md?raw";
import mcpReadme from "../../../mcp/README.md?raw";
import httpApiDoc from "../../content/http-api.md?raw";
import { DocSearch } from "@/components/doc-search";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { docNavFor, slugifyHeading } from "@/lib/doc-nav";
import {
  readDocProduct,
  setDocProduct,
  type DocProduct,
  type DocsView,
} from "@/lib/view";
import { cn } from "@/lib/utils";

/** Offset from viewport top used for active-section detection / scroll targets. */
const SCROLL_OFFSET = 96;

const DOC_SOURCES: Record<DocProduct, { title: string; subtitle: string; markdown: string }> = {
  sdk: {
    title: "XOne SDK",
    subtitle: "@xone/sdk",
    markdown: sdkReadme,
  },
  mcp: {
    title: "XOne MCP",
    subtitle: "@xone/mcp",
    markdown: mcpReadme,
  },
  api: {
    title: "HTTP API",
    subtitle: "/v1/sdk · /v1/agents",
    markdown: httpApiDoc,
  },
};

type DocsPageProps = {
  view: DocsView;
  onView: (view: DocsView) => void;
};

/**
 * Extracts plain text from React children for heading ids.
 * @param node - React children
 * @returns Flattened text
 */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    const el = node as { props?: { children?: ReactNode } };
    return textOf(el.props?.children);
  }
  return "";
}

/**
 * Scrolls to a docs section by id.
 * @param id - Heading id
 */
function scrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

/**
 * Picks the nav id whose heading is the last one above the scroll offset line.
 * @param ids - Ordered nav heading ids
 * @returns Active id, or empty if none found
 */
function activeIdFromScroll(ids: string[]): string {
  let current = ids[0] ?? "";
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.getBoundingClientRect().top - SCROLL_OFFSET <= 1) {
      current = id;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Docs shell: product switch + grouped sidebar + rendered README.
 * @param props - Site view switch
 */
export function DocsPage({ view, onView }: DocsPageProps) {
  const [product, setProduct] = useState<DocProduct>(readDocProduct);
  const source = DOC_SOURCES[product];
  const docNav = useMemo(() => docNavFor(product), [product]);
  const [activeId, setActiveId] = useState<string>(docNav[0]?.items[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const clickingRef = useRef(false);

  const flatIds = useMemo(
    () => docNav.flatMap((g) => g.items.map((i) => i.id)),
    [docNav],
  );

  useEffect(() => {
    const onPop = (): void => setProduct(readDocProduct());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    setActiveId(docNav[0]?.items[0]?.id ?? "");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [product, docNav]);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));

    const sync = (): void => {
      if (clickingRef.current) return;
      const next = activeIdFromScroll(flatIds);
      if (next) setActiveId(next);
    };

    const timer = window.setTimeout(() => {
      if (hash && document.getElementById(hash)) {
        setActiveId(hash);
        scrollToId(hash);
      } else {
        sync();
      }
    }, 80);

    let raf = 0;
    const onScroll = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [flatIds, product]);

  useEffect(() => {
    const btn = document.querySelector<HTMLElement>(
      `[data-nav-id="${CSS.escape(activeId)}"]`,
    );
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  /**
   * Navigates sidebar link and briefly pauses scroll-spy to avoid flicker.
   */
  function onNav(id: string): void {
    clickingRef.current = true;
    setActiveId(id);
    setMobileOpen(false);
    scrollToId(id);
    window.setTimeout(() => {
      clickingRef.current = false;
    }, 500);
  }

  /**
   * Switches SDK / MCP / HTTP API docs.
   */
  function onProduct(next: DocProduct): void {
    setDocProduct(next);
    setProduct(next);
  }

  const productSwitch = (
    <div
      className="mb-4 grid grid-cols-3 gap-0.5 rounded-md border border-border bg-muted p-0.5"
      role="tablist"
      aria-label="Documentation product"
    >
      {(["sdk", "api", "mcp"] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={product === id}
          onClick={() => onProduct(id)}
          className={cn(
            "rounded-[5px] px-2 py-1.5 text-xs font-medium transition-colors",
            product === id
              ? "bg-white text-foreground shadow-[0_1px_2px_rgba(10,10,10,0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {id === "sdk" ? "SDK" : id === "api" ? "API" : "MCP"}
        </button>
      ))}
    </div>
  );

  const sidebar = (
    <nav className="docs-nav space-y-5" aria-label="Documentation">
      {docNav.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = activeId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-nav-id={item.id}
                    onClick={() => onNav(item.id)}
                    className={cn(
                      "relative w-full rounded-md px-2.5 py-1.5 text-left text-[14px] transition-colors",
                      active
                        ? "bg-muted font-medium text-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen text-(--color-foreground)">
      <div className="flex min-h-screen">
        <aside className="docs-sidebar sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-border bg-white/80 px-3 py-6 backdrop-blur-sm md:block">
          <div className="mb-4 flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted">
              <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">{source.title}</p>
              <p className="text-[11px] text-muted-foreground">{source.subtitle}</p>
            </div>
          </div>
          <div className="mb-4 px-0.5">
            <SiteNav view={view} onView={onView} />
          </div>
          {productSwitch}
          <DocSearch markdown={source.markdown} nav={docNav} onSelect={onNav} />
          {sidebar}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white/80 px-4 py-3 backdrop-blur-sm md:hidden">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              <p className="text-sm font-semibold">{source.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Search docs"
                onClick={() =>
                  window.dispatchEvent(new Event("xone-docs-search-open"))
                }
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </div>
          </header>

          {mobileOpen ? (
            <div className="space-y-4 border-b border-border bg-white px-4 py-4 md:hidden">
              <SiteNav view={view} onView={onView} />
              {productSwitch}
              {sidebar}
            </div>
          ) : null}

          <main className="px-4 py-8 md:px-10 md:py-10">
            <article className="prose-sdk mx-auto max-w-3xl animate-in">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  h1: ({ children }) => {
                    const text = textOf(children);
                    const id = slugifyHeading(text);
                    return (
                      <h1 id={id} className="scroll-mt-24">
                        {children}
                      </h1>
                    );
                  },
                  h2: ({ children }) => {
                    const text = textOf(children);
                    const id = slugifyHeading(text);
                    return (
                      <h2 id={id} className="scroll-mt-24">
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => {
                    const text = textOf(children);
                    const id = slugifyHeading(text);
                    return (
                      <h3 id={id} className="scroll-mt-24">
                        {children}
                      </h3>
                    );
                  },
                }}
              >
                {source.markdown}
              </ReactMarkdown>
            </article>
          </main>
        </div>
      </div>
    </div>
  );
}
