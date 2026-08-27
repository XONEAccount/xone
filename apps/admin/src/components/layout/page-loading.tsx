import { Spinner } from "@/components/ui/spinner";

type PageLoadingProps = {
  /** Use full viewport (auth gate). Default centers in page content area. */
  fullScreen?: boolean;
};

/**
 * Centered shadcn Spinner for page-level loading states.
 * @param props.fullScreen - Fill the viewport instead of content area
 */
export function PageLoading({ fullScreen = false }: PageLoadingProps) {
  return (
    <div
      className={
        fullScreen
          ? "flex min-h-screen items-center justify-center"
          : "flex min-h-[calc(100dvh-8rem)] items-center justify-center"
      }
    >
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
