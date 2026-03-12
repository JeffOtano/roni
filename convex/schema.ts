import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    userId: v.id("users"),
    tonalUserId: v.string(),
    tonalToken: v.string(),
    tonalRefreshToken: v.optional(v.string()),
    tonalTokenExpiresAt: v.optional(v.number()),
    profileData: v.optional(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        heightInches: v.number(),
        weightPounds: v.number(),
        gender: v.string(),
        level: v.string(),
        workoutsPerWeek: v.number(),
        workoutDurationMin: v.number(),
        workoutDurationMax: v.number(),
      }),
    ),
    lastActiveAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_tonalUserId", ["tonalUserId"]),

  tonalCache: defineTable({
    userId: v.optional(v.id("users")),
    dataType: v.string(),
    data: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_userId_dataType", ["userId", "dataType"])
    .index("by_dataType", ["dataType"]),

  workoutPlans: defineTable({
    userId: v.id("users"),
    threadId: v.optional(v.string()),
    tonalWorkoutId: v.optional(v.string()),
    title: v.string(),
    blocks: v.any(),
    status: v.union(
      v.literal("draft"),
      v.literal("pushed"),
      v.literal("completed"),
      v.literal("deleted"),
    ),
    estimatedDuration: v.optional(v.number()),
    createdAt: v.number(),
    pushedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
});
