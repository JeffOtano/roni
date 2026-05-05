import { type OAuth1Credentials, signOAuth1Request } from "./oauth1";
import type { GarminWorkoutPayload } from "./workoutPayload";

const GARMIN_WORKOUT_URL = "https://apis.garmin.com/training-api/workout/";
const GARMIN_SCHEDULE_URL = "https://apis.garmin.com/training-api/schedule/";
const GARMIN_FETCH_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const body = await response.text();
  if (body.trim() === "") return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function extractRemoteId(body: unknown, fieldName: string): string | null {
  if (!isRecord(body)) return null;
  const value = body[fieldName];
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  return null;
}

function statusError(status: number, operation: string): string {
  if (status === 401 || status === 403) {
    return "Garmin authorization is no longer valid. Reconnect Garmin and try again.";
  }
  if (status === 412) {
    return "Garmin workout import permission is not enabled for this connection.";
  }
  if (status === 429) {
    return "Garmin rate-limited workout delivery. Try again later.";
  }
  return `Garmin ${operation} failed with HTTP ${status}.`;
}

async function sendGarminJson(
  credentials: OAuth1Credentials,
  url: string,
  method: "POST" | "DELETE",
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const signed = await signOAuth1Request(credentials, { method, url });
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: signed.authorizationHeader,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(GARMIN_FETCH_TIMEOUT_MS),
  });

  return { status: response.status, body: await parseJsonBody(response) };
}

function workoutIdForSchedule(workoutId: string): string | number {
  const numeric = Number(workoutId);
  return Number.isSafeInteger(numeric) ? numeric : workoutId;
}

async function deleteGarminWorkoutBestEffort(
  credentials: OAuth1Credentials,
  garminWorkoutId: string,
): Promise<void> {
  try {
    await sendGarminJson(
      credentials,
      `${GARMIN_WORKOUT_URL}${encodeURIComponent(garminWorkoutId)}`,
      "DELETE",
    );
  } catch (error) {
    console.error("[garminWorkoutDelivery] failed to clean up unscheduled Garmin workout", {
      garminWorkoutId,
      error,
    });
  }
}

export async function createAndScheduleGarminWorkout({
  credentials,
  payload,
  scheduledDate,
}: {
  credentials: OAuth1Credentials;
  payload: GarminWorkoutPayload;
  scheduledDate: string;
}): Promise<{ garminWorkoutId: string; garminScheduleId?: string }> {
  const workoutResponse = await sendGarminJson(credentials, GARMIN_WORKOUT_URL, "POST", payload);
  if (workoutResponse.status < 200 || workoutResponse.status >= 300) {
    throw new Error(statusError(workoutResponse.status, "workout create"));
  }

  const garminWorkoutId = extractRemoteId(workoutResponse.body, "workoutId");
  if (!garminWorkoutId) {
    throw new Error("Garmin workout create response did not include workoutId.");
  }

  try {
    const scheduleResponse = await sendGarminJson(credentials, GARMIN_SCHEDULE_URL, "POST", {
      workoutId: workoutIdForSchedule(garminWorkoutId),
      date: scheduledDate,
    });
    if (scheduleResponse.status < 200 || scheduleResponse.status >= 300) {
      throw new Error(statusError(scheduleResponse.status, "schedule create"));
    }
    return {
      garminWorkoutId,
      garminScheduleId: extractRemoteId(scheduleResponse.body, "scheduleId") ?? undefined,
    };
  } catch (error) {
    await deleteGarminWorkoutBestEffort(credentials, garminWorkoutId);
    throw error;
  }
}
