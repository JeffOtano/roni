import { describe, expect, it } from "vitest";
import { type SnapshotSection, trimSnapshot } from "./context";

describe("trimSnapshot", () => {
  const makeSection = (priority: number, text: string): SnapshotSection => ({
    priority,
    lines: [text],
  });

  it("returns all sections when under budget", () => {
    const sections = [
      makeSection(1, "User: Alice | 65in/140lbs"),
      makeSection(5, "Training Block: Building Week 2/4"),
    ];
    const result = trimSnapshot(sections, 4000);
    expect(result).toContain("Alice");
    expect(result).toContain("Training Block");
  });

  it("drops lowest-priority sections first when over budget", () => {
    const sections = [
      makeSection(1, "User: Alice | 65in/140lbs"),
      makeSection(11, "Missed: Monday Push was programmed but not completed"),
      makeSection(10, "Performance: Volume up 15%"),
    ];
    const result = trimSnapshot(sections, 80);
    expect(result).toContain("Alice");
    expect(result).not.toContain("Missed");
    expect(result).not.toContain("Performance");
  });

  it("keeps header and footer regardless of budget", () => {
    const sections = [makeSection(1, "User: Alice")];
    const result = trimSnapshot(sections, 10);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
    expect(result).not.toContain("Alice");
  });

  it("handles empty sections array", () => {
    const result = trimSnapshot([], 4000);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
  });

  it("drops multiple low-priority sections to fit budget", () => {
    const sections = [
      makeSection(1, "User: Alice"),
      makeSection(3, "Injuries: left shoulder (mild)"),
      makeSection(7, "Scores: Upper 450, Lower 380"),
      makeSection(8, "Readiness: Chest 85, Back 72"),
      makeSection(9, "Workout: 2026-03-15 | Push Day"),
      makeSection(10, "Performance: Volume up 15%"),
      makeSection(11, "Missed: Monday Push"),
    ];
    // Budget of 150 should fit header(25)+footer(18)+2newlines + User(12) + Injuries(31) + Scores(28) = ~116
    const result = trimSnapshot(sections, 150);
    expect(result).toContain("Alice");
    expect(result).toContain("Injuries");
    expect(result).not.toContain("Missed");
    expect(result).not.toContain("Performance");
  });
});
