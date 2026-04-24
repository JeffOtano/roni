/** Central classification for user-scoped data. Update this when adding new user data tables. */
export const USER_DATA_TABLES = [
  { table: "userProfiles", delete: "deleteUserRecord", jsonExportKey: "profile" },
  { table: "checkIns", delete: "byUserIdBatch", jsonExportKey: "checkIns" },
  { table: "tonalCache", delete: "tonalCacheBatch", jsonExportKey: null },
  { table: "workoutPlans", delete: "byUserIdBatch", jsonExportKey: "workoutPlans" },
  { table: "weekPlans", delete: "byUserIdBatch", jsonExportKey: "weekPlans" },
  { table: "workoutFeedback", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "trainingBlocks", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "goals", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "injuries", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "emailChangeRequests", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "aiUsage", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "aiBudgetWarnings", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "aiRun", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "coachState", delete: "byUserIdBatch", jsonExportKey: null },
  { table: "completedWorkouts", delete: "byUserIdBatch", jsonExportKey: "completedWorkouts" },
  {
    table: "exercisePerformance",
    delete: "exercisePerformanceBatch",
    jsonExportKey: "exercisePerformance",
  },
  { table: "personalRecords", delete: "personalRecordsBatch", jsonExportKey: null },
  {
    table: "strengthScoreSnapshots",
    delete: "byUserIdBatch",
    jsonExportKey: "strengthScoreSnapshots",
  },
  {
    table: "currentStrengthScores",
    delete: "byUserIdBatch",
    jsonExportKey: "currentStrengthScores",
  },
  { table: "muscleReadiness", delete: "byUserIdBatch", jsonExportKey: "muscleReadiness" },
  {
    table: "externalActivities",
    delete: "externalActivitiesBatch",
    jsonExportKey: "externalActivities",
  },
  { table: "authSessions", delete: "authData", jsonExportKey: null },
  { table: "authAccounts", delete: "authData", jsonExportKey: null },
] as const;

type UserDataEntry = (typeof USER_DATA_TABLES)[number];

export type ByUserIdBatchTable = Extract<UserDataEntry, { delete: "byUserIdBatch" }>["table"];
export type JsonExportSectionKey = Exclude<UserDataEntry["jsonExportKey"], null>;

export const BY_USER_ID_BATCH_TABLES = USER_DATA_TABLES.filter(
  (entry): entry is Extract<UserDataEntry, { delete: "byUserIdBatch" }> =>
    entry.delete === "byUserIdBatch",
).map((entry) => entry.table);

export const JSON_EXPORT_SECTION_KEYS = USER_DATA_TABLES.flatMap((entry) =>
  entry.jsonExportKey ? [entry.jsonExportKey] : [],
);
