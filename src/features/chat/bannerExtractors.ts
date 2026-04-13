type BannerProps = { variant: "success" | "error"; message: string };
type Extractor = (output: unknown) => BannerProps | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const approveWeekPlan: Extractor = (output) => {
  if (!isRecord(output)) return null;
  if (typeof output.error === "string") {
    return { variant: "error", message: output.error };
  }
  if (typeof output.pushed === "number" && typeof output.failed === "number") {
    if (output.failed > 0) {
      return { variant: "error", message: `${output.pushed} pushed, ${output.failed} failed` };
    }
    return { variant: "success", message: `${output.pushed} workouts pushed to Tonal` };
  }
  return null;
};

function successBoolean(successMsg: string, errorMsg: string): Extractor {
  return (output) => {
    if (!isRecord(output)) return null;
    if (output.success === true) return { variant: "success", message: successMsg };
    if (output.success === false) return { variant: "error", message: errorMsg };
    return null;
  };
}

function deletedBoolean(successMsg: string, errorMsg: string): Extractor {
  return (output) => {
    if (!isRecord(output)) return null;
    if (output.deleted === true) return { variant: "success", message: successMsg };
    if (output.deleted === false) return { variant: "error", message: errorMsg };
    return null;
  };
}

const ACTION_EXTRACTORS: Record<string, Extractor> = {
  approve_week_plan: approveWeekPlan,
  create_workout: successBoolean("Workout created", "Failed to create workout"),
  delete_workout: deletedBoolean("Workout deleted", "Failed to delete workout"),
  delete_week_plan: deletedBoolean("Week plan deleted", "Failed to delete week plan"),
  swap_exercise: successBoolean("Exercise swapped", "Failed to swap exercise"),
  move_session: successBoolean("Session moved", "Failed to move session"),
  adjust_session_duration: successBoolean("Session adjusted", "Failed to adjust session"),
};

export function extractBannerProps(toolName: string, output: unknown): BannerProps | null {
  const extractor = ACTION_EXTRACTORS[toolName];
  if (!extractor) return null;
  return extractor(output);
}
