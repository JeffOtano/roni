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
    deletionInProgress: v.optional(v.boolean()),
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
    /** Last real app activity, separate from background token/sync jobs. */
    appLastActiveAt: v.optional(v.number()),
    /** Timestamp of the most recent background history sync attempt (cron-tier gate). */
    lastTonalSyncAt: v.optional(v.number()),
    /** Earliest time the cron should re-sync this user (precomputed tier interval). */
    nextTonalSyncAt: v.optional(v.number()),
    /** Last time the workoutHistory cache was written for this user. */
    workoutHistoryCachedAt: v.optional(v.number()),
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
        preferredSplit: v.union(
          v.literal("ppl"),
          v.literal("upper_lower"),
          v.literal("full_body"),
          v.literal("bro_split"),
        ),
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
    selectedProvider: v.optional(v.string()),
    claudeApiKeyEncrypted: v.optional(v.string()),
    claudeApiKeyAddedAt: v.optional(v.number()),
    openaiApiKeyEncrypted: v.optional(v.string()),
    openaiApiKeyAddedAt: v.optional(v.number()),
    openrouterApiKeyEncrypted: v.optional(v.string()),
    openrouterApiKeyAddedAt: v.optional(v.number()),
    modelOverride: v.optional(v.string()),
    /** Timestamp when a token refresh started. Used to prevent concurrent refreshes. */
    tokenRefreshInProgress: v.optional(v.number()),
    syncStatus: v.optional(
      v.union(v.literal("syncing"), v.literal("complete"), v.literal("failed")),
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_tonalUserId", ["tonalUserId"])
    .index("by_tonalTokenExpiresAt", ["tonalTokenExpiresAt"])
    .index("by_appLastActiveAt", ["appLastActiveAt"])
    .index("by_nextTonalSyncAt", ["nextTonalSyncAt"])
    .index("by_tonalConnectedAt", ["tonalConnectedAt"]),

  /**
   * High-churn per-user activity state split out of `userProfiles` so that
   * activity, sync, and token-lock writes don't invalidate subscribers of the
   * stable identity/profile/token document.
   */
  userProfileActivity: defineTable({
    userId: v.id("users"),
    lastActiveAt: v.optional(v.number()),
    appLastActiveAt: v.optional(v.number()),
    syncStatus: v.optional(
      v.union(v.literal("syncing"), v.literal("complete"), v.literal("failed")),
    ),
    lastSyncedActivityDate: v.optional(v.string()),
    tokenRefreshInProgress: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_appLastActiveAt", ["appLastActiveAt"])
    .index("by_lastActiveAt", ["lastActiveAt"]),

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
    .index("by_dataType", ["dataType"])
    .index("by_expiresAt", ["expiresAt"]),

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
    nameSearchText: v.optional(v.string()),
    muscleGroupsSearchText: v.optional(v.string()),
    trainingTypesSearchText: v.optional(v.string()),
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
    .index("by_accessory", ["accessory"])
    .searchIndex("search_name", { searchField: "nameSearchText" })
    .searchIndex("search_muscle_groups", { searchField: "muscleGroupsSearchText" })
    .searchIndex("search_training_types", { searchField: "trainingTypesSearchText" }),

  /** Tonal training type taxonomy (synced with movement catalog). */
  trainingTypes: defineTable({
    tonalId: v.string(),
    name: v.string(),
    description: v.string(),
    lastSyncedAt: v.number(),
  }).index("by_tonalId", ["tonalId"]),

  /** Tracks whether movement denormalized search fields are safe to query. */
  movementSearchState: defineTable({
    key: v.string(),
    version: v.number(),
    completedAt: v.number(),
  }).index("by_key", ["key"]),

  /** Materialized training snapshot used by the coach hot path. */
  coachState: defineTable({
    userId: v.id("users"),
    snapshot: v.string(),
    snapshotVersion: v.number(),
    userTimezone: v.optional(v.union(v.string(), v.null())),
    refreshedAt: v.number(),
    refreshRequestedAt: v.optional(v.number()),
    refreshRequestedTimezone: v.optional(v.union(v.string(), v.null())),
    failedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

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
    .index("by_status", ["status"])
    .index("by_tonalWorkoutId", ["tonalWorkoutId"])
    .index("by_userId_status", ["userId", "status"]),

  /** 7-day training schedule. Each day has a session type, status, and optional linked workout. */
  weekPlans: defineTable({
    userId: v.id("users"),
    weekStartDate: v.string(),
    preferredSplit: v.union(
      v.literal("ppl"),
      v.literal("upper_lower"),
      v.literal("full_body"),
      v.literal("bro_split"),
    ),
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
          v.literal("chest"),
          v.literal("back"),
          v.literal("shoulders"),
          v.literal("arms"),
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
  }).index("by_userId_weekStartDate", ["userId", "weekStartDate"]),

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
  }).index("by_userId_status", ["userId", "status"]),

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
  }).index("by_userId_status", ["userId", "status"]),

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
    .index("by_createdAt", ["createdAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  aiBudgetWarnings: defineTable({
    userId: v.id("users"),
    date: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId", ["userId"]),

  /** AI agent tool execution log (latency, success/error tracking). */
  aiToolCalls: defineTable({
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    toolName: v.string(),
    durationMs: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    /** Phoenix trace id for the enclosing user turn. Joins to `aiRun.runId`. */
    runId: v.optional(v.string()),
    /** AI SDK tool-call id — pairs a tool-call request with its result. */
    toolCallId: v.optional(v.string()),
    /** JSON-serialized tool arguments, bounded to avoid blowing up row size. */
    argsJson: v.optional(v.string()),
    /** Bounded stringified preview of the tool result, for post-hoc inspection. */
    resultPreview: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tool", ["toolName", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_runId", ["runId"]),

  /**
   * One row per user turn with Roni-specific outcomes and denormalized
   * aggregates. Phoenix Cloud handles raw trace capture; this table stores
   * domain fields (approval, workout plan outcomes), enables Convex joins,
   * and outlives any trace retention window on the Phoenix side.
   * `runId` equals the Phoenix Cloud trace id for cross-system joins.
   */
  aiRun: defineTable({
    runId: v.string(),
    userId: v.id("users"),
    threadId: v.string(),
    messageId: v.optional(v.string()),
    source: v.union(v.literal("chat"), v.literal("approval_continuation")),

    environment: v.union(v.literal("dev"), v.literal("prod")),
    release: v.optional(v.string()),
    promptVersion: v.optional(v.string()),

    totalSteps: v.number(),
    toolSequence: v.array(v.string()),
    retryCount: v.number(),
    fallbackReason: v.optional(
      v.union(v.literal("transient_exhaustion"), v.literal("primary_error")),
    ),
    finishReason: v.optional(
      v.union(
        v.literal("stop"),
        v.literal("tool-calls"),
        v.literal("length"),
        v.literal("content-filter"),
        v.literal("error"),
        v.literal("other"),
        v.literal("unknown"),
      ),
    ),
    terminalErrorClass: v.optional(v.string()),

    modelId: v.optional(v.string()),
    provider: v.optional(v.string()),

    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
    totalCostUsd: v.optional(v.number()),

    scheduledAt: v.optional(v.number()),
    processingStartedAt: v.optional(v.number()),
    streamStartedAt: v.optional(v.number()),
    queueDelayMs: v.optional(v.number()),
    preStreamSetupMs: v.optional(v.number()),

    timeToFirstTokenMs: v.optional(v.number()),
    timeToLastTokenMs: v.optional(v.number()),
    totalTimeToFirstTokenMs: v.optional(v.number()),
    totalTimeToLastTokenMs: v.optional(v.number()),
    outputTokensPerSec: v.optional(v.number()),

    contextBuildMs: v.optional(v.number()),
    snapshotBuildMs: v.optional(v.number()),
    contextBuildCount: v.optional(v.number()),
    contextMessageCount: v.optional(v.number()),
    snapshotSource: v.optional(
      v.union(
        v.literal("coach_state_fresh"),
        v.literal("coach_state_stale"),
        v.literal("live_rebuild"),
      ),
    ),
    retrievalEnabled: v.optional(v.boolean()),

    approvalPauses: v.number(),
    workoutPlanCreatedId: v.optional(v.id("workoutPlans")),
    workoutPushOutcome: v.optional(
      v.union(v.literal("pushed"), v.literal("failed"), v.literal("none")),
    ),

    createdAt: v.number(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_threadId", ["threadId"])
    .index("by_runId", ["runId"]),

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
    .index("by_userId_date", ["userId", "date"]),

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
    .index("by_userId_activityId_movementId", ["userId", "activityId", "movementId"])
    .index("by_userId_date", ["userId", "date"]),

  /**
   * Materialized all-time best avgWeightLbs per (user, movement).
   * Maintained by convex/personalRecords.ts hooks in every mutation that
   * writes to `exercisePerformance`.
   */
  personalRecords: defineTable({
    userId: v.id("users"),
    movementId: v.string(),
    bestAvgWeightLbs: v.number(),
    achievedActivityId: v.string(),
    achievedDate: v.string(),
    totalSessions: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_movementId", ["userId", "movementId"])
    .index("by_userId_best", ["userId", "bestAvgWeightLbs"]),

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
    .index("by_userId", ["userId"])
    .index("by_syncedAt", ["syncedAt"]),

  currentStrengthScores: defineTable({
    userId: v.id("users"),
    bodyRegion: v.string(),
    score: v.number(),
    fetchedAt: v.number(),
  }).index("by_userId", ["userId"]),

  muscleReadiness: defineTable({
    userId: v.id("users"),
    chest: v.number(),
    shoulders: v.number(),
    back: v.number(),
    triceps: v.number(),
    biceps: v.number(),
    abs: v.number(),
    obliques: v.number(),
    quads: v.number(),
    glutes: v.number(),
    hamstrings: v.number(),
    calves: v.number(),
    fetchedAt: v.number(),
  }).index("by_userId", ["userId"]),

  /**
   * Completed activities synced from sources other than the primary Tonal
   * account (Apple Watch, Garmin, etc.). Tonal's history sync populated
   * fields like HR and distance for every row; Garmin activities may omit
   * them (e.g. strength training has no distance; some devices don't
   * record HR). All signal-dependent fields are therefore optional.
   *
   * New writes normalize `source` to canonical values
   * (`appleHealth`, `garmin`, or `other`) before persistence. The schema stays
   * string-compatible so older rows can be repaired in place on next sync.
   * `externalId` is globally unique within a single source.
   */
  externalActivities: defineTable({
    userId: v.id("users"),
    externalId: v.string(),
    workoutType: v.string(),
    beginTime: v.string(),
    totalDuration: v.number(),
    activeCalories: v.optional(v.number()),
    totalCalories: v.optional(v.number()),
    averageHeartRate: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
    source: v.string(),
    distance: v.optional(v.number()),
    /** Meters climbed — Garmin-specific, not populated by legacy Tonal sync. */
    elevationGainMeters: v.optional(v.number()),
    /** Average pace in seconds per kilometer for running/cycling activities. */
    avgPaceSecondsPerKm: v.optional(v.number()),
    syncedAt: v.number(),
  })
    .index("by_userId_externalId", ["userId", "externalId"])
    .index("by_userId_source_externalId", ["userId", "source", "externalId"])
    .index("by_userId_beginTime", ["userId", "beginTime"]),

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

  /**
   * Per-user Garmin Connect OAuth 1.0a credentials + granted permissions.
   * Kept separate from `userProfiles` so Garmin is not overloaded onto
   * Tonal-specific rows and can be attached/detached independently.
   *
   * OAuth 1.0a UATs do not expire; there is no refresh-token flow. A
   * revocation at Garmin surfaces as 401/403 on API calls or a
   * permission-change webhook, at which point `status` becomes
   * "disconnected".
   */
  garminConnections: defineTable({
    userId: v.id("users"),
    /** Garmin's opaque user id from `GET /wellness-api/rest/user/id`. */
    garminUserId: v.string(),
    /** OAuth 1.0a access token, AES-GCM encrypted with TOKEN_ENCRYPTION_KEY. */
    accessTokenEncrypted: v.string(),
    /** OAuth 1.0a access token secret, AES-GCM encrypted. Required to sign. */
    accessTokenSecretEncrypted: v.string(),
    /** Granted permission strings (e.g. "WORKOUT_IMPORT", "ACTIVITY_EXPORT"). */
    permissions: v.array(v.string()),
    /** First time this user authorized this app. */
    connectedAt: v.number(),
    /** Last time we refreshed permissions from /userPermissions/. */
    permissionsRefreshedAt: v.optional(v.number()),
    /** Null while active; set when disconnected or revoked. */
    disconnectedAt: v.optional(v.number()),
    disconnectReason: v.optional(
      v.union(
        v.literal("user_disconnected"),
        v.literal("permission_revoked"),
        v.literal("token_invalid"),
      ),
    ),
    status: v.union(v.literal("active"), v.literal("disconnected")),
  })
    .index("by_userId", ["userId"])
    .index("by_garminUserId", ["garminUserId"])
    .index("by_garminUserId_status", ["garminUserId", "status"])
    .index("by_status", ["status"]),

  /**
   * Daily wellness rollup from Garmin Health API. Garmin sends separate
   * Push payloads per domain (Daily Summary, Sleep Summary, Stress
   * Details, HRV Summary, Body Battery); all merge into a single row per
   * (userId, calendarDate) so the coach reads one document. Rows are
   * upserted — Garmin may revise same-day summaries as late data arrives.
   */
  garminWellnessDaily: defineTable({
    userId: v.id("users"),
    /** ISO date (YYYY-MM-DD) in the user's local timezone per Garmin's summary. */
    calendarDate: v.string(),

    // Sleep summary
    sleepDurationSeconds: v.optional(v.number()),
    deepSleepSeconds: v.optional(v.number()),
    lightSleepSeconds: v.optional(v.number()),
    remSleepSeconds: v.optional(v.number()),
    awakeSeconds: v.optional(v.number()),
    sleepStartTime: v.optional(v.string()),
    sleepEndTime: v.optional(v.string()),
    /** 0-100 Garmin sleep score when provided by the device. */
    sleepScore: v.optional(v.number()),

    // Recovery signals
    restingHeartRate: v.optional(v.number()),
    /** Daily average stress score 0-100; null windows excluded. */
    avgStress: v.optional(v.number()),
    maxStress: v.optional(v.number()),
    /** Overnight HRV average in milliseconds. */
    hrvLastNightAvg: v.optional(v.number()),
    /** Garmin's HRV status label: BALANCED / UNBALANCED / LOW / POOR. */
    hrvStatus: v.optional(v.string()),
    bodyBatteryCharged: v.optional(v.number()),
    bodyBatteryDrained: v.optional(v.number()),
    bodyBatteryHighestValue: v.optional(v.number()),
    bodyBatteryLowestValue: v.optional(v.number()),

    // Activity baseline
    steps: v.optional(v.number()),
    distanceMeters: v.optional(v.number()),
    activeKilocalories: v.optional(v.number()),
    bmrKilocalories: v.optional(v.number()),
    moderateIntensityMinutes: v.optional(v.number()),
    vigorousIntensityMinutes: v.optional(v.number()),

    // Fitness + per-period vital signs (User Metrics / Pulse Ox /
    // Respiration / Skin Temperature)
    vo2Max: v.optional(v.number()),
    vo2MaxCycling: v.optional(v.number()),
    fitnessAge: v.optional(v.number()),
    /** True when Garmin used the enhanced fitness-age algorithm. */
    fitnessAgeEnhanced: v.optional(v.boolean()),
    /** Breaths per minute averaged across the respiration measurement window. */
    avgRespirationRate: v.optional(v.number()),
    /** Blood oxygen saturation averaged across the pulse-ox measurement window (%). */
    avgSpo2: v.optional(v.number()),
    /** Deviation from baseline skin temperature during sleep (Celsius). */
    skinTempDeviationCelsius: v.optional(v.number()),

    /** Last time any webhook updated this row. */
    lastIngestedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_calendarDate", ["userId", "calendarDate"])
    .index("by_calendarDate", ["calendarDate"]),

  /**
   * Raw Garmin Push webhook payloads. Written on receipt before any
   * processing so we can replay on normalizer bugs. Auto-expires after
   * 14 days via sweeper cron.
   */
  garminWebhookEvents: defineTable({
    /** Garmin-provided user id if we could parse it from the payload. */
    garminUserId: v.optional(v.string()),
    /** Our user id, resolved via garminConnections lookup. Null on miss. */
    userId: v.optional(v.id("users")),
    /** Push type, e.g. "activities", "dailies", "sleeps", "stressDetails". */
    eventType: v.string(),
    /** Status of this payload's processing. */
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("rejected"),
      v.literal("error"),
    ),
    /** Reason on rejected/error; null on success. */
    errorReason: v.optional(v.string()),
    /**
     * Raw JSON payload for replay. Legacy column from CP2c — kept
     * optional so existing rows still validate. New rows use
     * `rawPayloadStorageId` instead because Garmin backfill dailies
     * payloads can exceed the 1 MiB per-document limit.
     */
    rawPayload: v.optional(v.any()),
    /**
     * Convex file-storage ID for the raw JSON body. Replay/dispatch
     * fetch the blob via `ctx.storage.get(...)`. Using storage instead
     * of an inline column lets us accept the multi-megabyte dailies +
     * sleeps backfill payloads that include dense sample maps.
     */
    rawPayloadStorageId: v.optional(v.id("_storage")),
    receivedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_receivedAt", ["userId", "receivedAt"])
    .index("by_garminUserId", ["garminUserId"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_status", ["status"]),

  /**
   * Short-lived OAuth 1.0a request-token state keyed by the request token
   * issued by Garmin at step 1 of the 3-legged handshake. Holds the
   * request token secret needed to sign the access-token exchange, plus
   * the Roni user id so the callback can associate the returned access
   * token with the correct user. Rows are single-use and expire after 15
   * minutes via a periodic sweeper.
   */
  garminOauthStates: defineTable({
    userId: v.id("users"),
    /** Request token returned by Garmin. Indexed for callback lookup. */
    requestToken: v.string(),
    /** Request token secret, AES-GCM encrypted with TOKEN_ENCRYPTION_KEY. */
    requestTokenSecretEncrypted: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    /** Set when the callback consumes this row. Prevents replay. */
    consumedAt: v.optional(v.number()),
  })
    .index("by_requestToken", ["requestToken"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId", ["userId"]),
});
