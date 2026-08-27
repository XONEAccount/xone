import * as React from "react";
import { Button, type ButtonProps } from "@xone/ui/button";
import { cn } from "@xone/ui/utils";

/**
 * Marketing-sized CTA (taller defaults) on top of shared Button.
 */
export const MarketingButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "lg", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      className={cn(size === "lg" && "h-12 px-7 text-base", className)}
      {...props}
    />
  ),
);
MarketingButton.displayName = "MarketingButton";
