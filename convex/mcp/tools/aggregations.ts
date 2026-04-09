import type { Activity } from "../../tonal/types";

/** Aggregate progress metrics from a list of workout activities. */
export function aggregateProgressMetrics(activities: Activity[]): {
  totalWorkouts: number;
  totalVolumeLbs: number;
  totalDurationMinutes: number;
  avgVolumeLbs: number;
  avgDurationMinutes: number;
  workoutsByTargetArea: Record<string, number>;
} {
  if (activities.length === 0) {
    return {
      totalWorkouts: 0,
      totalVolumeLbs: 0,
      totalDurationMinutes: 0,
      avgVolumeLbs: 0,
      avgDurationMinutes: 0,
      workoutsByTargetArea: {},
    };
  }

  let totalVolume = 0;
  let totalDuration = 0;
  const byArea: Record<string, number> = {};

  for (const a of activities) {
    totalVolume += a.workoutPreview.totalVolume;
    totalDuration += a.workoutPreview.totalDuration;
    const area = a.workoutPreview.targetArea;
    byArea[area] = (byArea[area] ?? 0) + 1;
  }

  const count = activities.length;
  return {
    totalWorkouts: count,
    totalVolumeLbs: totalVolume,
    totalDurationMinutes: Math.round(totalDuration / 60),
    avgVolumeLbs: Math.round(totalVolume / count),
    avgDurationMinutes: Math.round(totalDuration / 60 / count),
    workoutsByTargetArea: byArea,
  };
}

/** Aggregate training frequency by target area within a date range. */
export function aggregateTrainingFrequency(
  activities: Activity[],
  days: number,
): {
  periodDays: number;
  totalSessions: number;
  sessionsPerWeek: number;
  byTargetArea: Array<{
    targetArea: string;
    sessions: number;
    totalVolumeLbs: number;
    avgVolumeLbs: number;
    lastWorkout: string;
    daysSinceLastWorkout: number;
  }>;
} {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const filtered = activities.filter((a) => new Date(a.activityTime).getTime() >= cutoff);

  const areaMap = new Map<string, { sessions: number; totalVolume: number; lastDate: string }>();

  for (const a of filtered) {
    const area = a.workoutPreview.targetArea;
    const existing = areaMap.get(area);
    if (existing) {
      existing.sessions += 1;
      existing.totalVolume += a.workoutPreview.totalVolume;
      if (a.activityTime > existing.lastDate) existing.lastDate = a.activityTime;
    } else {
      areaMap.set(area, {
        sessions: 1,
        totalVolume: a.workoutPreview.totalVolume,
        lastDate: a.activityTime,
      });
    }
  }

  const byTargetArea = Array.from(areaMap.entries())
    .map(([targetArea, data]) => ({
      targetArea,
      sessions: data.sessions,
      totalVolumeLbs: data.totalVolume,
      avgVolumeLbs: Math.round(data.totalVolume / data.sessions),
      lastWorkout: data.lastDate,
      daysSinceLastWorkout: Math.round((now - new Date(data.lastDate).getTime()) / 86400000),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  return {
    periodDays: days,
    totalSessions: filtered.length,
    sessionsPerWeek: filtered.length > 0 ? Math.round((filtered.length / days) * 7 * 10) / 10 : 0,
    byTargetArea,
  };
}
