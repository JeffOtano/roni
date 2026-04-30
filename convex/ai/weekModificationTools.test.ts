import { describe, expect, it, test } from "vitest";
import { z } from "zod";
import { rebuildDayTool } from "./rebuildDayTool";
import { addExerciseTool, setWarmupBlockTool } from "./weekModificationTools";

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

// FlexibleSchema -> ZodObject cast required because createTool types inputSchema
// as FlexibleSchema<INPUT> but at runtime it is the z.object(...) we passed in.
const setWarmupBlockSchema = setWarmupBlockTool.inputSchema as z.ZodObject<{
  dayIndex: z.ZodNumber;
  exercises: z.ZodArray<z.ZodObject<Record<string, z.ZodTypeAny>>>;
}>;

describe("setWarmupBlockTool input schema", () => {
  it("rejects empty exercises array", () => {
    const result = setWarmupBlockSchema.safeParse({ dayIndex: 0, exercises: [] });
    expect(result.success).toBe(false);
  });

  it("rejects sets exceeding max of 4", () => {
    const result = (setWarmupBlockTool.inputSchema as z.ZodObject<z.ZodRawShape>).safeParse({
      dayIndex: 0,
      exercises: [{ movementId: "abc-1", sets: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid dayIndex and three exercises", () => {
    const result = setWarmupBlockSchema.safeParse({
      dayIndex: 0,
      exercises: [
        { movementId: "abc-1", sets: 1, reps: 10 },
        { movementId: "abc-2", sets: 1, reps: 10 },
        { movementId: "abc-3", sets: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("rebuildDayTool input schema", () => {
  it("requires at least one block with at least one exercise", () => {
    const empty = (rebuildDayTool.inputSchema as z.ZodObject<z.ZodRawShape>).safeParse({
      dayIndex: 0,
      blocks: [],
    });
    expect(empty.success).toBe(false);

    const emptyExercises = (rebuildDayTool.inputSchema as z.ZodObject<z.ZodRawShape>).safeParse({
      dayIndex: 0,
      blocks: [{ exercises: [] }],
    });
    expect(emptyExercises.success).toBe(false);
  });

  it("accepts a typical 3-block authored workout", () => {
    const ok = (rebuildDayTool.inputSchema as z.ZodObject<z.ZodRawShape>).safeParse({
      dayIndex: 0,
      title: "Pull/Hinge",
      blocks: [
        {
          exercises: [
            { movementId: "a", sets: 2, duration: 30, warmUp: true },
            { movementId: "b", sets: 2, duration: 30, warmUp: true },
          ],
        },
        { exercises: [{ movementId: "c", sets: 3, reps: 10 }] },
        { exercises: [{ movementId: "d", sets: 3, reps: 12 }] },
      ],
    });
    expect(ok.success).toBe(true);
  });
});
