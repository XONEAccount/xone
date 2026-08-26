import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Staggered letter reveal for the brand wordmark.
 */
export function BrandMark({ className }: { className?: string }) {
  const letters = ["X", "-", "O", "N", "E"];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setReady(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <p
      className={cn(
        "text-5xl tracking-tight sm:text-7xl md:text-8xl [perspective:600px] font-semibold",
        className,
      )}
      aria-label="X-ONE"
    >
      {letters.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={cn("brand-letter inline-block", ready && "brand-letter-in")}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          {ch === "-" ? (
            <span className="inline-block px-[0.04em]">-</span>
          ) : (
            ch
          )}
        </span>
      ))}
    </p>
  );
}
