import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Normalizes model output so Markdown (especially GFM tables) can parse.
 * @param source - Raw assistant text
 * @returns Cleaned Markdown string
 */
export function normalizeMarkdown(source: string): string {
  let text = source.replace(/\r\n/g, "\n");
  // Models sometimes emit literal "\n" instead of real newlines.
  text = text.replace(/\\n/g, "\n");

  // Repair smashed GFM tables that were streamed onto one line.
  // "| 数值 | | --- | --- | | 链 | base |" → real row breaks.
  text = text.replace(/\|\s*(\|\s*[-:| ]+\|)/g, "|\n$1");
  text = text.replace(/(\|\s*[-:| ]+\|)\s*\|/g, "$1\n|");
  text = text.replace(/\|\s+\|\s+(?![-:|\s])/g, "|\n| ");

  // Blank line before a table improves remark-gfm parsing.
  text = text.replace(/([^\n])\n(\| .+\|)/g, "$1\n\n$2");
  return text.trim();
}

type MarkdownProps = {
  children: string;
  className?: string;
};

/**
 * Renders GitHub-flavored Markdown (tables, lists, code, links).
 * @param props - Markdown source and optional className
 */
export function Markdown({ children, className }: MarkdownProps) {
  const source = normalizeMarkdown(children);

  return (
    <div
      className={cn(
        "markdown-body space-y-2 text-sm leading-relaxed",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-neutral-200/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium",
        "[&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_p]:my-0 [&_p]:leading-relaxed",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-neutral-900 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-neutral-100",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs",
        "[&_th]:border [&_th]:border-border [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
