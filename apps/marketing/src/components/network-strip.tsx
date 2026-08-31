const items = [
  { label: "Beta", detail: "Free while we ship" },
  { label: "Base Sepolia", detail: "Settlement network" },
  { label: "USDC", detail: "Primary asset" },
  { label: "x402", detail: "HTTP 402 pay" },
  { label: "Gas sponsored", detail: "Where available" },
] as const;

/**
 * Compact trust strip for current networks and rails.
 */
export function NetworkStrip() {
  return (
    <section className="border-b border-border">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <li
            key={item.label}
            className="border-border px-4 py-4 sm:px-6 not-last:border-b lg:border-b-0 lg:not-last:border-r"
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
