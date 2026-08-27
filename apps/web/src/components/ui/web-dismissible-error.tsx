import { useEffect, useEffectEvent } from "react";
import { CircleAlert, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DismissibleErrorProps = {
  message: string;
  onDismiss: () => void;
  /** Auto-clear after this many ms. Omit to keep until dismissed. */
  autoHideMs?: number;
  className?: string;
};

/**
 * Closable error banner built on shadcn Alert; optionally auto-hides.
 * @param message - Error text
 * @param onDismiss - Clear handler
 * @param autoHideMs - Optional auto-dismiss delay in milliseconds
 * @param className - Optional wrapper class names
 */
export function DismissibleError({
  message,
  onDismiss,
  autoHideMs,
  className,
}: DismissibleErrorProps) {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (!autoHideMs || autoHideMs <= 0) return;
    const timer = window.setTimeout(() => dismiss(), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, autoHideMs]);

  return (
    <Alert variant="destructive" className={cn("pr-10", className)}>
      <CircleAlert className="h-4 w-4" aria-hidden />
      <AlertDescription className="pr-2">{message}</AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDismiss}
        aria-label="关闭错误"
      >
        <X className="size-4" />
      </Button>
    </Alert>
  );
}
