import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

export const GETTING_STARTED_VIDEO = "/guide/getting-started.mp4";
export const GETTING_STARTED_POSTER = "/guide/poster.jpg";

/**
 * Silent product walkthrough (top up, signature, chat).
 * @param props.open - Whether the dialog is shown
 * @param props.onOpenChange - Open-state callback
 */
export function GettingStartedTourDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("tour.title")}</DialogTitle>
          <DialogDescription>{t("tour.body")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <video
            className="w-full rounded-md bg-muted"
            controls
            playsInline
            poster={GETTING_STARTED_POSTER}
            preload="metadata"
          >
            <source src={GETTING_STARTED_VIDEO} type="video/mp4" />
          </video>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("tour.note")}</p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Button that opens the getting-started walkthrough.
 * @param props.className - Optional trigger classes
 * @param props.variant - Visual style
 */
export function GettingStartedTourTrigger({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(
          variant === "outline"
            ? "rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            : "text-sm font-medium underline-offset-4 hover:underline",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {t("activity.ctaTour")}
      </button>
      <GettingStartedTourDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
