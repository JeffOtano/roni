/** Minimal workout metadata used to label synced Tonal activities. */
export interface WorkoutMeta {
  title?: string;
  targetArea?: string;
  programName?: string;
}

const RAW_WORKOUT_CODE_RE = /^WO\d+(?:\s*\(([^)]+)\))?$/i;
const DEFAULT_WORKOUT_TITLE = "Tonal Workout";

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function firstStringField(...values: unknown[]): string | undefined {
  for (const value of values) {
    const stringValue = stringField(value);
    if (stringValue) return stringValue;
  }
  return undefined;
}

export function projectWorkoutMeta(raw: unknown): WorkoutMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const candidate = raw as {
    title?: unknown;
    targetArea?: unknown;
    programName?: unknown;
    programTitle?: unknown;
    workoutProgramName?: unknown;
  };
  const meta: WorkoutMeta = {};
  const title = stringField(candidate.title);
  const targetArea = stringField(candidate.targetArea);
  const programName = firstStringField(
    candidate.programName,
    candidate.programTitle,
    candidate.workoutProgramName,
  );
  if (title) meta.title = title;
  if (targetArea) meta.targetArea = targetArea;
  if (programName) meta.programName = programName;
  return meta;
}

function extractProgramSessionCode(title: string): string | undefined {
  return RAW_WORKOUT_CODE_RE.exec(title)?.[1];
}

function isRawWorkoutCode(title: string): boolean {
  return RAW_WORKOUT_CODE_RE.test(title);
}

export function formatWorkoutDisplayTitle(meta?: WorkoutMeta): string {
  const title = stringField(meta?.title);
  const programName = stringField(meta?.programName);

  if (programName) {
    const sessionCode = title ? extractProgramSessionCode(title) : undefined;
    if (sessionCode) return `${programName} - ${sessionCode}`;
    if (title && !isRawWorkoutCode(title) && title !== programName) {
      return `${programName} - ${title}`;
    }
    return programName;
  }

  if (title && isRawWorkoutCode(title)) {
    return extractProgramSessionCode(title) ?? DEFAULT_WORKOUT_TITLE;
  }

  return title ?? DEFAULT_WORKOUT_TITLE;
}
