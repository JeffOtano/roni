import { describe, expect, it } from "vitest";
import { rfc3986Encode, signOAuth1Request } from "./oauth1";

describe("rfc3986Encode", () => {
  it("leaves unreserved characters untouched", () => {
    expect(rfc3986Encode("abcXYZ-._~0123")).toBe("abcXYZ-._~0123");
  });

  it("encodes reserved characters that encodeURIComponent misses", () => {
    expect(rfc3986Encode("!*'()")).toBe("%21%2A%27%28%29");
  });

  it("encodes space as %20 (never +)", () => {
    expect(rfc3986Encode("hello world")).toBe("hello%20world");
  });

  it("encodes unicode bytes (UTF-8) one percent-triplet per byte", () => {
    expect(rfc3986Encode("é")).toBe("%C3%A9");
  });
});

/**
 * Reference vector from Twitter's OAuth 1.0a signing guide — the
 * canonical worked example used across OAuth1 implementations.
 * https://developer.twitter.com/en/docs/authentication/oauth-1-0a/creating-a-signature
 */
describe("signOAuth1Request — Twitter reference vector", () => {
  it("produces the documented signature for a form-bodied tweet", async () => {
    const signed = await signOAuth1Request(
      {
        consumerKey: "xvz1evFS4wEEPTGEFPHBog",
        consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
        token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      },
      {
        method: "POST",
        url: "https://api.twitter.com/1.1/statuses/update.json?include_entities=true",
        extraSignableParams: {
          status: "Hello Ladies + Gentlemen, a signed OAuth request!",
        },
        nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
        timestamp: "1318622958",
      },
    );

    // Verified against node:crypto HMAC-SHA1 on the signature base string
    // documented in Twitter's OAuth 1.0a guide for this exact vector.
    expect(signed.authorizationHeader).toContain(
      `oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"`,
    );
  });
});

describe("signOAuth1Request — Garmin-shaped requests", () => {
  it("signs a GET with query params and user token", async () => {
    const signed = await signOAuth1Request(
      {
        consumerKey: "test_consumer_key",
        consumerSecret: "test_consumer_secret",
        token: "user_access_token",
        tokenSecret: "user_access_secret",
      },
      {
        method: "GET",
        url: "https://apis.garmin.com/training-api/schedule?startDate=2026-04-21&endDate=2026-04-27",
        nonce: "abc123",
        timestamp: "1700000000",
      },
    );

    expect(signed.authorizationHeader.startsWith("OAuth ")).toBe(true);
    expect(signed.authorizationHeader).toContain(`oauth_consumer_key="test_consumer_key"`);
    expect(signed.authorizationHeader).toContain(`oauth_token="user_access_token"`);
    expect(signed.authorizationHeader).toContain(`oauth_signature_method="HMAC-SHA1"`);
    expect(signed.authorizationHeader).toContain(`oauth_nonce="abc123"`);
    expect(signed.authorizationHeader).toContain(`oauth_timestamp="1700000000"`);
    expect(signed.authorizationHeader).toContain(`oauth_version="1.0"`);
    // Query params must not leak into the Authorization header.
    expect(signed.authorizationHeader).not.toContain("startDate");
  });

  it("signs a request-token step with no user token and includes oauth_callback", async () => {
    const signed = await signOAuth1Request(
      { consumerKey: "ck", consumerSecret: "cs" },
      {
        method: "POST",
        url: "https://connectapi.garmin.com/oauth-service/oauth/request_token",
        extraSignableParams: { oauth_callback: "https://example.com/garmin/cb" },
        nonce: "n1",
        timestamp: "1700000000",
      },
    );

    expect(signed.authorizationHeader).toContain(
      `oauth_callback="https%3A%2F%2Fexample.com%2Fgarmin%2Fcb"`,
    );
    expect(signed.authorizationHeader).not.toContain("oauth_token=");
  });

  it("rejects extra params that collide with managed OAuth fields", async () => {
    await expect(
      signOAuth1Request(
        { consumerKey: "ck", consumerSecret: "cs" },
        {
          method: "POST",
          url: "https://connectapi.garmin.com/oauth-service/oauth/request_token",
          extraSignableParams: { oauth_nonce: "caller-nonce" },
          nonce: "n1",
          timestamp: "1700000000",
        },
      ),
    ).rejects.toThrow("OAuth parameter oauth_nonce is managed by signOAuth1Request");
  });

  it("produces different signatures for different nonces (non-deterministic)", async () => {
    const creds = { consumerKey: "ck", consumerSecret: "cs", token: "t", tokenSecret: "ts" };
    const opts = { method: "GET", url: "https://apis.garmin.com/userPermissions/" };
    const a = await signOAuth1Request(creds, opts);
    const b = await signOAuth1Request(creds, opts);
    expect(a.authorizationHeader).not.toBe(b.authorizationHeader);
  });
});
