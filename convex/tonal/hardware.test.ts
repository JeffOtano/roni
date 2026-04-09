import { describe, expect, it } from "vitest";
import { activityToCompletedEntry, filterExercises, movementToHardwareExercise } from "./hardware";
import type { Activity, Movement } from "./types";

describe("movementToHardwareExercise", () => {
  it("maps Movement to HardwareExercise with id, name, muscleGroups, equipment", () => {
    const m: Movement = {
      id: "mov-1",
      name: "Bench Press",
      shortName: "Bench",
      muscleGroups: ["Chest", "Triceps"],
      inFreeLift: false,
      onMachine: true,
      countReps: true,
      isTwoSided: false,
      isBilateral: true,
      isAlternating: false,
      descriptionHow: "",
      descriptionWhy: "",
      thumbnailMediaUrl: "",
      skillLevel: 1,
      publishState: "published",
      sortOrder: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "weight",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    };
    expect(movementToHardwareExercise(m)).toEqual({
      id: "mov-1",
      name: "Bench Press",
      muscleGroups: ["Chest", "Triceps"],
      equipment: "Smart Handles",
    });
  });

  it("uses empty muscleGroups when missing and omits equipment when no onMachineInfo", () => {
    const m: Movement = {
      id: "mov-2",
      name: "Squat",
      shortName: "Squat",
      muscleGroups: [],
      inFreeLift: true,
      onMachine: false,
      countReps: true,
      isTwoSided: false,
      isBilateral: true,
      isAlternating: false,
      descriptionHow: "",
      descriptionWhy: "",
      thumbnailMediaUrl: "",
      skillLevel: 1,
      publishState: "published",
      sortOrder: 2,
    };
    expect(movementToHardwareExercise(m)).toEqual({
      id: "mov-2",
      name: "Squat",
      muscleGroups: [],
      equipment: undefined,
    });
  });
});

describe("filterExercises", () => {
  const exercises = [
    { id: "1", name: "A", muscleGroups: ["Chest", "Triceps"], equipment: "Handles" },
    { id: "2", name: "B", muscleGroups: ["Back"], equipment: "Bar" },
    { id: "3", name: "C", muscleGroups: ["Chest"], equipment: "Handles" },
  ];

  it("returns all exercises when no filters", () => {
    expect(filterExercises(exercises)).toEqual(exercises);
  });

  it("filters by muscleGroups (keeps if any group matches)", () => {
    expect(filterExercises(exercises, { muscleGroups: ["Chest"] })).toEqual([
      exercises[0],
      exercises[2],
    ]);
  });

  it("filters by equipment", () => {
    expect(filterExercises(exercises, { equipment: "Bar" })).toEqual([exercises[1]]);
  });

  it("applies both filters when both provided", () => {
    expect(filterExercises(exercises, { muscleGroups: ["Chest"], equipment: "Handles" })).toEqual([
      exercises[0],
      exercises[2],
    ]);
  });
});

describe("activityToCompletedEntry", () => {
  it("maps Activity to CompletedWorkoutEntry", () => {
    const a: Activity = {
      activityId: "act-1",
      userId: "u1",
      activityTime: "2025-03-10T12:00:00Z",
      activityType: "workout",
      workoutPreview: {
        activityId: "act-1",
        workoutId: "w1",
        workoutTitle: "Push Day",
        programName: "",
        coachName: "",
        level: "",
        targetArea: "",
        isGuidedWorkout: false,
        workoutType: "",
        beginTime: "",
        totalDuration: 0,
        totalVolume: 0,
        totalWork: 0,
        totalAchievements: 0,
        activityType: "",
      },
    };
    expect(activityToCompletedEntry(a)).toEqual({
      id: "act-1",
      title: "Push Day",
      completedAt: "2025-03-10T12:00:00Z",
    });
  });
});
