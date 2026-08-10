import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DismissibleErrorProps = {
  message: string;
  onDismiss: () => void;
};

/**
 * Closable inline error banner.
 * @param message - Error text
 * @param onDismiss - Clear handler
 */
export function DismissibleError({ message, onDismiss }: DismissibleErrorProps) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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
