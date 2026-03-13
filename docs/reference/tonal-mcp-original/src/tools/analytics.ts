import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tonal } from "../api-client.js";
import { resolveUserId } from "../user-id.js";
import { getMovementNames } from "./exercises.js";
import type {
  Activity,
  WorkoutActivityDetail,
  StrengthScoreHistoryEntry,
  FormattedWorkoutSummary,
} from "../types.js";

const userIdParam = z
  .string()
  .uuid()
  .optional()
  .describe("Tonal user UUID (omit to use the authenticated user)");

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    "list_workout_history",
    "List recent workout activities with summaries (title, duration, volume, target area)",
    {
      userId: userIdParam,
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of recent workouts to return (default 10, max 50)"),
    },
    async ({ userId, limit }) => {
      const uid = await resolveUserId(userId);
      const activities = await tonal.get<Activity[]>(`/v6/users/${uid}/activities?limit=${limit}`);
      const summaries = activities.map((a) => ({
        activityId: a.activityId,
        date: a.activityTime,
        title: a.workoutPreview?.workoutTitle,
        type: a.workoutPreview?.workoutType,
        coachName: a.workoutPreview?.coachName,
        level: a.workoutPreview?.level,
        targetArea: a.workoutPreview?.targetArea,
        duration: a.workoutPreview?.totalDuration,
        volume: a.workoutPreview?.totalVolume,
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summaries, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "get_workout_detail",
    "Get full detail for a specific workout activity — sets, reps, volume, duration breakdown",
    {
      userId: userIdParam,
      activityId: z.string().uuid().describe("Workout activity UUID"),
    },
    async ({ userId, activityId }) => {
      const uid = await resolveUserId(userId);
      const [detail, names, formatted] = await Promise.all([
        tonal.get<WorkoutActivityDetail>(`/v6/users/${uid}/workout-activities/${activityId}`),
        getMovementNames(),
        tonal
          .get<FormattedWorkoutSummary>(
            `/v6/formatted/users/${uid}/workout-summaries/${activityId}`,
          )
          .catch(() => null),
      ]);

      // Build per-movement volume lookup from formatted summary
      const movementVolume = new Map<string, number>();
      if (formatted?.movementSets) {
        for (const ms of formatted.movementSets) {
          movementVolume.set(ms.movementId, ms.totalVolume);
        }
      }

      // Group sets by movementId for summary
      const byMovement = new Map<string, { reps: number; sets: number; volume: number }>();
      for (const s of detail.workoutSetActivity ?? []) {
        const existing = byMovement.get(s.movementId);
        if (existing) {
          existing.reps += s.prescribedReps ?? 0;
          existing.sets += 1;
        } else {
          byMovement.set(s.movementId, {
            reps: s.prescribedReps ?? 0,
            sets: 1,
            volume: movementVolume.get(s.movementId) ?? 0,
          });
        }
      }

      const exerciseSummary = Array.from(byMovement.entries()).map(([id, data]) => ({
        exerciseName: names.get(id) ?? id,
        sets: data.sets,
        totalReps: data.reps,
        volumeLbs: data.volume,
        avgWeightPerRep:
          data.reps > 0 && data.volume > 0 ? Math.round(data.volume / data.reps) : null,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                workoutType: detail.workoutType,
                beginTime: detail.beginTime,
                endTime: detail.endTime,
                totalDuration: detail.totalDuration,
                activeDuration: detail.activeDuration,
                restDuration: detail.restDuration,
                totalMovements: detail.totalMovements,
                totalSets: detail.totalSets,
                totalReps: detail.totalReps,
                totalVolume: detail.totalVolume,
                percentCompleted: detail.percentCompleted,
                exercises: exerciseSummary,
                sets: detail.workoutSetActivity?.map((s) => ({
                  exerciseName: names.get(s.movementId) ?? "Unknown",
                  reps: s.prescribedReps,
                  block: s.blockNumber,
                  weightPercentage: s.weightPercentage ?? null,
                  spotter: s.spotter,
                  eccentric: s.eccentric,
                  warmUp: s.warmUp,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_workout_movements",
    "Get per-movement performance data for a specific workout — groups sets by exercise with volume, avg weight, and reps",
    {
      userId: userIdParam,
      activityId: z.string().uuid().describe("Workout activity UUID"),
    },
    async ({ userId, activityId }) => {
      const uid = await resolveUserId(userId);
      const [detail, names, formatted] = await Promise.all([
        tonal.get<WorkoutActivityDetail>(`/v6/users/${uid}/workout-activities/${activityId}`),
        getMovementNames(),
        tonal
          .get<FormattedWorkoutSummary>(
            `/v6/formatted/users/${uid}/workout-summaries/${activityId}`,
          )
          .catch(() => null),
      ]);

      // Build per-movement volume lookup from formatted summary
      const movementVolume = new Map<string, number>();
      if (formatted?.movementSets) {
        for (const ms of formatted.movementSets) {
          movementVolume.set(ms.movementId, ms.totalVolume);
        }
      }

      // Group sets by movementId
      const byMovement = new Map<
        string,
        { sets: typeof detail.workoutSetActivity; movementId: string }
      >();
      for (const set of detail.workoutSetActivity ?? []) {
        const existing = byMovement.get(set.movementId);
        if (existing) {
          existing.sets.push(set);
        } else {
          byMovement.set(set.movementId, {
            movementId: set.movementId,
            sets: [set],
          });
        }
      }

      const movements = Array.from(byMovement.values()).map((m) => {
        const totalReps = m.sets.reduce((sum, s) => sum + (s.prescribedReps ?? 0), 0);
        const volume = movementVolume.get(m.movementId) ?? 0;
        return {
          exerciseName: names.get(m.movementId) ?? m.movementId,
          movementId: m.movementId,
          totalSets: m.sets.length,
          totalReps,
          volumeLbs: volume,
          avgWeightPerRep: totalReps > 0 && volume > 0 ? Math.round(volume / totalReps) : null,
          usedSpotter: m.sets.some((s) => s.spotter),
          usedEccentric: m.sets.some((s) => s.eccentric),
          sets: m.sets.map((s) => ({
            reps: s.prescribedReps,
            block: s.blockNumber,
            weightPercentage: s.weightPercentage ?? null,
            repetition: s.repetition,
            repetitionTotal: s.repetitionTotal,
            spotter: s.spotter,
            eccentric: s.eccentric,
            warmUp: s.warmUp,
          })),
        };
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                activityId,
                totalMovements: movements.length,
                movements,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_progress_metrics",
    "Get aggregated workout metrics — volume, frequency, total workouts over time",
    {
      userId: userIdParam,
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Number of recent activities to analyze"),
    },
    async ({ userId, limit }) => {
      const uid = await resolveUserId(userId);
      const activities = await tonal.get<Activity[]>(`/v6/users/${uid}/activities?limit=${limit}`);

      const totalWorkouts = activities.length;
      const totalVolume = activities.reduce(
        (sum, a) => sum + (a.workoutPreview?.totalVolume ?? 0),
        0,
      );
      const totalDuration = activities.reduce(
        (sum, a) => sum + (a.workoutPreview?.totalDuration ?? 0),
        0,
      );

      // Group by target area
      const byTargetArea: Record<string, number> = {};
      for (const a of activities) {
        const area = a.workoutPreview?.targetArea ?? "Unknown";
        byTargetArea[area] = (byTargetArea[area] ?? 0) + 1;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                totalWorkouts,
                totalVolumeLbs: totalVolume,
                totalDurationSeconds: totalDuration,
                avgVolumeLbs: totalWorkouts > 0 ? Math.round(totalVolume / totalWorkouts) : 0,
                avgDurationMinutes:
                  totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts / 60) : 0,
                workoutsByTargetArea: byTargetArea,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_strength_score_history",
    "Get strength score trend over time — upper, lower, core, and overall scores per workout. Essential for tracking progression and plateaus.",
    {
      userId: userIdParam,
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(50)
        .describe("Number of data points to return (default 50)"),
      endDate: z.string().optional().describe("End date in YYYY-MM-DD format (defaults to today)"),
    },
    async ({ userId, limit, endDate }) => {
      const uid = await resolveUserId(userId);
      const params = new URLSearchParams({ limit: String(limit) });
      if (endDate) params.set("endDate", endDate);
      const history = await tonal.get<StrengthScoreHistoryEntry[]>(
        `/v6/users/${uid}/strength-scores/history?${params}`,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                dataPoints: history.length,
                history: history.map((h) => ({
                  date: h.activityTime,
                  overall: h.overall,
                  upper: h.upper,
                  lower: h.lower,
                  core: h.core,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_training_frequency",
    "Get workout frequency breakdown by target area over a time period. Shows sessions per muscle group to spot imbalances and gaps.",
    {
      userId: userIdParam,
      days: z
        .number()
        .int()
        .min(7)
        .max(365)
        .default(30)
        .describe("Number of days to analyze (default 30)"),
    },
    async ({ userId, days }) => {
      const uid = await resolveUserId(userId);
      // Fetch enough activities to cover the time period
      const activities = await tonal.get<Activity[]>(`/v6/users/${uid}/activities?limit=100`);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const inRange = activities.filter((a) => new Date(a.activityTime) >= cutoff);

      // Group by target area with dates
      const byArea: Record<string, { count: number; lastDate: string; totalVolume: number }> = {};
      for (const a of inRange) {
        const area = a.workoutPreview?.targetArea ?? "Unknown";
        const existing = byArea[area];
        if (existing) {
          existing.count += 1;
          existing.totalVolume += a.workoutPreview?.totalVolume ?? 0;
          if (a.activityTime > existing.lastDate) existing.lastDate = a.activityTime;
        } else {
          byArea[area] = {
            count: 1,
            lastDate: a.activityTime,
            totalVolume: a.workoutPreview?.totalVolume ?? 0,
          };
        }
      }

      // Calculate days since last session for each area
      const now = new Date();
      const frequency = Object.entries(byArea)
        .map(([area, data]) => ({
          targetArea: area,
          sessions: data.count,
          totalVolumeLbs: data.totalVolume,
          lastWorkout: data.lastDate,
          daysSinceLastWorkout: Math.round(
            (now.getTime() - new Date(data.lastDate).getTime()) / (1000 * 60 * 60 * 24),
          ),
        }))
        .sort((a, b) => b.sessions - a.sessions);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                periodDays: days,
                totalSessions: inRange.length,
                sessionsPerWeek:
                  inRange.length > 0 ? Math.round((inRange.length / days) * 7 * 10) / 10 : 0,
                byTargetArea: frequency,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
