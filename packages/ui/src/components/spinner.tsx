import { Loader2Icon } from "lucide-react";

import { cn } from "../lib/utils";

/**
 * shadcn/ui Spinner (new-york).
 * @see https://ui.shadcn.com/docs/components/spinner
 * @param props - SVG props; use className for size/color
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
