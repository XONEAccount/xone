export type DocsView = "docs" | "playground";

export type DocProduct = "sdk" | "mcp" | "api";

/**
 * Reads the current site view from `?view=`.
 * @returns Active view
 */
export function readDocsView(): DocsView {
  const q = new URLSearchParams(window.location.search).get("view");
  return q === "playground" ? "playground" : "docs";
}

/**
 * Reads active doc product from `?doc=`.
 * @returns sdk, mcp, or api
 */
export function readDocProduct(): DocProduct {
  const q = new URLSearchParams(window.location.search).get("doc");
  if (q === "mcp") return "mcp";
  if (q === "api") return "api";
  return "sdk";
}

/**
 * Updates `?view=` without a full navigation. Docs hashes are cleared on playground.
 * @param view - Target view
 */
export function setDocsView(view: DocsView): void {
  const url = new URL(window.location.href);
  if (view === "playground") {
    url.searchParams.set("view", "playground");
    url.hash = "";
  } else {
    url.searchParams.delete("view");
  }
  history.pushState({}, "", url);
  window.scrollTo({ top: 0, behavior: "instant" });
}

/**
 * Switches SDK / MCP / HTTP API docs via `?doc=`.
 * @param product - Target product
 */
export function setDocProduct(product: DocProduct): void {
  const url = new URL(window.location.href);
  if (product === "mcp") {
    url.searchParams.set("doc", "mcp");
  } else if (product === "api") {
    url.searchParams.set("doc", "api");
  } else {
    url.searchParams.delete("doc");
  }
  url.hash = "";
  history.pushState({}, "", url);
  window.scrollTo({ top: 0, behavior: "instant" });
}
