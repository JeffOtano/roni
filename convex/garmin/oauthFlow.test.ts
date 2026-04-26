import { describe, expect, it } from "vitest";
import { parsePermissionsResponse } from "./oauthFlow";

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

  it("fails closed when Garmin permissions are missing or malformed", async () => {
    const emptyResponse = new Response(JSON.stringify([]), { status: 200 });
    const malformedResponse = new Response(JSON.stringify({ permissions: ["ACTIVITY_EXPORT"] }), {
      status: 200,
    });

    await expect(parsePermissionsResponse(emptyResponse)).resolves.toEqual({
      success: false,
      error: "Malformed Garmin permissions response",
    });
    await expect(parsePermissionsResponse(malformedResponse)).resolves.toEqual({
      success: false,
      error: "Malformed Garmin permissions response",
    });
  });
});
