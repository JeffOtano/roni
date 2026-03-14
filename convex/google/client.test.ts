import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleApiError, googleFetch, refreshGoogleToken } from "./client";

const TEST_TOKEN = "ya29.test-access-token";

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => body),
    text: vi.fn(async () => JSON.stringify(body)),
    statusText: "OK",
  } as unknown as Response;
}

function makeErrorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    json: vi.fn(async () => {
      throw new Error("not json");
    }),
    text: vi.fn(async () => body),
    statusText: "Error",
  } as unknown as Response;
}

describe("googleFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns parsed JSON on a successful GET", async () => {
    const payload = { kind: "calendar#event", id: "abc123" };
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(payload));

    const result = await googleFetch<typeof payload>(
      TEST_TOKEN,
      "/calendar/v3/calendars/primary/events",
    );

    expect(result).toEqual(payload);
  });

  it("sends Authorization Bearer header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({}));

    await googleFetch(TEST_TOKEN, "/calendar/v3/calendars/primary/events");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/calendar/v3/calendars/primary/events"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
      }),
    );
  });

  it("sends Content-Type application/json header", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({}));

    await googleFetch(TEST_TOKEN, "/calendar/v3/freeBusy");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("defaults to GET method when no options provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({}));

    await googleFetch(TEST_TOKEN, "/calendar/v3/calendars");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends POST with JSON-serialized body", async () => {
    const requestBody = { timeMin: "2026-03-14T06:00:00Z", timeMax: "2026-03-14T22:00:00Z" };
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({ calendars: {} }));

    await googleFetch(TEST_TOKEN, "/calendar/v3/freeBusy", { method: "POST", body: requestBody });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(requestBody),
      }),
    );
  });

  it("constructs URL using GOOGLE_API_BASE prefix", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({}));

    await googleFetch(TEST_TOKEN, "/calendar/v3/calendars/primary");

    expect(fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      expect.any(Object),
    );
  });

  it("throws GoogleApiError when response is not OK", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorResponse(403, "Calendar access forbidden"));

    await expect(googleFetch(TEST_TOKEN, "/calendar/v3/calendars/primary/events")).rejects.toThrow(
      GoogleApiError,
    );
  });

  it("includes status code in thrown GoogleApiError", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorResponse(403, "Forbidden"));

    await expect(
      googleFetch(TEST_TOKEN, "/calendar/v3/calendars/primary/events"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("includes response body in thrown GoogleApiError", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorResponse(404, "Calendar not found"));

    await expect(
      googleFetch(TEST_TOKEN, "/calendar/v3/calendars/missing/events"),
    ).rejects.toMatchObject({ body: "Calendar not found" });
  });

  it("throws GoogleApiError with 401 for unauthorized requests", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorResponse(401, "Invalid credentials"));

    await expect(googleFetch(TEST_TOKEN, "/calendar/v3/calendars/primary/events")).rejects.toThrow(
      "Google API 401",
    );
  });
});

describe("refreshGoogleToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  it("returns access_token and expires_in on success", async () => {
    const tokenResponse = { access_token: "ya29.new-token", expires_in: 3599 };
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse(tokenResponse));

    const result = await refreshGoogleToken("1//refresh-token");

    expect(result).toEqual(tokenResponse);
  });

  it("posts to the correct token endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({ access_token: "t", expires_in: 3600 }));

    await refreshGoogleToken("my-refresh-token");

    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends grant_type refresh_token in the request body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeOkResponse({ access_token: "t", expires_in: 3600 }));

    await refreshGoogleToken("my-refresh-token");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("my-refresh-token");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");
  });

  it("throws GoogleApiError when token refresh fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeErrorResponse(400, "invalid_grant"));

    await expect(refreshGoogleToken("expired-refresh-token")).rejects.toThrow(GoogleApiError);
  });

  it("throws when GOOGLE_CLIENT_ID is missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(refreshGoogleToken("any-token")).rejects.toThrow(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set",
    );
  });

  it("throws when GOOGLE_CLIENT_SECRET is missing", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    await expect(refreshGoogleToken("any-token")).rejects.toThrow(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set",
    );
  });
});
