import { describe, expect, it } from "vitest";
import { extractSingleGarminUserId, parsePermissionChangePayload } from "./webhookDispatch";

describe("extractSingleGarminUserId", () => {
  it("returns userId from a standard deregistration envelope", () => {
    const payload = {
      deregistrations: [{ userId: "garmin-user-1", userAccessToken: "tok" }],
    };
    expect(extractSingleGarminUserId(payload)).toBe("garmin-user-1");
  });

  it("returns null when envelope is missing deregistrations", () => {
    expect(extractSingleGarminUserId({})).toBeNull();
  });

  it("returns null when deregistrations array is empty", () => {
    expect(extractSingleGarminUserId({ deregistrations: [] })).toBeNull();
  });

  it("returns null when first entry has no userId", () => {
    expect(extractSingleGarminUserId({ deregistrations: [{}] })).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(extractSingleGarminUserId(null)).toBeNull();
    expect(extractSingleGarminUserId("oops")).toBeNull();
    expect(extractSingleGarminUserId(42)).toBeNull();
  });
});

describe("parsePermissionChangePayload", () => {
  it("returns parsed permissions and userId for a typical payload", () => {
    const payload = {
      userPermissionsChange: [
        {
          userId: "garmin-user-2",
          permissions: ["WORKOUT_IMPORT", "ACTIVITY_EXPORT"],
        },
      ],
    };
    expect(parsePermissionChangePayload(payload)).toEqual({
      garminUserId: "garmin-user-2",
      permissions: ["WORKOUT_IMPORT", "ACTIVITY_EXPORT"],
    });
  });

  it("filters non-string permission entries", () => {
    const payload = {
      userPermissionsChange: [
        {
          userId: "u",
          permissions: ["WORKOUT_IMPORT", 42, null, "ACTIVITY_EXPORT"],
        },
      ],
    };
    expect(parsePermissionChangePayload(payload)?.permissions).toEqual([
      "WORKOUT_IMPORT",
      "ACTIVITY_EXPORT",
    ]);
  });

  it("returns empty permissions array when user revokes everything", () => {
    const payload = {
      userPermissionsChange: [{ userId: "u", permissions: [] }],
    };
    expect(parsePermissionChangePayload(payload)).toEqual({
      garminUserId: "u",
      permissions: [],
    });
  });

  it("returns null on malformed envelopes", () => {
    expect(parsePermissionChangePayload(null)).toBeNull();
    expect(parsePermissionChangePayload({})).toBeNull();
    expect(parsePermissionChangePayload({ userPermissionsChange: [] })).toBeNull();
    expect(parsePermissionChangePayload({ userPermissionsChange: [{ userId: "u" }] })).toBeNull();
    expect(
      parsePermissionChangePayload({
        userPermissionsChange: [{ permissions: ["WORKOUT_IMPORT"] }],
      }),
    ).toBeNull();
  });
});
