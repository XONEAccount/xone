import { useEffect, useState } from "react";
import { DocsPage } from "@/features/docs-page";
import { PlaygroundPage } from "@/features/playground-page";
import { readDocsView, setDocsView, type DocsView } from "@/lib/view";

/**
 * Docs site root: README reference or live API-key playground.
 */
export function App() {
  const [view, setView] = useState<DocsView>(readDocsView);

  useEffect(() => {
    document.title =
      view === "playground" ? "XOne SDK Playground" : "XOne SDK Docs";
  }, [view]);

  useEffect(() => {
    const onPop = (): void => setView(readDocsView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * Switches Docs / Playground and updates the URL.
   */
  function onView(next: DocsView): void {
    setDocsView(next);
    setView(next);
  }

  if (view === "playground") {
    return <PlaygroundPage view={view} onView={onView} />;
  }

  return <DocsPage view={view} onView={onView} />;
}
