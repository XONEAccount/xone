import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

/**
 * shadcn/ui Skeleton (new-york).
 * @see https://ui.shadcn.com/docs/components/skeleton
 */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}

export { Skeleton };
