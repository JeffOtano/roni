import { describe, expect, it } from "vitest";
import {
  extractGarminUserIdsFromDeregistration,
  groupSummaryEntriesByUser,
  parsePermissionChangePayload,
} from "./webhookPayloads";

describe("extractGarminUserIdsFromDeregistration", () => {
  it("returns userIds from a standard deregistration envelope", () => {
    const payload = {
      deregistrations: [{ userId: "garmin-user-1", userAccessToken: "tok" }],
    };
    expect(extractGarminUserIdsFromDeregistration(payload)).toEqual(["garmin-user-1"]);
  });

  it("deduplicates batched deregistration userIds", () => {
    const payload = {
      deregistrations: [
        { userId: "garmin-user-1" },
        { userId: "garmin-user-2" },
        { userId: "garmin-user-1" },
      ],
    };
    expect(extractGarminUserIdsFromDeregistration(payload)).toEqual([
      "garmin-user-1",
      "garmin-user-2",
    ]);
  });

  it("returns an empty array when envelope is missing deregistrations", () => {
    expect(extractGarminUserIdsFromDeregistration({})).toEqual([]);
  });

  it("returns an empty array when deregistrations array is empty", () => {
    expect(extractGarminUserIdsFromDeregistration({ deregistrations: [] })).toEqual([]);
  });

  it("returns an empty array when entries have no userId", () => {
    expect(extractGarminUserIdsFromDeregistration({ deregistrations: [{}] })).toEqual([]);
  });

  it("returns an empty array for non-object payloads", () => {
    expect(extractGarminUserIdsFromDeregistration(null)).toEqual([]);
    expect(extractGarminUserIdsFromDeregistration("oops")).toEqual([]);
    expect(extractGarminUserIdsFromDeregistration(42)).toEqual([]);
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
    expect(parsePermissionChangePayload(payload)).toEqual([
      {
        garminUserId: "garmin-user-2",
        permissions: ["WORKOUT_IMPORT", "ACTIVITY_EXPORT"],
      },
    ]);
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
    expect(parsePermissionChangePayload(payload)[0]?.permissions).toEqual([
      "WORKOUT_IMPORT",
      "ACTIVITY_EXPORT",
    ]);
  });

  it("returns empty permissions array when user revokes everything", () => {
    const payload = {
      userPermissionsChange: [{ userId: "u", permissions: [] }],
    };
    expect(parsePermissionChangePayload(payload)).toEqual([
      {
        garminUserId: "u",
        permissions: [],
      },
    ]);
  });

  it("returns every permission change in a batched payload", () => {
    const payload = {
      userPermissionsChange: [
        { userId: "u1", permissions: ["ACTIVITY_EXPORT"] },
        { userId: "u2", permissions: [] },
      ],
    };
    expect(parsePermissionChangePayload(payload)).toEqual([
      { garminUserId: "u1", permissions: ["ACTIVITY_EXPORT"] },
      { garminUserId: "u2", permissions: [] },
    ]);
  });

  it("returns an empty array on malformed envelopes", () => {
    expect(parsePermissionChangePayload(null)).toEqual([]);
    expect(parsePermissionChangePayload({})).toEqual([]);
    expect(parsePermissionChangePayload({ userPermissionsChange: [] })).toEqual([]);
    expect(parsePermissionChangePayload({ userPermissionsChange: [{ userId: "u" }] })).toEqual([]);
    expect(
      parsePermissionChangePayload({
        userPermissionsChange: [{ permissions: ["WORKOUT_IMPORT"] }],
      }),
    ).toEqual([]);
  });
});

describe("groupSummaryEntriesByUser", () => {
  it("splits a summary envelope into per-user payloads", () => {
    const payload = {
      activities: [
        { userId: "u1", summaryId: "a1" },
        { userId: "u2", summaryId: "a2" },
        { userId: "u1", summaryId: "a3" },
        { summaryId: "missing-user" },
      ],
    };

    expect(groupSummaryEntriesByUser("activities", payload)).toEqual([
      {
        garminUserId: "u1",
        payload: {
          activities: [
            { userId: "u1", summaryId: "a1" },
            { userId: "u1", summaryId: "a3" },
          ],
        },
      },
      {
        garminUserId: "u2",
        payload: { activities: [{ userId: "u2", summaryId: "a2" }] },
      },
    ]);
  });
});
