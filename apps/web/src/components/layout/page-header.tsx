import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  className?: string;
};

/**
 * Shared page title with icon.
 */
export function PageHeader({ icon: Icon, title, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
    </div>
  );
}
