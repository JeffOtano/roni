import { describe, expect, it } from "vitest";
import { safeActivities } from "./weekPlanEnriched";
import type { Activity } from "./tonal/types";

describe("safeActivities", () => {
  it("returns activities on success", async () => {
    const mockActivities: Activity[] = [
      {
        activityId: "a1",
        activityTime: "2026-04-01T10:00:00Z",
        workoutPreview: { workoutId: "w1", workoutTitle: "Push Day" },
      } as Activity,
    ];
    const fetcher = async () => mockActivities;
    const result = await safeActivities(fetcher);
    expect(result).toEqual(mockActivities);
  });

  it("returns empty array and logs when fetcher throws", async () => {
    const fetcher = async (): Promise<Activity[]> => {
      throw new Error("Tonal API 500: Internal Server Error");
    };
    const result = await safeActivities(fetcher);
    expect(result).toEqual([]);
  });
});
