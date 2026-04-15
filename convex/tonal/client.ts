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
async function fetchWorkoutActivitiesPage<T>(
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
  const pgTotal = parseInt(res.headers.get("pg-total") ?? "0", 10);
  return { items, pgTotal };
}

/**
 * Paginated fetch of ALL /workout-activities (oldest to newest).
 * Used by backfill to get complete history.
 */
export async function fetchAllWorkoutActivities<T>(
  token: string,
  tonalUserId: string,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { items, pgTotal } = await fetchWorkoutActivitiesPage<T>(token, tonalUserId, offset);
    all.push(...items);
    offset += items.length;
    if (items.length < PG_PAGE_SIZE || offset >= pgTotal) break;
  }

  return all;
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
  // First call with offset=0 just to get pgTotal from the response header
  const { pgTotal } = await fetchWorkoutActivitiesPage<T>(token, tonalUserId, 0, 1);

  if (pgTotal === 0) return [];
  if (pgTotal <= count) {
    // Small enough to fetch everything in one shot
    const { items } = await fetchWorkoutActivitiesPage<T>(token, tonalUserId, 0, pgTotal);
    return items.reverse();
  }

  // Fetch the last `count` items from the end
  const startOffset = Math.max(0, pgTotal - count);
  const { items } = await fetchWorkoutActivitiesPage<T>(token, tonalUserId, startOffset, count);
  return items.reverse();
}
