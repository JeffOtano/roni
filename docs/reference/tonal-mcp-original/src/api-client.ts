import { getAccessToken, invalidateToken } from "./auth.js";

const BASE_URL = "https://api.tonal.com";

class TonalApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Tonal API error ${status}: ${body}`);
    this.name = "TonalApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    invalidateToken();
    return request<T>(method, path, body, true);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new TonalApiError(res.status, text);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

export const tonal = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, body);
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },

  delete(path: string): Promise<void> {
    return request<void>("DELETE", path);
  },
};
