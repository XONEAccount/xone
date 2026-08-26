const items = [
  "Web3 wallet",
  "A2A payments",
  "Secure by design",
  "Fast settlement",
  "Web · App · API · SDK",
  "Policy-controlled spend",
];

/**
 * Infinite horizontal marquee strip.
 */
export function Marquee() {
  const row = [...items, ...items];
  return (
    <div className="marquee border-y border-border bg-card/60 py-3">
      <div className="marquee-track">
        {row.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="mx-6 inline-flex items-center gap-3 whitespace-nowrap text-sm text-muted-foreground"
          >
            <span className="h-1 w-1 rounded-full bg-[var(--color-foreground)]" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
