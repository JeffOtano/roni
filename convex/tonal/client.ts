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
