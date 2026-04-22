const DATE_ONLY_LENGTH = 10;
const MIDNIGHT_TIME_SUFFIX = "T00:00:00";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const THRESHOLD_TODAY = 0;
const THRESHOLD_YESTERDAY = 1;
const THRESHOLD_ONE_WEEK = 7;
const THRESHOLD_TWO_WEEKS = 14;
const THRESHOLD_FIVE_WEEKS = 35;

const JUST_NOW_LABEL = "just now";
const TODAY_LABEL = "today";
const YESTERDAY_LABEL = "yesterday";
const ONE_WEEK_AGO_LABEL = "1 week ago";

const MINUTES_AGO_SUFFIX = "m ago";
const HOURS_AGO_SUFFIX = "h ago";
const DAYS_AGO_SUFFIX = "d ago";
const WEEKS_AGO_SUFFIX = " weeks ago";

// Bare YYYY-MM-DD strings must be parsed as local midnight. `new Date("2026-04-14")`
// is spec'd to parse as UTC midnight, which shifts a full calendar day for users
// west of UTC and breaks rolling-24h diffs (see #133).
export function formatRelativeTime(dateString: string): string {
  const isDateOnly = dateString.length === DATE_ONLY_LENGTH;
  const workoutDate = isDateOnly
    ? new Date(`${dateString}${MIDNIGHT_TIME_SUFFIX}`)
    : new Date(dateString);

  const now = new Date();

  // Full timestamps carry sub-day precision (e.g. externalActivities.beginTime),
  // so collapse <1h to "Xm ago" and <24h to "Xh ago" before falling through to
  // calendar-day buckets. Date-only inputs skip this — they only know the day.
  if (!isDateOnly) {
    const diffMs = now.getTime() - workoutDate.getTime();
    if (diffMs < MS_PER_MINUTE) return JUST_NOW_LABEL;
    if (diffMs < MS_PER_HOUR) {
      return `${Math.floor(diffMs / MS_PER_MINUTE)}${MINUTES_AGO_SUFFIX}`;
    }
    if (diffMs < MS_PER_DAY) {
      return `${Math.floor(diffMs / MS_PER_HOUR)}${HOURS_AGO_SUFFIX}`;
    }
  }

  const workoutMidnight = new Date(
    workoutDate.getFullYear(),
    workoutDate.getMonth(),
    workoutDate.getDate(),
  ).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((todayMidnight - workoutMidnight) / MS_PER_DAY);

  if (diffDays <= THRESHOLD_TODAY) return TODAY_LABEL;
  if (diffDays === THRESHOLD_YESTERDAY) return YESTERDAY_LABEL;
  if (diffDays < THRESHOLD_ONE_WEEK) return `${diffDays}${DAYS_AGO_SUFFIX}`;
  if (diffDays < THRESHOLD_TWO_WEEKS) return ONE_WEEK_AGO_LABEL;
  if (diffDays < THRESHOLD_FIVE_WEEKS) {
    return `${Math.floor(diffDays / THRESHOLD_ONE_WEEK)}${WEEKS_AGO_SUFFIX}`;
  }

  return workoutDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
