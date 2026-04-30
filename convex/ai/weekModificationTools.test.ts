import { describe, expect, test } from "vitest";
import { z } from "zod";
import { addExerciseTool } from "./weekModificationTools";

describe("addExerciseTool input schema", () => {
  test("accepts warmUp:true as a valid argument", () => {
    // inputSchema is a ZodObject at runtime; cast needed because FlexibleSchema
    // is a union type that doesn't uniformly expose safeParse.
    const schema = addExerciseTool.inputSchema as z.ZodObject<z.ZodRawShape>;
    const parsed = schema.safeParse({
      dayIndex: 0,
      movementId: "mov-test",
      sets: 2,
      duration: 30,
      warmUp: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.warmUp).toBe(true);
    }
  });
});
