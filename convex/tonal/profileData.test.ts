import { describe, expect, it } from "vitest";
import { toUserProfileData } from "./profileData";
import type { TonalUser } from "./types";

function buildTonalUser(overrides: Partial<TonalUser> = {}): TonalUser {
  return {
    id: "tonal-user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    username: "ada",
    gender: "female",
    dateOfBirth: "1990-12-10",
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-03T00:00:00.000Z",
    heightInches: 65,
    weightPounds: 135,
    auth0Id: "auth0|ada",
    workoutsPerWeek: 4,
    workoutDurationMin: 30,
    workoutDurationMax: 45,
    tonalStatus: "advanced",
    accountType: "trial",
    location: "Denver",
    ...overrides,
  };
}

describe("toUserProfileData", () => {
  it("maps Tonal profile fields into the userProfiles shape", () => {
    const tonalUser = buildTonalUser();

    const result = toUserProfileData(tonalUser);

    expect(result).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      heightInches: 65,
      weightPounds: 135,
      gender: "female",
      level: "advanced",
      workoutsPerWeek: 4,
      workoutDurationMin: 30,
      workoutDurationMax: 45,
      dateOfBirth: "1990-12-10",
      username: "ada",
      tonalCreatedAt: "2024-01-02T00:00:00.000Z",
    });
  });

  it("fills optional Tonal fields with the stored defaults", () => {
    const tonalUser = buildTonalUser({
      username: "",
      dateOfBirth: "",
      createdAt: "",
      tonalStatus: "",
    });

    const result = toUserProfileData(tonalUser);

    expect(result).toMatchObject({
      level: "",
      dateOfBirth: undefined,
      username: undefined,
      tonalCreatedAt: undefined,
    });
  });
});
