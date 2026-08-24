import { DOC_NAV, slugifyHeading } from "@/lib/doc-nav";

export interface DocSearchHit {
  id: string;
  title: string;
  group: string;
  snippet: string;
  score: number;
}

interface DocSection {
  id: string;
  title: string;
  group: string;
  body: string;
}

/**
 * Strips light Markdown markers for indexing / snippets.
 * @param text - Raw heading or body text
 * @returns Plain text
 */
function plain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~>#|-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds searchable sections from README markdown.
 * @param markdown - Raw README
 * @returns Indexed sections
 */
export function buildDocSections(markdown: string): DocSection[] {
  const idToGroup = new Map<string, string>();
  for (const group of DOC_NAV) {
    for (const item of group.items) {
      idToGroup.set(item.id, group.title);
    }
  }

  const sections: DocSection[] = [];
  let current: { id: string; title: string; body: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    sections.push({
      id: current.id,
      title: current.title,
      group: idToGroup.get(current.id) ?? "Docs",
      body: plain(current.body.join("\n")),
    });
    current = null;
  };

  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (match?.[2]) {
      flush();
      const title = plain(match[2]);
      current = {
        id: slugifyHeading(title),
        title,
        body: [],
      };
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  return sections;
}

/**
 * Scores and ranks doc sections for a query.
 * @param sections - Indexed sections
 * @param query - User query
 * @returns Ranked hits (max 12)
 */
export function searchDocs(sections: DocSection[], query: string): DocSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const hits: DocSearchHit[] = [];

  for (const section of sections) {
    const title = section.title.toLowerCase();
    const body = section.body.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (title === term) score += 40;
      else if (title.includes(term)) score += 24;
      if (section.id.includes(term)) score += 12;
      if (body.includes(term)) score += 6;
    }

    if (score === 0) continue;

    const idx = body.indexOf(terms[0] ?? q);
    let snippet = section.body.slice(0, 120);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      snippet = (start > 0 ? "…" : "") + section.body.slice(start, start + 140);
      if (start + 140 < section.body.length) snippet += "…";
    }

    hits.push({
      id: section.id,
      title: section.title,
      group: section.group,
      snippet,
      score,
    });
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 12);
}
