import type { TonalUser } from "./types";

export function toUserProfileData(profile: TonalUser) {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    heightInches: profile.heightInches,
    weightPounds: profile.weightPounds,
    gender: profile.gender,
    level: profile.tonalStatus ?? "",
    workoutsPerWeek: profile.workoutsPerWeek,
    workoutDurationMin: profile.workoutDurationMin ?? 0,
    workoutDurationMax: profile.workoutDurationMax ?? 0,
    dateOfBirth: profile.dateOfBirth || undefined,
    username: profile.username || undefined,
    tonalCreatedAt: profile.createdAt || undefined,
  };
}
