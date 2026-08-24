export type DocsView = "docs" | "playground";

/**
 * Reads the current site view from `?view=`.
 * @returns Active view
 */
export function readDocsView(): DocsView {
  const q = new URLSearchParams(window.location.search).get("view");
  return q === "playground" ? "playground" : "docs";
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
