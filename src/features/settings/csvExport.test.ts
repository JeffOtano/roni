import { describe, expect, it } from "vitest";
import {
  exercisesToCsv,
  externalActivitiesToCsv,
  strengthScoresToCsv,
  workoutsToCsv,
} from "./csvExport";

describe("workoutsToCsv", () => {
  it("produces header row for empty input", () => {
    const csv = workoutsToCsv([]);
    expect(csv).toBe("Date,Workout,Target Area,Duration (sec),Total Volume (lbs),Total Work,Type");
  });

  it("converts workout rows to CSV", () => {
    const csv = workoutsToCsv([
      {
        date: "2024-01-15",
        title: "Upper Body Strength",
        targetArea: "Upper Body",
        totalDuration: 2100,
        totalVolume: 12500,
        totalWork: 45000,
        workoutType: "strength",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2024-01-15,Upper Body Strength,Upper Body,2100,12500,45000,strength");
  });

  it("escapes values containing quotes", () => {
    const csv = workoutsToCsv([
      {
        date: "2024-01-15",
        title: 'Workout "Intense"',
        targetArea: "Upper Body",
        totalDuration: 2100,
        totalVolume: 12500,
        totalWork: 45000,
        workoutType: "strength",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toContain('"Workout ""Intense"""');
  });

  it("escapes values containing commas", () => {
    const csv = workoutsToCsv([
      {
        date: "2024-01-15",
        title: "Push, Pull, Legs",
        targetArea: "Full Body",
        totalDuration: 3000,
        totalVolume: 20000,
        totalWork: 60000,
        workoutType: "strength",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toContain('"Push, Pull, Legs"');
  });
});

describe("exercisesToCsv", () => {
  it("produces header row for empty input", () => {
    const csv = exercisesToCsv([]);
    expect(csv).toBe(
      "Date,Exercise,Movement ID,Sets,Total Reps,Avg Weight (lbs),Total Volume (lbs)",
    );
  });

  it("converts exercise rows with null values", () => {
    const csv = exercisesToCsv([
      {
        date: "2024-01-15",
        exerciseName: "Bench Press",
        movementId: "mv-123",
        sets: 3,
        totalReps: 24,
        avgWeightLbs: null,
        totalVolume: null,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2024-01-15,Bench Press,mv-123,3,24,,");
  });

  it("includes numeric values when present", () => {
    const csv = exercisesToCsv([
      {
        date: "2024-01-15",
        exerciseName: "Squat",
        movementId: "mv-456",
        sets: 4,
        totalReps: 32,
        avgWeightLbs: 135,
        totalVolume: 4320,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("2024-01-15,Squat,mv-456,4,32,135,4320");
  });
});

describe("strengthScoresToCsv", () => {
  it("produces header row for empty input", () => {
    const csv = strengthScoresToCsv([]);
    expect(csv).toBe("Date,Overall,Upper,Lower,Core");
  });

  it("converts strength score rows", () => {
    const csv = strengthScoresToCsv([
      { date: "2024-01-15", overall: 500, upper: 450, lower: 520, core: 480 },
      { date: "2024-01-22", overall: 510, upper: 460, lower: 530, core: 490 },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("2024-01-15,500,450,520,480");
    expect(lines[2]).toBe("2024-01-22,510,460,530,490");
  });
});

describe("externalActivitiesToCsv", () => {
  it("produces header row for empty input", () => {
    const csv = externalActivitiesToCsv([]);
    expect(csv).toBe(
      "Time,Type,Source,Duration (sec),Active Calories,Total Calories,Avg Heart Rate,Distance",
    );
  });

  it("converts external activity rows", () => {
    const csv = externalActivitiesToCsv([
      {
        workoutType: "Running",
        beginTime: "2024-01-14T08:00:00Z",
        totalDuration: 1800,
        activeCalories: 350,
        totalCalories: 400,
        averageHeartRate: 145,
        source: "Apple Watch",
        distance: 5000,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2024-01-14T08:00:00Z,Running,Apple Watch,1800,350,400,145,5000");
  });
});
