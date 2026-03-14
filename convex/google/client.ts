const GOOGLE_API_BASE = "https://www.googleapis.com";

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Google API ${status}: ${body}`);
    this.name = "GoogleApiError";
  }
}

export async function googleFetch<T>(
  token: string,
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${GOOGLE_API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new GoogleApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new GoogleApiError(res.status, `Token refresh failed: ${body}`);
  }

  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}
