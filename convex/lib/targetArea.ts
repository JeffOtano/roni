export function normalizeTargetArea(area: string): string {
  const trimmed = area.trim();
  if (!trimmed) return "Unknown";
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
