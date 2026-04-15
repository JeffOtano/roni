const TONAL_API_BASE = "https://api.tonal.com";

export class TonalApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Tonal API ${status}: ${body}`);
    this.name = "TonalApiError";
  }
}

export async function tonalFetch<T = unknown>(
  token: string,
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${TONAL_API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options?.method === "POST" ? 30_000 : 15_000),
  });

  if (res.status === 401) {
    const body = await res.text().catch(() => "Token expired or invalid");
    throw new TonalApiError(401, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new TonalApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

const PG_PAGE_SIZE = 200;

/**
 * Fetch a single page of /workout-activities using pg-offset/pg-limit headers.
 * Returns { items, pgTotal } so callers can decide whether to continue.
 */
export async function fetchWorkoutActivitiesPage<T>(
  token: string,
  tonalUserId: string,
  offset: number,
  limit: number = PG_PAGE_SIZE,
): Promise<{ items: T[]; pgTotal: number }> {
  const res = await fetch(`${TONAL_API_BASE}/v6/users/${tonalUserId}/workout-activities`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "pg-offset": String(offset),
      "pg-limit": String(limit),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401) {
    throw new TonalApiError(401, await res.text().catch(() => "Unauthorized"));
  }
  if (!res.ok) {
    throw new TonalApiError(res.status, await res.text().catch(() => res.statusText));
  }

  const items = (await res.json()) as T[];
  // Tonal sets pg-total on paginated endpoints. If the header is missing or
  // malformed, fall back to the item count so callers don't silently loop
  // against NaN or issue negative-progress requests.
  const rawPgTotal = res.headers.get("pg-total");
  const parsed = rawPgTotal !== null ? Number(rawPgTotal) : Number.NaN;
  // When the header is valid, use it. Otherwise, if the page is full,
  // assume at least one more item exists so callers continue paginating.
  const fallback = items.length >= limit ? items.length + 1 : items.length;
  const pgTotal = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
  return { items, pgTotal };
}

/**
 * Fetch the most recent workout activities (newest first) by reading from the
 * end of the paginated list. Returns up to `count` items, newest first.
 * Used by incremental sync - typically 1 API call instead of 5+.
 */
export async function fetchRecentWorkoutActivities<T>(
  token: string,
  tonalUserId: string,
  count: number = PG_PAGE_SIZE,
): Promise<T[]> {
  // Fetch a full page from offset 0. If pgTotal fits in one page, we're done.
  // Otherwise use pgTotal to jump to the end for the newest items.
  const { items: firstPage, pgTotal } = await fetchWorkoutActivitiesPage<T>(
    token,
    tonalUserId,
    0,
    count,
  );

  if (pgTotal <= count) return firstPage.reverse();

  // User has more than `count` items - fetch the last page from the end
  const startOffset = Math.max(0, pgTotal - count);
  const { items } = await fetchWorkoutActivitiesPage<T>(token, tonalUserId, startOffset, count);
  return items.reverse();
}
