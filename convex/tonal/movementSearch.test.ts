import { describe, expect, it } from "vitest";
import { matchesNameSearch } from "./movementSearch";

const rdl = { name: "RDL", shortName: "RDL" };
const benchPress = { name: "Bench Press", shortName: "Bench Press" };
const bicepCurl = { name: "Bicep Curl", shortName: "Bicep Curl" };
const latPulldown = { name: "Lat Pulldown", shortName: "Lat Pulldown" };
const pushup = { name: "Pushup", shortName: "Pushup" };
const gobletSquat = { name: "Goblet Squat", shortName: "Goblet Squat" };
const tricepExtension = { name: "Triceps Extension", shortName: "Triceps Ext" };
const chestFlye = { name: "Chest Flye", shortName: "Chest Flye" };

describe("matchesNameSearch", () => {
  it("matches exact name", () => {
    expect(matchesNameSearch(benchPress, "Bench Press")).toBe(true);
  });

  it("matches case-insensitive substring", () => {
    expect(matchesNameSearch(benchPress, "bench")).toBe(true);
  });

  it("matches shortName", () => {
    expect(matchesNameSearch(tricepExtension, "Ext")).toBe(true);
  });

  it("matches via alias: common name → abbreviation", () => {
    expect(matchesNameSearch(rdl, "Romanian Deadlift")).toBe(true);
  });

  it("matches via alias: abbreviation → common name", () => {
    const romanianDeadlift = { name: "Romanian Deadlift", shortName: "Romanian Deadlift" };
    expect(matchesNameSearch(romanianDeadlift, "RDL")).toBe(true);
  });

  it("matches word-level: any word from query", () => {
    expect(matchesNameSearch(gobletSquat, "barbell squat")).toBe(true);
  });

  it("matches tricep/triceps alias", () => {
    expect(matchesNameSearch(tricepExtension, "tricep extension")).toBe(true);
  });

  it("matches fly/flye alias", () => {
    expect(matchesNameSearch(chestFlye, "chest fly")).toBe(true);
  });

  it("matches pullup variations", () => {
    expect(matchesNameSearch(pushup, "push-up")).toBe(true);
    expect(matchesNameSearch(pushup, "push up")).toBe(true);
  });

  it("matches lat pulldown variations", () => {
    expect(matchesNameSearch(latPulldown, "lat pull-down")).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchesNameSearch(rdl, "")).toBe(true);
  });

  it("does not match unrelated exercises", () => {
    expect(matchesNameSearch(bicepCurl, "squat")).toBe(false);
    expect(matchesNameSearch(rdl, "bench press")).toBe(false);
  });

  it("skips short words (< 3 chars) for word-level matching", () => {
    // "an" is too short to match on its own
    expect(matchesNameSearch(benchPress, "an")).toBe(false);
  });
});
