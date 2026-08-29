import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  className?: string;
  /** Soft color well behind the icon. */
  tone?: "teal" | "sky" | "amber" | "emerald" | "slate";
};

const toneClass: Record<NonNullable<PageHeaderProps["tone"]>, string> = {
  teal: "icon-well-teal",
  sky: "icon-well-sky",
  amber: "icon-well-amber",
  emerald: "icon-well-emerald",
  slate: "icon-well-slate",
};

/**
 * Shared page title with accent icon well.
 */
export function PageHeader({
  icon: Icon,
  title,
  className,
  tone = "teal",
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3 fade-up", className)}>
      <div
        className={cn(
          "icon-well icon-pop mt-0.5 h-10 w-10 shrink-0 shadow-sm",
          toneClass[tone],
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
    </div>
  );
}
