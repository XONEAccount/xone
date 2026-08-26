import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "xone.site.waitlist";

/**
 * App waitlist form (stores emails locally until a backend exists).
 */
export function WaitlistForm({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * @param e - Submit event
   */
  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email.");
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      if (!list.includes(value)) {
        list.push(value);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
      setDone(true);
      setEmail("");
    } catch {
      setError("Could not save. Try again.");
    }
  }

  if (done) {
    return (
      <p className={cn("text-sm font-medium", className)}>
        You are on the list. We will email you when the app ships.
      </p>
    );
  }

  return (
    <div className={cn("w-full max-w-md", className)}>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="waitlist-email">
          Email
        </label>
        <input
          id="waitlist-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
        />
        <Button type="submit" className="h-11 shrink-0">
          Join waitlist
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        No spam — launch updates only.
      </p>
    </div>
  );
}
