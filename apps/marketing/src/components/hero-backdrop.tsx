/**
 * Animated hero backdrop: drifting grid + orbiting ink blobs.
 */
export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="hero-grid absolute inset-0" />
      <div className="hero-blob hero-blob-a" />
      <div className="hero-blob hero-blob-b" />
      <div className="hero-blob hero-blob-c" />
      <div className="hero-beam" />
      <div className="hero-scan" />
    </div>
  );
}
