// Temporary text wordmark for goleads.app.
// Per brand rules: until transparent geometric G logo assets are attached in chat,
// we render a clean typographic wordmark rather than inventing a logo or using a non-transparent PNG.

export default function BrandWordmark({ size = "md", className = "" }) {
  const sizeClasses =
    size === "lg"
      ? "text-xl sm:text-2xl"
      : size === "sm"
      ? "text-sm"
      : "text-base sm:text-lg";

  return (
    <span
      className={`inline-flex items-baseline font-heading font-bold tracking-tight select-none ${sizeClasses} ${className}`}
      aria-label="goleads.app"
    >
      <span className="text-foreground">goleads</span>
      <span className="text-primary font-mono font-semibold">.app</span>
    </span>
  );
}