import { describe, expect, it } from "vitest";
import { LOCAL_DEV_APP_ORIGIN, resolveAppOrigin } from "./httpOrigin";

describe("resolveAppOrigin", () => {
  it("uses the Garmin post-OAuth redirect URL first", () => {
    expect(
      resolveAppOrigin({
        GARMIN_OAUTH_POST_REDIRECT_URL: "https://app.example.com/garmin/callback",
        SITE_URL: "https://fallback.example.com",
      }),
    ).toBe("https://app.example.com");
  });

  it("falls back to SITE_URL when the Garmin redirect URL is missing or malformed", () => {
    expect(
      resolveAppOrigin({
        GARMIN_OAUTH_POST_REDIRECT_URL: "not-a-url",
        SITE_URL: "https://roni.example.com/settings",
      }),
    ).toBe("https://roni.example.com");
    expect(resolveAppOrigin({ SITE_URL: "https://roni.example.com/settings" })).toBe(
      "https://roni.example.com",
    );
  });

  it("allows localhost fallback only outside production", () => {
    expect(resolveAppOrigin({ NODE_ENV: "development" })).toBe(LOCAL_DEV_APP_ORIGIN);
    expect(() => resolveAppOrigin({ NODE_ENV: "production" })).toThrow(
      "GARMIN_OAUTH_POST_REDIRECT_URL, SITE_URL, or VERCEL_URL must be configured",
    );
  });

  it("uses VERCEL_URL for preview deployments without redirect env vars", () => {
    expect(
      resolveAppOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "preview-roni.vercel.app",
      }),
    ).toBe("https://preview-roni.vercel.app");
  });

  it("fails closed for Vercel deployments without any usable origin", () => {
    expect(() => resolveAppOrigin({ VERCEL_ENV: "preview" })).toThrow(
      "GARMIN_OAUTH_POST_REDIRECT_URL, SITE_URL, or VERCEL_URL must be configured",
    );
  });

  it("fails closed for production Vercel deployments without any usable origin", () => {
    expect(() => resolveAppOrigin({ VERCEL_ENV: "production" })).toThrow(
      "GARMIN_OAUTH_POST_REDIRECT_URL, SITE_URL, or VERCEL_URL must be configured",
    );
  });
});
