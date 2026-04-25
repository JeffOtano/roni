/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as account from "../account.js";
import type * as accountDeletion from "../accountDeletion.js";
import type * as activation from "../activation.js";
import type * as ai_anthropicCache from "../ai/anthropicCache.js";
import type * as ai_budget from "../ai/budget.js";
import type * as ai_byokErrors from "../ai/byokErrors.js";
import type * as ai_coach from "../ai/coach.js";
import type * as ai_coachingTools from "../ai/coachingTools.js";
import type * as ai_context from "../ai/context.js";
import type * as ai_contextWindow from "../ai/contextWindow.js";
import type * as ai_evalHarness from "../ai/evalHarness.js";
import type * as ai_evalScenarios from "../ai/evalScenarios.js";
import type * as ai_helpers from "../ai/helpers.js";
import type * as ai_otel from "../ai/otel.js";
import type * as ai_promptSections from "../ai/promptSections.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai_resilience from "../ai/resilience.js";
import type * as ai_runTelemetry from "../ai/runTelemetry.js";
import type * as ai_schemas from "../ai/schemas.js";
import type * as ai_snapshotHelpers from "../ai/snapshotHelpers.js";
import type * as ai_timeDecay from "../ai/timeDecay.js";
import type * as ai_tools from "../ai/tools.js";
import type * as ai_trainingSnapshotCache from "../ai/trainingSnapshotCache.js";
import type * as ai_transientErrors from "../ai/transientErrors.js";
import type * as ai_weekModificationTools from "../ai/weekModificationTools.js";
import type * as ai_weekReasoning from "../ai/weekReasoning.js";
import type * as ai_weekTools from "../ai/weekTools.js";
import type * as aiUsage from "../aiUsage.js";
import type * as auth from "../auth.js";
import type * as byok from "../byok.js";
import type * as byokProvider from "../byokProvider.js";
import type * as byokShared from "../byokShared.js";
import type * as byokValidation from "../byokValidation.js";
import type * as chat from "../chat.js";
import type * as chatHelpers from "../chatHelpers.js";
import type * as chatProcessing from "../chatProcessing.js";
import type * as checkIns from "../checkIns.js";
import type * as checkIns_content from "../checkIns/content.js";
import type * as checkIns_triggers from "../checkIns/triggers.js";
import type * as coach_exerciseSelection from "../coach/exerciseSelection.js";
import type * as coach_goalConfig from "../coach/goalConfig.js";
import type * as coach_missedSessionDetection from "../coach/missedSessionDetection.js";
import type * as coach_normalizeBlocks from "../coach/normalizeBlocks.js";
import type * as coach_periodization from "../coach/periodization.js";
import type * as coach_prDetection from "../coach/prDetection.js";
import type * as coach_pushAndVerify from "../coach/pushAndVerify.js";
import type * as coach_weekModifications from "../coach/weekModifications.js";
import type * as coach_weekProgramming from "../coach/weekProgramming.js";
import type * as coach_weekProgrammingDirect from "../coach/weekProgrammingDirect.js";
import type * as coach_weekProgrammingHelpers from "../coach/weekProgrammingHelpers.js";
import type * as coach_workoutBlocks from "../coach/workoutBlocks.js";
import type * as coachState from "../coachState.js";
import type * as contact from "../contact.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataExport from "../dataExport.js";
import type * as dataRetention from "../dataRetention.js";
import type * as devTools from "../devTools.js";
import type * as devToolsActions from "../devToolsActions.js";
import type * as discord from "../discord.js";
import type * as email from "../email.js";
import type * as emailChange from "../emailChange.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as fileGc from "../fileGc.js";
import type * as goals from "../goals.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as injuries from "../injuries.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_posthog from "../lib/posthog.js";
import type * as lib_targetArea from "../lib/targetArea.js";
import type * as libraryWorkouts from "../libraryWorkouts.js";
import type * as migrations from "../migrations.js";
import type * as migrations_backfillAvgWeight from "../migrations/backfillAvgWeight.js";
import type * as migrations_backfillNextTonalSyncAt from "../migrations/backfillNextTonalSyncAt.js";
import type * as migrations_backfillPersonalRecords from "../migrations/backfillPersonalRecords.js";
import type * as migrations_repairOrphanedAuthAccounts from "../migrations/repairOrphanedAuthAccounts.js";
import type * as migrations_rotateTokenEncryptionKey from "../migrations/rotateTokenEncryptionKey.js";
import type * as personalRecords from "../personalRecords.js";
import type * as progressiveOverload from "../progressiveOverload.js";
import type * as prs from "../prs.js";
import type * as rateLimits from "../rateLimits.js";
import type * as schedule from "../schedule.js";
import type * as stats from "../stats.js";
import type * as systemHealth from "../systemHealth.js";
import type * as threads from "../threads.js";
import type * as tonal_accessories from "../tonal/accessories.js";
import type * as tonal_auth from "../tonal/auth.js";
import type * as tonal_cache from "../tonal/cache.js";
import type * as tonal_cacheRefresh from "../tonal/cacheRefresh.js";
import type * as tonal_cacheRefreshTiering from "../tonal/cacheRefreshTiering.js";
import type * as tonal_client from "../tonal/client.js";
import type * as tonal_connect from "../tonal/connect.js";
import type * as tonal_connectPublic from "../tonal/connectPublic.js";
import type * as tonal_encryption from "../tonal/encryption.js";
import type * as tonal_enrichmentSync from "../tonal/enrichmentSync.js";
import type * as tonal_hardware from "../tonal/hardware.js";
import type * as tonal_historySync from "../tonal/historySync.js";
import type * as tonal_historySyncCore from "../tonal/historySyncCore.js";
import type * as tonal_historySyncMutations from "../tonal/historySyncMutations.js";
import type * as tonal_historySyncPreflight from "../tonal/historySyncPreflight.js";
import type * as tonal_movementMapping from "../tonal/movementMapping.js";
import type * as tonal_movementSearch from "../tonal/movementSearch.js";
import type * as tonal_movementSearchQueries from "../tonal/movementSearchQueries.js";
import type * as tonal_movementSync from "../tonal/movementSync.js";
import type * as tonal_mutations from "../tonal/mutations.js";
import type * as tonal_profileBackfill from "../tonal/profileBackfill.js";
import type * as tonal_profileData from "../tonal/profileData.js";
import type * as tonal_proxy from "../tonal/proxy.js";
import type * as tonal_proxyCacheLimits from "../tonal/proxyCacheLimits.js";
import type * as tonal_refresh from "../tonal/refresh.js";
import type * as tonal_refreshPublic from "../tonal/refreshPublic.js";
import type * as tonal_resync from "../tonal/resync.js";
import type * as tonal_syncQueries from "../tonal/syncQueries.js";
import type * as tonal_tokenQueries from "../tonal/tokenQueries.js";
import type * as tonal_tokenRefresh from "../tonal/tokenRefresh.js";
import type * as tonal_tokenRetry from "../tonal/tokenRetry.js";
import type * as tonal_transforms from "../tonal/transforms.js";
import type * as tonal_types from "../tonal/types.js";
import type * as tonal_validation from "../tonal/validation.js";
import type * as tonal_workoutCatalogSync from "../tonal/workoutCatalogSync.js";
import type * as tonal_workoutDetailProjection from "../tonal/workoutDetailProjection.js";
import type * as tonal_workoutHistoryProxy from "../tonal/workoutHistoryProxy.js";
import type * as tonal_workoutMeta from "../tonal/workoutMeta.js";
import type * as userActivity from "../userActivity.js";
import type * as userData from "../userData.js";
import type * as userProfiles from "../userProfiles.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as weekPlanActions from "../weekPlanActions.js";
import type * as weekPlanEnriched from "../weekPlanEnriched.js";
import type * as weekPlanHelpers from "../weekPlanHelpers.js";
import type * as weekPlanInternals from "../weekPlanInternals.js";
import type * as weekPlans from "../weekPlans.js";
import type * as workflows from "../workflows.js";
import type * as workoutDetail from "../workoutDetail.js";
import type * as workoutFeedback from "../workoutFeedback.js";
import type * as workoutPlans from "../workoutPlans.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  account: typeof account;
  accountDeletion: typeof accountDeletion;
  activation: typeof activation;
  "ai/anthropicCache": typeof ai_anthropicCache;
  "ai/budget": typeof ai_budget;
  "ai/byokErrors": typeof ai_byokErrors;
  "ai/coach": typeof ai_coach;
  "ai/coachingTools": typeof ai_coachingTools;
  "ai/context": typeof ai_context;
  "ai/contextWindow": typeof ai_contextWindow;
  "ai/evalHarness": typeof ai_evalHarness;
  "ai/evalScenarios": typeof ai_evalScenarios;
  "ai/helpers": typeof ai_helpers;
  "ai/otel": typeof ai_otel;
  "ai/promptSections": typeof ai_promptSections;
  "ai/providers": typeof ai_providers;
  "ai/resilience": typeof ai_resilience;
  "ai/runTelemetry": typeof ai_runTelemetry;
  "ai/schemas": typeof ai_schemas;
  "ai/snapshotHelpers": typeof ai_snapshotHelpers;
  "ai/timeDecay": typeof ai_timeDecay;
  "ai/tools": typeof ai_tools;
  "ai/trainingSnapshotCache": typeof ai_trainingSnapshotCache;
  "ai/transientErrors": typeof ai_transientErrors;
  "ai/weekModificationTools": typeof ai_weekModificationTools;
  "ai/weekReasoning": typeof ai_weekReasoning;
  "ai/weekTools": typeof ai_weekTools;
  aiUsage: typeof aiUsage;
  auth: typeof auth;
  byok: typeof byok;
  byokProvider: typeof byokProvider;
  byokShared: typeof byokShared;
  byokValidation: typeof byokValidation;
  chat: typeof chat;
  chatHelpers: typeof chatHelpers;
  chatProcessing: typeof chatProcessing;
  checkIns: typeof checkIns;
  "checkIns/content": typeof checkIns_content;
  "checkIns/triggers": typeof checkIns_triggers;
  "coach/exerciseSelection": typeof coach_exerciseSelection;
  "coach/goalConfig": typeof coach_goalConfig;
  "coach/missedSessionDetection": typeof coach_missedSessionDetection;
  "coach/normalizeBlocks": typeof coach_normalizeBlocks;
  "coach/periodization": typeof coach_periodization;
  "coach/prDetection": typeof coach_prDetection;
  "coach/pushAndVerify": typeof coach_pushAndVerify;
  "coach/weekModifications": typeof coach_weekModifications;
  "coach/weekProgramming": typeof coach_weekProgramming;
  "coach/weekProgrammingDirect": typeof coach_weekProgrammingDirect;
  "coach/weekProgrammingHelpers": typeof coach_weekProgrammingHelpers;
  "coach/workoutBlocks": typeof coach_workoutBlocks;
  coachState: typeof coachState;
  contact: typeof contact;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataExport: typeof dataExport;
  dataRetention: typeof dataRetention;
  devTools: typeof devTools;
  devToolsActions: typeof devToolsActions;
  discord: typeof discord;
  email: typeof email;
  emailChange: typeof emailChange;
  emailTemplates: typeof emailTemplates;
  fileGc: typeof fileGc;
  goals: typeof goals;
  healthCheck: typeof healthCheck;
  http: typeof http;
  injuries: typeof injuries;
  "lib/auth": typeof lib_auth;
  "lib/env": typeof lib_env;
  "lib/posthog": typeof lib_posthog;
  "lib/targetArea": typeof lib_targetArea;
  libraryWorkouts: typeof libraryWorkouts;
  migrations: typeof migrations;
  "migrations/backfillAvgWeight": typeof migrations_backfillAvgWeight;
  "migrations/backfillNextTonalSyncAt": typeof migrations_backfillNextTonalSyncAt;
  "migrations/backfillPersonalRecords": typeof migrations_backfillPersonalRecords;
  "migrations/repairOrphanedAuthAccounts": typeof migrations_repairOrphanedAuthAccounts;
  "migrations/rotateTokenEncryptionKey": typeof migrations_rotateTokenEncryptionKey;
  personalRecords: typeof personalRecords;
  progressiveOverload: typeof progressiveOverload;
  prs: typeof prs;
  rateLimits: typeof rateLimits;
  schedule: typeof schedule;
  stats: typeof stats;
  systemHealth: typeof systemHealth;
  threads: typeof threads;
  "tonal/accessories": typeof tonal_accessories;
  "tonal/auth": typeof tonal_auth;
  "tonal/cache": typeof tonal_cache;
  "tonal/cacheRefresh": typeof tonal_cacheRefresh;
  "tonal/cacheRefreshTiering": typeof tonal_cacheRefreshTiering;
  "tonal/client": typeof tonal_client;
  "tonal/connect": typeof tonal_connect;
  "tonal/connectPublic": typeof tonal_connectPublic;
  "tonal/encryption": typeof tonal_encryption;
  "tonal/enrichmentSync": typeof tonal_enrichmentSync;
  "tonal/hardware": typeof tonal_hardware;
  "tonal/historySync": typeof tonal_historySync;
  "tonal/historySyncCore": typeof tonal_historySyncCore;
  "tonal/historySyncMutations": typeof tonal_historySyncMutations;
  "tonal/historySyncPreflight": typeof tonal_historySyncPreflight;
  "tonal/movementMapping": typeof tonal_movementMapping;
  "tonal/movementSearch": typeof tonal_movementSearch;
  "tonal/movementSearchQueries": typeof tonal_movementSearchQueries;
  "tonal/movementSync": typeof tonal_movementSync;
  "tonal/mutations": typeof tonal_mutations;
  "tonal/profileBackfill": typeof tonal_profileBackfill;
  "tonal/profileData": typeof tonal_profileData;
  "tonal/proxy": typeof tonal_proxy;
  "tonal/proxyCacheLimits": typeof tonal_proxyCacheLimits;
  "tonal/refresh": typeof tonal_refresh;
  "tonal/refreshPublic": typeof tonal_refreshPublic;
  "tonal/resync": typeof tonal_resync;
  "tonal/syncQueries": typeof tonal_syncQueries;
  "tonal/tokenQueries": typeof tonal_tokenQueries;
  "tonal/tokenRefresh": typeof tonal_tokenRefresh;
  "tonal/tokenRetry": typeof tonal_tokenRetry;
  "tonal/transforms": typeof tonal_transforms;
  "tonal/types": typeof tonal_types;
  "tonal/validation": typeof tonal_validation;
  "tonal/workoutCatalogSync": typeof tonal_workoutCatalogSync;
  "tonal/workoutDetailProjection": typeof tonal_workoutDetailProjection;
  "tonal/workoutHistoryProxy": typeof tonal_workoutHistoryProxy;
  "tonal/workoutMeta": typeof tonal_workoutMeta;
  userActivity: typeof userActivity;
  userData: typeof userData;
  userProfiles: typeof userProfiles;
  users: typeof users;
  validators: typeof validators;
  weekPlanActions: typeof weekPlanActions;
  weekPlanEnriched: typeof weekPlanEnriched;
  weekPlanHelpers: typeof weekPlanHelpers;
  weekPlanInternals: typeof weekPlanInternals;
  weekPlans: typeof weekPlans;
  workflows: typeof workflows;
  workoutDetail: typeof workoutDetail;
  workoutFeedback: typeof workoutFeedback;
  workoutPlans: typeof workoutPlans;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  perfByMovement: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"perfByMovement">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
