import { describe, expect, it } from "vitest";
import { parseFormResponse, parsePermissionsResponse } from "./oauthFlow";

describe("parseFormResponse", () => {
  it("decodes form-urlencoded plus signs as spaces", () => {
    expect(parseFormResponse("oauth_token=abc+123&oauth_token_secret=a%2Bb+c")).toEqual({
      oauth_token: "abc 123",
      oauth_token_secret: "a+b c",
    });
  });
});

describe("parsePermissionsResponse", () => {
  it("returns permissions from a valid Garmin response", async () => {
    const response = new Response(JSON.stringify(["ACTIVITY_EXPORT", "HEALTH_EXPORT"]), {
      status: 200,
    });

    await expect(parsePermissionsResponse(response)).resolves.toEqual({
      success: true,
      permissions: ["ACTIVITY_EXPORT", "HEALTH_EXPORT"],
    });
  });

  it("fails closed when Garmin permissions request fails", async () => {
    const response = new Response("Too many requests", { status: 429 });

    await expect(parsePermissionsResponse(response)).resolves.toEqual({
      success: false,
      error: "Garmin permissions failed: 429",
    });
  });

  it("returns success with an empty array when Garmin grants no scopes", async () => {
    const emptyResponse = new Response(JSON.stringify([]), { status: 200 });

    await expect(parsePermissionsResponse(emptyResponse)).resolves.toEqual({
      success: true,
      permissions: [],
    });
  });

  it("fails closed when the response shape is malformed", async () => {
    const malformedResponse = new Response(JSON.stringify({ permissions: ["ACTIVITY_EXPORT"] }), {
      status: 200,
    });
    const invalidJsonResponse = new Response("not-json", { status: 200 });

    await expect(parsePermissionsResponse(malformedResponse)).resolves.toEqual({
      success: false,
      error: "Malformed Garmin permissions response",
    });
    await expect(parsePermissionsResponse(invalidJsonResponse)).resolves.toEqual({
      success: false,
      error: "Malformed Garmin permissions response",
    });
  });
});
