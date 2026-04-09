import { v } from "convex/values";

/** Convex validator for workout exercise blocks (matches ExerciseInput/BlockInput types). */
export const blockInputValidator = v.array(
  v.object({
    exercises: v.array(
      v.object({
        movementId: v.string(),
        sets: v.number(),
        reps: v.optional(v.number()),
        duration: v.optional(v.number()),
        spotter: v.optional(v.boolean()),
        eccentric: v.optional(v.boolean()),
        chains: v.optional(v.boolean()),
        burnout: v.optional(v.boolean()),
        dropSet: v.optional(v.boolean()),
        warmUp: v.optional(v.boolean()),
      }),
    ),
  }),
);
