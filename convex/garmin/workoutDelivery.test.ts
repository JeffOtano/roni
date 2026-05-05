/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { TONAL_REST_MOVEMENT_ID } from "../tonal/transforms";
import {
  buildGarminStrengthWorkoutPayloadFromPlan,
  inferGarminExerciseCategory,
} from "./workoutPayload";

const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
// This glob is relative to this test file; convexTest expects keys rooted at convex/.
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../garmin/" + key.slice(2) : key] = value;
}

const FIXED_PLAN_CREATED_AT = 1_714_000_000_000;

function sampleMovement(id: string, name: string, countReps = true) {
  return {
    id,
    name,
    shortName: name,
    muscleGroups: [],
    inFreeLift: true,
    onMachine: true,
    countReps,
    isTwoSided: false,
    isBilateral: true,
    isAlternating: false,
    descriptionHow: "",
    descriptionWhy: "",
    skillLevel: 1,
    publishState: "published",
    sortOrder: 1,
  };
}

async function seedPlan(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const workoutPlanId = await ctx.db.insert("workoutPlans", {
      userId,
      title: "Push Day",
      blocks: [{ exercises: [{ movementId: "bench", sets: 2, reps: 8 }] }],
      status: "pushed",
      createdAt: FIXED_PLAN_CREATED_AT,
    });
    return { userId, workoutPlanId };
  });
}

describe("inferGarminExerciseCategory", () => {
  test("maps common Tonal names onto Garmin strength categories", () => {
    expect(inferGarminExerciseCategory("Barbell Bench Press")).toBe("BENCH_PRESS");
    expect(inferGarminExerciseCategory("Goblet Squat")).toBe("SQUAT");
    expect(inferGarminExerciseCategory("Standing Biceps Curl")).toBe("CURL");
  });

  test("falls back to UNKNOWN for unmatched exercise names", () => {
    expect(inferGarminExerciseCategory("Tonal Special Movement")).toBe("UNKNOWN");
  });
});

describe("buildGarminStrengthWorkoutPayloadFromPlan", () => {
  test("expands Roni blocks into Garmin strength workout steps", () => {
    const payload = buildGarminStrengthWorkoutPayloadFromPlan({
      workoutPlanId: "plan-1",
      title: "Push Day",
      scheduledDate: "2026-05-05",
      movements: [sampleMovement("bench", "Bench Press")],
      blocks: [
        {
          exercises: [
            { movementId: "bench", sets: 2, reps: 8 },
            { movementId: TONAL_REST_MOVEMENT_ID, sets: 2, duration: 90 },
          ],
        },
      ],
    });

    expect(payload).toMatchObject({
      workoutName: "Push Day",
      sport: "STRENGTH_TRAINING",
      workoutProvider: "Roni",
      workoutSourceId: "roni:plan-1",
    });
    expect(payload.steps).toHaveLength(4);
    expect(payload.steps[0]).toMatchObject({
      stepOrder: 1,
      intensity: "INTERVAL",
      durationType: "REPS",
      durationValue: 8,
      exerciseCategory: "BENCH_PRESS",
      exerciseName: "Bench Press",
    });
    expect(payload.steps[1]).toMatchObject({
      stepOrder: 2,
      intensity: "REST",
      durationType: "TIME",
      durationValue: 90,
      exerciseName: "Rest",
    });
  });

  test("uses time duration for duration-based movements", () => {
    const payload = buildGarminStrengthWorkoutPayloadFromPlan({
      workoutPlanId: "plan-1",
      title: "Core",
      scheduledDate: "2026-05-05",
      movements: [sampleMovement("plank", "Plank", false)],
      blocks: [{ exercises: [{ movementId: "plank", sets: 1 }] }],
    });

    expect(payload.steps[0]).toMatchObject({
      durationType: "TIME",
      durationValue: 30,
      exerciseCategory: "PLANK",
    });
  });

  test("rejects empty workouts before calling Garmin", () => {
    expect(() =>
      buildGarminStrengthWorkoutPayloadFromPlan({
        workoutPlanId: "plan-1",
        title: "Empty",
        scheduledDate: "2026-05-05",
        movements: [],
        blocks: [],
      }),
    ).toThrow("Workout has no exercises to send to Garmin");
  });
});

describe("garminWorkoutDeliveries", () => {
  test("claims a delivery exactly once while it is in progress", async () => {
    const t = convexTest(schema, modules);
    const { userId, workoutPlanId } = await seedPlan(t);

    const first = await t.mutation(internal.garmin.workoutDelivery.startDeliveryAttempt, {
      userId,
      workoutPlanId,
      scheduledDate: "2026-05-05",
    });
    const second = await t.mutation(internal.garmin.workoutDelivery.startDeliveryAttempt, {
      userId,
      workoutPlanId,
      scheduledDate: "2026-05-05",
    });

    expect(first.state).toBe("claimed");
    expect(second).toEqual({ state: "in_progress" });
  });

  test("returns sent deliveries instead of creating duplicates", async () => {
    const t = convexTest(schema, modules);
    const { userId, workoutPlanId } = await seedPlan(t);
    const claim = await t.mutation(internal.garmin.workoutDelivery.startDeliveryAttempt, {
      userId,
      workoutPlanId,
      scheduledDate: "2026-05-05",
    });
    if (claim.state !== "claimed") throw new Error("Expected delivery claim");

    await t.mutation(internal.garmin.workoutDelivery.markDeliverySent, {
      deliveryId: claim.deliveryId as Id<"garminWorkoutDeliveries">,
      garminWorkoutId: "123",
      garminScheduleId: "456",
    });
    const duplicate = await t.mutation(internal.garmin.workoutDelivery.startDeliveryAttempt, {
      userId,
      workoutPlanId,
      scheduledDate: "2026-05-05",
    });

    expect(duplicate.state).toBe("already_sent");
    if (duplicate.state === "already_sent") {
      expect(duplicate.delivery).toMatchObject({
        status: "sent",
        garminWorkoutId: "123",
        garminScheduleId: "456",
      });
    }
  });
});
