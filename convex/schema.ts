import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { blockInputValidator } from "./validators";

export default defineSchema({
  ...authTables,

  /** Override the auth users table to add admin impersonation fields. */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** Whether this user has admin privileges. */
    isAdmin: v.optional(v.boolean()),
    /** When set, the admin sees the app as this user. */
    impersonatingUserId: v.optional(v.id("users")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    tonalUserId: v.string(),
    tonalToken: v.string(),
    tonalEmail: v.optional(v.string()),
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
    /** ISO date of the most recent synced activity (high-water mark for incremental sync). */
    lastSyncedActivityDate: v.optional(v.string()),
    /** Timestamp when profile data was last refreshed from Tonal API. */
    profileDataRefreshedAt: v.optional(v.number()),
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
    /** Which Tonal accessories the user owns (for exercise filtering). */
    ownedAccessories: v.optional(
      v.object({
        smartHandles: v.boolean(),
        smartBar: v.boolean(),
        rope: v.boolean(),
        roller: v.boolean(),
        weightBar: v.boolean(),
        pilatesLoops: v.boolean(),
        ankleStraps: v.boolean(),
      }),
    ),
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
    /** Hours of inactivity before a new chat thread is created. Default: 24. */
    threadStaleHours: v.optional(v.number()),
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
      v.literal("high_external_load"),
      v.literal("consistency_streak"),
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

  movements: defineTable({
    tonalId: v.string(),
    name: v.string(),
    shortName: v.string(),
    muscleGroups: v.array(v.string()),
    skillLevel: v.number(),
    publishState: v.string(),
    sortOrder: v.number(),
    onMachine: v.boolean(),
    inFreeLift: v.boolean(),
    countReps: v.boolean(),
    isTwoSided: v.boolean(),
    isBilateral: v.boolean(),
    isAlternating: v.boolean(),
    descriptionHow: v.string(),
    descriptionWhy: v.string(),
    thumbnailMediaUrl: v.optional(v.string()),
    accessory: v.optional(v.string()),
    onMachineInfo: v.optional(v.any()),
    lastSyncedAt: v.number(),
    trainingTypes: v.optional(v.array(v.string())),
  })
    .index("by_tonalId", ["tonalId"])
    .index("by_accessory", ["accessory"]),

  trainingTypes: defineTable({
    tonalId: v.string(),
    name: v.string(),
    description: v.string(),
    lastSyncedAt: v.number(),
  }).index("by_tonalId", ["tonalId"]),

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

  /** Post-workout feedback (RPE, session rating, notes). */
  workoutFeedback: defineTable({
    userId: v.id("users"),
    /** Links to the Tonal activity ID (from workout history). */
    activityId: v.string(),
    /** Optional link to the workout plan that programmed this session. */
    workoutPlanId: v.optional(v.id("workoutPlans")),
    /** Rate of Perceived Exertion: 1 (very easy) to 10 (max effort). */
    rpe: v.number(),
    /** Overall session rating: 1 (terrible) to 5 (great). */
    rating: v.number(),
    /** Optional free-text notes ("shoulder felt tight", "best session in weeks"). */
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_activityId", ["userId", "activityId"]),

  /** Training blocks (mesocycles) for periodization. */
  trainingBlocks: defineTable({
    userId: v.id("users"),
    /** Block label: "Building Phase", "Deload", etc. */
    label: v.string(),
    /** Block type determines intensity programming. */
    blockType: v.union(v.literal("building"), v.literal("deload"), v.literal("testing")),
    /** Which week number within the block (1-indexed). */
    weekNumber: v.number(),
    /** Total weeks planned for this block. */
    totalWeeks: v.number(),
    /** ISO date string for the Monday this block started. */
    startDate: v.string(),
    /** Set when the block is finished. */
    endDate: v.optional(v.string()),
    /** Active = current block. Only one active per user. */
    status: v.union(v.literal("active"), v.literal("completed")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  /** Measurable training goals with deadlines and progress tracking. */
  goals: defineTable({
    userId: v.id("users"),
    /** e.g. "Increase Bench Press by 20 lbs" */
    title: v.string(),
    /** Category helps the coach prioritize. */
    category: v.union(
      v.literal("strength"),
      v.literal("volume"),
      v.literal("consistency"),
      v.literal("body_composition"),
    ),
    /** Specific metric being tracked (e.g. "bench_press_avg_weight"). */
    metric: v.string(),
    /** Starting value when goal was created. */
    baselineValue: v.number(),
    /** Target value to reach. */
    targetValue: v.number(),
    /** Current value (updated as workouts are completed). */
    currentValue: v.number(),
    /** ISO date string deadline. */
    deadline: v.string(),
    status: v.union(v.literal("active"), v.literal("achieved"), v.literal("abandoned")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  /** Dynamic injury/limitation tracking (replaces static onboarding text). */
  injuries: defineTable({
    userId: v.id("users"),
    /** Body area affected: "left shoulder", "lower back", etc. */
    area: v.string(),
    /** Severity guides programming decisions. */
    severity: v.union(v.literal("mild"), v.literal("moderate"), v.literal("severe")),
    /** What to avoid: "overhead pressing", "heavy deadlifts", etc. */
    avoidance: v.string(),
    /** Optional notes from the user or coach. */
    notes: v.optional(v.string()),
    /** When the injury was first reported. */
    reportedAt: v.number(),
    /** When the injury was resolved (null = still active). */
    resolvedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("resolved")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  /** Procedural memory: coaching observations learned across conversations.
   *  Examples: "user prefers data-driven feedback", "user dislikes Bulgarian split squats",
   *  "user responds well to weekly recaps". Extracted by background process after conversations. */
  coachingNotes: defineTable({
    userId: v.id("users"),
    content: v.string(),
    category: v.union(
      v.literal("preference"),
      v.literal("avoidance"),
      v.literal("response_style"),
      v.literal("pattern"),
      v.literal("insight"),
    ),
    confidence: v.union(v.literal("observed"), v.literal("confirmed")),
    sourceThreadId: v.optional(v.string()),
    createdAt: v.number(),
    lastReferencedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"]),

  /** Pending email change requests with verification codes. */
  emailChangeRequests: defineTable({
    userId: v.id("users"),
    newEmail: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  aiUsage: defineTable({
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
    routedIntent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"]),

  aiToolCalls: defineTable({
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    toolName: v.string(),
    durationMs: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_tool", ["toolName", "createdAt"]),

  /** Permanent record of completed Tonal workouts (synced from activity history). */
  completedWorkouts: defineTable({
    userId: v.id("users"),
    activityId: v.string(),
    date: v.string(),
    title: v.string(),
    targetArea: v.string(),
    totalVolume: v.number(),
    totalDuration: v.number(),
    totalWork: v.number(),
    workoutType: v.string(),
    tonalWorkoutId: v.optional(v.string()),
    syncedAt: v.number(),
  })
    .index("by_userId_activityId", ["userId", "activityId"])
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId", ["userId"]),

  /** Per-exercise performance snapshots from each completed workout. */
  exercisePerformance: defineTable({
    userId: v.id("users"),
    activityId: v.string(),
    movementId: v.string(),
    date: v.string(),
    sets: v.number(),
    totalReps: v.number(),
    avgWeightLbs: v.optional(v.number()),
    totalVolume: v.optional(v.number()),
    syncedAt: v.number(),
  })
    .index("by_userId_movementId", ["userId", "movementId"])
    .index("by_userId_activityId", ["userId", "activityId"])
    .index("by_userId_date", ["userId", "date"]),

  /** Strength score snapshots over time (synced from Tonal history). */
  strengthScoreSnapshots: defineTable({
    userId: v.id("users"),
    date: v.string(),
    overall: v.number(),
    upper: v.number(),
    lower: v.number(),
    core: v.number(),
    workoutActivityId: v.optional(v.string()),
    syncedAt: v.number(),
  })
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId", ["userId"]),

  /** Beta waitlist: email signups for when spots open. */
  waitlist: defineTable({
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),
});
