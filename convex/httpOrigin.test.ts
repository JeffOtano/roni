import { describe, expect, it } from "vitest";
import { resolveAppOrigin } from "./httpOrigin";

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
  });

  it("allows localhost fallback only outside production", () => {
    expect(resolveAppOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(() => resolveAppOrigin({ NODE_ENV: "production" })).toThrow(
      "GARMIN_OAUTH_POST_REDIRECT_URL or SITE_URL must be configured",
    );
  });
});
