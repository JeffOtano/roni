function escapeCsvValue(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(","));
  return [headerLine, ...dataLines].join("\n");
}

interface WorkoutRow {
  date: string;
  title: string;
  targetArea: string;
  totalDuration: number;
  totalVolume: number;
  totalWork: number;
  workoutType: string;
}

export function workoutsToCsv(workouts: readonly WorkoutRow[]): string {
  const headers = [
    "Date",
    "Workout",
    "Target Area",
    "Duration (sec)",
    "Total Volume (lbs)",
    "Total Work",
    "Type",
  ];
  const rows = workouts.map((w) => [
    w.date,
    w.title,
    w.targetArea,
    w.totalDuration,
    w.totalVolume,
    w.totalWork,
    w.workoutType,
  ]);
  return toCsv(headers, rows);
}

interface ExerciseRow {
  date: string;
  exerciseName: string;
  movementId: string;
  sets: number;
  totalReps: number;
  avgWeightLbs: number | null;
  totalVolume: number | null;
}

export function exercisesToCsv(exercises: readonly ExerciseRow[]): string {
  const headers = [
    "Date",
    "Exercise",
    "Movement ID",
    "Sets",
    "Total Reps",
    "Avg Weight (lbs)",
    "Total Volume (lbs)",
  ];
  const rows = exercises.map((e) => [
    e.date,
    e.exerciseName,
    e.movementId,
    e.sets,
    e.totalReps,
    e.avgWeightLbs ?? "",
    e.totalVolume ?? "",
  ]);
  return toCsv(headers, rows);
}

interface StrengthScoreRow {
  date: string;
  overall: number;
  upper: number;
  lower: number;
  core: number;
}

export function strengthScoresToCsv(scores: readonly StrengthScoreRow[]): string {
  const headers = ["Date", "Overall", "Upper", "Lower", "Core"];
  const rows = scores.map((s) => [s.date, s.overall, s.upper, s.lower, s.core]);
  return toCsv(headers, rows);
}

interface ExternalActivityRow {
  workoutType: string;
  beginTime: string;
  totalDuration: number;
  activeCalories: number;
  totalCalories: number;
  averageHeartRate: number;
  source: string;
  distance: number;
}

export function externalActivitiesToCsv(activities: readonly ExternalActivityRow[]): string {
  const headers = [
    "Time",
    "Type",
    "Source",
    "Duration (sec)",
    "Active Calories",
    "Total Calories",
    "Avg Heart Rate",
    "Distance",
  ];
  const rows = activities.map((a) => [
    a.beginTime,
    a.workoutType,
    a.source,
    a.totalDuration,
    a.activeCalories,
    a.totalCalories,
    a.averageHeartRate,
    a.distance,
  ]);
  return toCsv(headers, rows);
}
