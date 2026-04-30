import { describe, expect, it } from "vitest";
import { z } from "zod";
import { KNOWN_TRAINING_TYPES, searchExercisesTool } from "./tools";

describe("searchExercisesTool input schema", () => {
  it("rejects 'Warm-up' as trainingType (not a real catalog tag)", () => {
    const parsed = (searchExercisesTool.inputSchema as z.ZodObject<z.ZodRawShape>).safeParse({
      trainingType: "Warm-up",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts the known catalog trainingTypes", () => {
    for (const t of KNOWN_TRAINING_TYPES) {
      const parsed = (searchExercisesTool.inputSchema as z.ZodObject<z.ZodRawShape>).safeParse({
        trainingType: t,
      });
      expect(parsed.success).toBe(true);
    }
  });
});
