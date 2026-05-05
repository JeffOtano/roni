import { afterEach, describe, expect, test, vi } from "vitest";
import { createAndScheduleGarminWorkout } from "./trainingApi";
import type { GarminWorkoutPayload } from "./workoutPayload";

const workoutPayload: GarminWorkoutPayload = {
  workoutName: "Push Day",
  description: "Roni workout scheduled for 2026-05-05.",
  sport: "STRENGTH_TRAINING",
  workoutProvider: "Roni",
  workoutSourceId: "roni:plan-1",
  steps: [],
};

describe("createAndScheduleGarminWorkout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("schedules string workout IDs without numeric reparsing", async () => {
    const garminWorkoutId = "900719925474099312345";
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/workout/")) {
        return new Response(JSON.stringify({ workoutId: garminWorkoutId }), { status: 201 });
      }
      if (url.includes("/schedule/")) {
        const body = init?.body;
        if (typeof body !== "string") throw new Error("Expected JSON schedule request body.");
        const scheduleBody: unknown = JSON.parse(body);
        expect(scheduleBody).toEqual({ workoutId: garminWorkoutId, date: "2026-05-05" });
        return new Response(JSON.stringify({ scheduleId: "schedule-1" }), { status: 201 });
      }
      throw new Error(`Unexpected Garmin URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAndScheduleGarminWorkout({
      credentials: {
        consumerKey: "consumer-key",
        consumerSecret: "consumer-secret",
        token: "access-token",
        tokenSecret: "access-token-secret",
      },
      payload: workoutPayload,
      scheduledDate: "2026-05-05",
    });

    expect(result).toEqual({
      garminWorkoutId,
      garminScheduleId: "schedule-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
