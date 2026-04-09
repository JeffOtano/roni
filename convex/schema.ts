import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { blockInputValidator } from "./validators";

export default defineSchema({
  ...authTables,

  /** Override the auth users table to add Tonal profile fields. */
  users: defineTable({
    name: v.optional(v.string()),
    /** First name from Tonal profile. */
    firstName: v.optional(v.string()),
    /** Last name from Tonal profile. */
    lastName: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
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
        dateOfBirth: v.optional(v.string()),
        username: v.optional(v.string()),
        tonalCreatedAt: v.optional(v.string()),
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
    /** Hours of inactivity before a new chat thread is created. Default: 24. */
    threadStaleHours: v.optional(v.number()),
    // BYOK Gemini key, encrypted with TOKEN_ENCRYPTION_KEY.
    geminiApiKeyEncrypted: v.optional(v.string()),
    geminiApiKeyAddedAt: v.optional(v.number()),
    /** Timestamp when a token refresh started. Used to prevent concurrent refreshes. */
    tokenRefreshInProgress: v.optional(v.number()),
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

  /** Tonal API response cache with TTL (stale-while-revalidate pattern). */
  tonalCache: defineTable({
    userId: v.optional(v.id("users")),
    dataType: v.string(),
    data: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_userId_dataType", ["userId", "dataType"])
    .index("by_dataType", ["dataType"]),

  /** Tonal exercise catalog (synced daily at 3 AM from Tonal API). */
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
    baseOfSupport: v.optional(v.string()),
    bodyRegion: v.optional(v.string()),
    bodyRegionDisplay: v.optional(v.string()),
    compatibilityStatus: v.optional(v.any()),
    tonalCreatedAt: v.optional(v.string()),
    tonalUpdatedAt: v.optional(v.string()),
    eliteImageAssetId: v.optional(v.string()),
    family: v.optional(v.string()),
    familyDisplay: v.optional(v.string()),
    featureGroupIds: v.optional(v.any()),
    hiddenInMovePicker: v.optional(v.boolean()),
    hideReps: v.optional(v.boolean()),
    imageAssetId: v.optional(v.string()),
    isGeneric: v.optional(v.boolean()),
    offMachineAccessories: v.optional(v.any()),
    offMachineAccessory: v.optional(v.any()),
    pushPull: v.optional(v.string()),
    relatedGenericMovementIDs: v.optional(v.array(v.string())),
    secondsPerRep: v.optional(v.number()),
    thumbnailMediaId: v.optional(v.string()),
    thumbnailStorageId: v.optional(v.id("_storage")),
  })
    .index("by_tonalId", ["tonalId"])
    .index("by_accessory", ["accessory"]),

  /** Tonal training type taxonomy (synced with movement catalog). */
  trainingTypes: defineTable({
    tonalId: v.string(),
    name: v.string(),
    description: v.string(),
    lastSyncedAt: v.number(),
  }).index("by_tonalId", ["tonalId"]),

  /** AI-generated workout plans. Lifecycle: draft -> pushing -> pushed -> completed. */
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

  /** 7-day training schedule. Each day has a session type, status, and optional linked workout. */
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

  /** Pending email change requests with verification codes. */
  emailChangeRequests: defineTable({
    userId: v.id("users"),
    newEmail: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  /** LLM token usage tracking for cost monitoring. */
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
    .index("by_createdAt", ["createdAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  /** AI agent tool execution log (latency, success/error tracking). */
  aiToolCalls: defineTable({
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    toolName: v.string(),
    durationMs: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tool", ["toolName", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

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

  /** Pre-generated workout library entries for SEO and inspiration. */
  libraryWorkouts: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    sessionType: v.string(),
    goal: v.string(),
    durationMinutes: v.number(),
    level: v.string(),
    equipmentConfig: v.string(),
    blocks: blockInputValidator,
    movementDetails: v.array(
      v.object({
        movementId: v.string(),
        name: v.string(),
        shortName: v.string(),
        muscleGroups: v.array(v.string()),
        sets: v.number(),
        reps: v.optional(v.number()),
        duration: v.optional(v.number()),
        phase: v.union(v.literal("warmup"), v.literal("main"), v.literal("cooldown")),
        thumbnailMediaUrl: v.optional(v.string()),
        accessory: v.optional(v.string()),
        coachingCue: v.optional(v.string()),
      }),
    ),
    targetMuscleGroups: v.array(v.string()),
    exerciseCount: v.number(),
    totalSets: v.number(),
    equipmentNeeded: v.array(v.string()),
    metaTitle: v.string(),
    metaDescription: v.string(),
    restGuidance: v.optional(v.string()),
    workoutRationale: v.optional(v.string()),
    whoIsThisFor: v.optional(v.string()),
    faq: v.optional(v.array(v.object({ question: v.string(), answer: v.string() }))),
    tonalWorkoutId: v.optional(v.string()),
    tonalDeepLinkUrl: v.optional(v.string()),
    generationVersion: v.number(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_goal", ["goal"])
    .index("by_sessionType", ["sessionType"])
    .index("by_level", ["level"])
    .index("by_durationMinutes", ["durationMinutes"])
    .index("by_equipmentConfig", ["equipmentConfig"])
    .index("by_generationVersion", ["generationVersion"]),

  /** Circuit breaker state for external API health tracking. Single-row table. */
  systemHealth: defineTable({
    service: v.string(), // "tonal"
    consecutiveFailures: v.number(),
    lastFailureAt: v.optional(v.number()),
    circuitOpen: v.boolean(), // true = tripped, don't call API
    circuitOpenedAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
  }).index("by_service", ["service"]),
});
