// Bare YYYY-MM-DD strings must be parsed as local midnight. `new Date("2026-04-14")`
// is spec'd to parse as UTC midnight, which shifts a full calendar day for users
// west of UTC and breaks rolling-24h diffs (see #133).
export function formatRelativeTime(dateString: string): string {
  const workoutDate =
    dateString.length === 10 ? new Date(`${dateString}T00:00:00`) : new Date(dateString);

  const now = new Date();
  const workoutMidnight = new Date(
    workoutDate.getFullYear(),
    workoutDate.getMonth(),
    workoutDate.getDate(),
  ).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((todayMidnight - workoutMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 35) return `${Math.floor(diffDays / 7)} weeks ago`;

  return workoutDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
