import { useEffect, useEffectEvent } from "react";
import { X } from "lucide-react";
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
 * Closable error banner; optionally auto-hides after `autoHideMs`.
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
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
        className,
      )}
    >
      <p className="min-w-0 flex-1">{message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-red-700 hover:bg-red-100 hover:text-red-900"
        onClick={onDismiss}
        aria-label="关闭错误"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
