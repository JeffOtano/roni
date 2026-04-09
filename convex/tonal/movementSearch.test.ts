import { describe, expect, it } from "vitest";
import { matchesNameSearch } from "./movementSearch";

const rdl = {
  name: "RDL",
  shortName: "RDL",
  descriptionHow:
    "Stand with feet hip-width apart. Hinge at the hips, pushing them back while keeping a slight bend in the knees. Lower the handles along your legs until you feel a stretch in your hamstrings, then drive your hips forward to return to standing. This is also known as a Romanian Deadlift.",
  descriptionWhy: "Strengthens the posterior chain — hamstrings, glutes, and lower back.",
};

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

  it("matches common name via description (RDL → Romanian Deadlift)", () => {
    expect(matchesNameSearch(rdl, "Romanian Deadlift")).toBe(true);
  });

  it("matches via descriptionWhy", () => {
    expect(matchesNameSearch(rdl, "posterior chain")).toBe(true);
  });

  it("matches word-level: any word from query in description", () => {
    expect(matchesNameSearch(rdl, "hamstring exercise")).toBe(true);
  });

  it("matches word-level: any word from query in name", () => {
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
    expect(matchesNameSearch(benchPress, "an")).toBe(false);
  });

  it("works without description fields", () => {
    expect(matchesNameSearch({ name: "RDL", shortName: "RDL" }, "RDL")).toBe(true);
  });

  it("matches abbreviation aliases (RDL ↔ Romanian Deadlift)", () => {
    expect(matchesNameSearch({ name: "RDL", shortName: "RDL" }, "Romanian Deadlift")).toBe(true);
    expect(
      matchesNameSearch({ name: "Romanian Deadlift", shortName: "Romanian Deadlift" }, "RDL"),
    ).toBe(true);
  });

  it("matches OHP ↔ Overhead Press alias", () => {
    expect(matchesNameSearch({ name: "OHP", shortName: "OHP" }, "overhead press")).toBe(true);
  });

  // Gym name → Tonal name aliases
  it("matches face pull → standing face pull", () => {
    const standingFacePull = { name: "Standing Face Pull", shortName: "Standing Face Pull" };
    expect(matchesNameSearch(standingFacePull, "face pull")).toBe(true);
  });

  it("matches rear delt fly → reverse fly via multi-word alias", () => {
    const reverseFly = { name: "Reverse Fly", shortName: "Reverse Fly" };
    expect(matchesNameSearch(reverseFly, "rear delt fly")).toBe(true);
  });

  it("matches french press → overhead triceps extension", () => {
    const ohe = { name: "Overhead Triceps Extension", shortName: "Overhead Triceps Ext" };
    expect(matchesNameSearch(ohe, "french press")).toBe(true);
  });

  it("matches lying tricep extension → skull crusher", () => {
    const skullCrusher = { name: "Skull Crusher", shortName: "Skull Crusher" };
    expect(matchesNameSearch(skullCrusher, "lying tricep extension")).toBe(true);
  });

  it("matches plank → pillar bridge via alias", () => {
    const pillarBridge = { name: "Pillar Bridge", shortName: "Pillar Bridge" };
    expect(matchesNameSearch(pillarBridge, "plank")).toBe(true);
  });

  it("matches shoulder press → standing overhead press", () => {
    const sop = { name: "Standing Overhead Press", shortName: "Standing Overhead Press" };
    expect(matchesNameSearch(sop, "shoulder press")).toBe(true);
  });

  it("matches lat raise → lateral raise", () => {
    const lateralRaise = { name: "Lateral Raise", shortName: "Lateral Raise" };
    expect(matchesNameSearch(lateralRaise, "lat raise")).toBe(true);
  });

  it("matches hamstring curl → prone bench hamstring curl", () => {
    const pbhc = { name: "Prone Bench Hamstring Curl", shortName: "Prone Bench Hamstring Curl" };
    expect(matchesNameSearch(pbhc, "hamstring curl")).toBe(true);
  });
});
