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
 * Paginated fetch from /workout-activities.
 * The Tonal API uses request headers (not query params) for pagination:
 *   pg-offset: starting index, pg-limit: page size, pg-total: response header with count.
 */
export async function fetchAllWorkoutActivities<T>(
  token: string,
  tonalUserId: string,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

   
  while (true) {
    const res = await fetch(`${TONAL_API_BASE}/v6/users/${tonalUserId}/workout-activities`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "pg-offset": String(offset),
        "pg-limit": String(PG_PAGE_SIZE),
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 401) {
      throw new TonalApiError(401, await res.text().catch(() => "Unauthorized"));
    }
    if (!res.ok) {
      throw new TonalApiError(res.status, await res.text().catch(() => res.statusText));
    }

    const page = (await res.json()) as T[];
    all.push(...page);

    const pgTotal = parseInt(res.headers.get("pg-total") ?? "0", 10);
    offset += page.length;

    if (page.length < PG_PAGE_SIZE || offset >= pgTotal) break;
  }

  return all;
}
