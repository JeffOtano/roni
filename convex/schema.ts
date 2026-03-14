import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { blockInputValidator } from "./validators";

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
    /** When the user first connected their Tonal account (signup for activation analytics). */
    tonalConnectedAt: v.optional(v.number()),
    /** When the user first completed an AI-programmed workout on Tonal (activation). */
    firstAiWorkoutCompletedAt: v.optional(v.number()),
    /** In-app check-in preferences. Omitted = enabled with default frequency. */
    checkInPreferences: v.optional(
      v.object({
        enabled: v.boolean(),
        frequency: v.union(v.literal("daily"), v.literal("every_other_day"), v.literal("weekly")),
        muted: v.boolean(),
      }),
    ),
    /** Timestamp before which all check-ins are considered read (single-write "mark all read"). */
    checkInsReadAllBeforeAt: v.optional(v.number()),
    /** Allow AI to analyze progress photos (guardrails apply). */
    progressPhotoAnalysisEnabled: v.optional(v.boolean()),
    /** User's training preferences for weekly programming. */
    trainingPreferences: v.optional(
      v.object({
        preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
        trainingDays: v.array(v.number()), // 0=Mon..6=Sun
        sessionDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
      }),
    ),
    /** Onboarding questionnaire data. */
    onboardingData: v.optional(
      v.object({
        goal: v.string(),
        injuries: v.optional(v.string()),
        completedAt: v.number(),
      }),
    ),
    /** Google Calendar OAuth integration fields. */
    googleCalendarToken: v.optional(v.string()),
    googleCalendarRefreshToken: v.optional(v.string()),
    googleCalendarTokenExpiresAt: v.optional(v.number()),
    googleCalendarEnabled: v.optional(v.boolean()),
    googleCalendarId: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_tonalUserId", ["tonalUserId"])
    .index("by_tonalTokenExpiresAt", ["tonalTokenExpiresAt"]),

  /** In-app check-ins (proactive messages). No SMS. */
  checkIns: defineTable({
    userId: v.id("users"),
    trigger: v.union(
      v.literal("missed_session"),
      v.literal("gap_3_days"),
      v.literal("tough_session_completed"),
      v.literal("weekly_recap"),
      v.literal("strength_milestone"),
      v.literal("plateau"),
    ),
    message: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
    triggerContext: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_readAt", ["userId", "readAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

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
    source: v.optional(v.string()),
    title: v.string(),
    blocks: blockInputValidator,
    status: v.union(
      v.literal("draft"),
      v.literal("pushing"),
      v.literal("pushed"),
      v.literal("completed"),
      v.literal("deleted"),
      v.literal("failed"),
    ),
    pushErrorReason: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
    createdAt: v.number(),
    pushedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  weekPlans: defineTable({
    userId: v.id("users"),
    weekStartDate: v.string(),
    preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
    targetDays: v.number(),
    days: v.array(
      v.object({
        sessionType: v.union(
          v.literal("push"),
          v.literal("pull"),
          v.literal("legs"),
          v.literal("upper"),
          v.literal("lower"),
          v.literal("full_body"),
          v.literal("recovery"),
          v.literal("rest"),
        ),
        status: v.union(
          v.literal("programmed"),
          v.literal("completed"),
          v.literal("missed"),
          v.literal("rescheduled"),
        ),
        workoutPlanId: v.optional(v.id("workoutPlans")),
        estimatedDuration: v.optional(v.number()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_weekStartDate", ["userId", "weekStartDate"]),

  /** Progress photos: encrypted storage, user-only access. */
  progressPhotos: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  /** Time-limited, single-use OAuth state tokens for CSRF protection. */
  oauthStates: defineTable({
    token: v.string(),
    userId: v.id("users"),
    origin: v.string(),
    createdAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  /** MCP API keys for Claude Desktop/Code integration. */
  mcpApiKeys: defineTable({
    userId: v.id("users"),
    keyHash: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_userId", ["userId"]),

  /** MCP usage tracking for analytics. */
  mcpUsage: defineTable({
    userId: v.id("users"),
    keyId: v.id("mcpApiKeys"),
    tool: v.string(),
    calledAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_calledAt", ["userId", "calledAt"]),

  /** Pending email change requests with verification codes. */
  emailChangeRequests: defineTable({
    userId: v.id("users"),
    newEmail: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
});
