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
import type * as ai_coach from "../ai/coach.js";
import type * as ai_coachingTools from "../ai/coachingTools.js";
import type * as ai_context from "../ai/context.js";
import type * as ai_helpers from "../ai/helpers.js";
import type * as ai_promptSections from "../ai/promptSections.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai_resilience from "../ai/resilience.js";
import type * as ai_schemas from "../ai/schemas.js";
import type * as ai_snapshotHelpers from "../ai/snapshotHelpers.js";
import type * as ai_timeDecay from "../ai/timeDecay.js";
import type * as ai_tools from "../ai/tools.js";
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
import type * as checkIns from "../checkIns.js";
import type * as checkIns_content from "../checkIns/content.js";
import type * as checkIns_triggers from "../checkIns/triggers.js";
import type * as coach_exerciseSelection from "../coach/exerciseSelection.js";
import type * as coach_goalConfig from "../coach/goalConfig.js";
import type * as coach_missedSessionDetection from "../coach/missedSessionDetection.js";
import type * as coach_periodization from "../coach/periodization.js";
import type * as coach_prDetection from "../coach/prDetection.js";
import type * as coach_pushAndVerify from "../coach/pushAndVerify.js";
import type * as coach_weekModifications from "../coach/weekModifications.js";
import type * as coach_weekProgramming from "../coach/weekProgramming.js";
import type * as coach_weekProgrammingDirect from "../coach/weekProgrammingDirect.js";
import type * as coach_weekProgrammingHelpers from "../coach/weekProgrammingHelpers.js";
import type * as contact from "../contact.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataExport from "../dataExport.js";
import type * as dataRetention from "../dataRetention.js";
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
import type * as lib_posthog from "../lib/posthog.js";
import type * as libraryWorkouts from "../libraryWorkouts.js";
import type * as migrations_rotateTokenEncryptionKey from "../migrations/rotateTokenEncryptionKey.js";
import type * as progressiveOverload from "../progressiveOverload.js";
import type * as rateLimits from "../rateLimits.js";
import type * as schedule from "../schedule.js";
import type * as stats from "../stats.js";
import type * as systemHealth from "../systemHealth.js";
import type * as threads from "../threads.js";
import type * as tonal_accessories from "../tonal/accessories.js";
import type * as tonal_auth from "../tonal/auth.js";
import type * as tonal_cache from "../tonal/cache.js";
import type * as tonal_cacheRefresh from "../tonal/cacheRefresh.js";
import type * as tonal_client from "../tonal/client.js";
import type * as tonal_connect from "../tonal/connect.js";
import type * as tonal_connectPublic from "../tonal/connectPublic.js";
import type * as tonal_encryption from "../tonal/encryption.js";
import type * as tonal_hardware from "../tonal/hardware.js";
import type * as tonal_historySync from "../tonal/historySync.js";
import type * as tonal_historySyncMutations from "../tonal/historySyncMutations.js";
import type * as tonal_movementMapping from "../tonal/movementMapping.js";
import type * as tonal_movementSearch from "../tonal/movementSearch.js";
import type * as tonal_movementSync from "../tonal/movementSync.js";
import type * as tonal_mutations from "../tonal/mutations.js";
import type * as tonal_profileBackfill from "../tonal/profileBackfill.js";
import type * as tonal_profileData from "../tonal/profileData.js";
import type * as tonal_proxy from "../tonal/proxy.js";
import type * as tonal_refresh from "../tonal/refresh.js";
import type * as tonal_refreshPublic from "../tonal/refreshPublic.js";
import type * as tonal_syncQueries from "../tonal/syncQueries.js";
import type * as tonal_tokenRefresh from "../tonal/tokenRefresh.js";
import type * as tonal_tokenRetry from "../tonal/tokenRetry.js";
import type * as tonal_transforms from "../tonal/transforms.js";
import type * as tonal_types from "../tonal/types.js";
import type * as tonal_validation from "../tonal/validation.js";
import type * as tonal_workoutCatalogSync from "../tonal/workoutCatalogSync.js";
import type * as userProfiles from "../userProfiles.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as weekPlanActions from "../weekPlanActions.js";
import type * as weekPlanEnriched from "../weekPlanEnriched.js";
import type * as weekPlanHelpers from "../weekPlanHelpers.js";
import type * as weekPlanInternals from "../weekPlanInternals.js";
import type * as weekPlans from "../weekPlans.js";
import type * as workoutDetail from "../workoutDetail.js";
import type * as workoutFeedback from "../workoutFeedback.js";
import type * as workoutPlans from "../workoutPlans.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  account: typeof account;
  accountDeletion: typeof accountDeletion;
  activation: typeof activation;
  "ai/coach": typeof ai_coach;
  "ai/coachingTools": typeof ai_coachingTools;
  "ai/context": typeof ai_context;
  "ai/helpers": typeof ai_helpers;
  "ai/promptSections": typeof ai_promptSections;
  "ai/providers": typeof ai_providers;
  "ai/resilience": typeof ai_resilience;
  "ai/schemas": typeof ai_schemas;
  "ai/snapshotHelpers": typeof ai_snapshotHelpers;
  "ai/timeDecay": typeof ai_timeDecay;
  "ai/tools": typeof ai_tools;
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
  checkIns: typeof checkIns;
  "checkIns/content": typeof checkIns_content;
  "checkIns/triggers": typeof checkIns_triggers;
  "coach/exerciseSelection": typeof coach_exerciseSelection;
  "coach/goalConfig": typeof coach_goalConfig;
  "coach/missedSessionDetection": typeof coach_missedSessionDetection;
  "coach/periodization": typeof coach_periodization;
  "coach/prDetection": typeof coach_prDetection;
  "coach/pushAndVerify": typeof coach_pushAndVerify;
  "coach/weekModifications": typeof coach_weekModifications;
  "coach/weekProgramming": typeof coach_weekProgramming;
  "coach/weekProgrammingDirect": typeof coach_weekProgrammingDirect;
  "coach/weekProgrammingHelpers": typeof coach_weekProgrammingHelpers;
  contact: typeof contact;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataExport: typeof dataExport;
  dataRetention: typeof dataRetention;
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
  "lib/posthog": typeof lib_posthog;
  libraryWorkouts: typeof libraryWorkouts;
  "migrations/rotateTokenEncryptionKey": typeof migrations_rotateTokenEncryptionKey;
  progressiveOverload: typeof progressiveOverload;
  rateLimits: typeof rateLimits;
  schedule: typeof schedule;
  stats: typeof stats;
  systemHealth: typeof systemHealth;
  threads: typeof threads;
  "tonal/accessories": typeof tonal_accessories;
  "tonal/auth": typeof tonal_auth;
  "tonal/cache": typeof tonal_cache;
  "tonal/cacheRefresh": typeof tonal_cacheRefresh;
  "tonal/client": typeof tonal_client;
  "tonal/connect": typeof tonal_connect;
  "tonal/connectPublic": typeof tonal_connectPublic;
  "tonal/encryption": typeof tonal_encryption;
  "tonal/hardware": typeof tonal_hardware;
  "tonal/historySync": typeof tonal_historySync;
  "tonal/historySyncMutations": typeof tonal_historySyncMutations;
  "tonal/movementMapping": typeof tonal_movementMapping;
  "tonal/movementSearch": typeof tonal_movementSearch;
  "tonal/movementSync": typeof tonal_movementSync;
  "tonal/mutations": typeof tonal_mutations;
  "tonal/profileBackfill": typeof tonal_profileBackfill;
  "tonal/profileData": typeof tonal_profileData;
  "tonal/proxy": typeof tonal_proxy;
  "tonal/refresh": typeof tonal_refresh;
  "tonal/refreshPublic": typeof tonal_refreshPublic;
  "tonal/syncQueries": typeof tonal_syncQueries;
  "tonal/tokenRefresh": typeof tonal_tokenRefresh;
  "tonal/tokenRetry": typeof tonal_tokenRetry;
  "tonal/transforms": typeof tonal_transforms;
  "tonal/types": typeof tonal_types;
  "tonal/validation": typeof tonal_validation;
  "tonal/workoutCatalogSync": typeof tonal_workoutCatalogSync;
  userProfiles: typeof userProfiles;
  users: typeof users;
  validators: typeof validators;
  weekPlanActions: typeof weekPlanActions;
  weekPlanEnriched: typeof weekPlanEnriched;
  weekPlanHelpers: typeof weekPlanHelpers;
  weekPlanInternals: typeof weekPlanInternals;
  weekPlans: typeof weekPlans;
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
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {
  agent: {
    apiKeys: {
      destroy: FunctionReference<
        "mutation",
        "internal",
        { apiKey?: string; name?: string },
        "missing" | "deleted" | "name mismatch" | "must provide either apiKey or name"
      >;
      issue: FunctionReference<"mutation", "internal", { name?: string }, string>;
      validate: FunctionReference<"query", "internal", { apiKey: string }, boolean>;
    };
    files: {
      addFile: FunctionReference<
        "mutation",
        "internal",
        {
          filename?: string;
          hash: string;
          mediaType?: string;
          mimeType?: string;
          storageId: string;
        },
        { fileId: string; storageId: string }
      >;
      copyFile: FunctionReference<"mutation", "internal", { fileId: string }, null>;
      deleteFiles: FunctionReference<
        "mutation",
        "internal",
        { fileIds: Array<string>; force?: boolean },
        Array<string>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { fileId: string },
        null | {
          _creationTime: number;
          _id: string;
          filename?: string;
          hash: string;
          lastTouchedAt: number;
          mediaType?: string;
          mimeType?: string;
          refcount: number;
          storageId: string;
        }
      >;
      getFilesToDelete: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            filename?: string;
            hash: string;
            lastTouchedAt: number;
            mediaType?: string;
            mimeType?: string;
            refcount: number;
            storageId: string;
          }>;
        }
      >;
      useExistingFile: FunctionReference<
        "mutation",
        "internal",
        { filename?: string; hash: string },
        null | { fileId: string; storageId: string }
      >;
    };
    messages: {
      addMessages: FunctionReference<
        "mutation",
        "internal",
        {
          agentName?: string;
          embeddings?: {
            dimension: 128 | 256 | 512 | 768 | 1024 | 1408 | 1536 | 2048 | 3072 | 4096;
            model: string;
            vectors: Array<Array<number> | null>;
          };
          failPendingSteps?: boolean;
          finishStreamId?: string;
          hideFromUserIdSearch?: boolean;
          messages: Array<{
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            message:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status?: "pending" | "success" | "failed";
            text?: string;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
          pendingMessageId?: string;
          promptMessageId?: string;
          threadId: string;
          userId?: string;
        },
        {
          messages: Array<{
            _creationTime: number;
            _id: string;
            agentName?: string;
            embeddingId?: string;
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            id?: string;
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            order: number;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            providerOptions?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status: "pending" | "success" | "failed";
            stepOrder: number;
            text?: string;
            threadId: string;
            tool: boolean;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            userId?: string;
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
        }
      >;
      cloneThread: FunctionReference<
        "action",
        "internal",
        {
          batchSize?: number;
          copyUserIdForVectorSearch?: boolean;
          excludeToolMessages?: boolean;
          insertAtOrder?: number;
          limit?: number;
          sourceThreadId: string;
          statuses?: Array<"pending" | "success" | "failed">;
          targetThreadId: string;
          upToAndIncludingMessageId?: string;
        },
        number
      >;
      deleteByIds: FunctionReference<
        "mutation",
        "internal",
        { messageIds: Array<string> },
        Array<string>
      >;
      deleteByOrder: FunctionReference<
        "mutation",
        "internal",
        {
          endOrder: number;
          endStepOrder?: number;
          startOrder: number;
          startStepOrder?: number;
          threadId: string;
        },
        { isDone: boolean; lastOrder?: number; lastStepOrder?: number }
      >;
      finalizeMessage: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          result: { status: "success" } | { error: string; status: "failed" };
        },
        null
      >;
      getMessagesByIds: FunctionReference<
        "query",
        "internal",
        { messageIds: Array<string> },
        Array<null | {
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      getMessageSearchFields: FunctionReference<
        "query",
        "internal",
        { messageId: string },
        { embedding?: Array<number>; embeddingModel?: string; text?: string }
      >;
      listMessagesByThreadId: FunctionReference<
        "query",
        "internal",
        {
          excludeToolMessages?: boolean;
          order: "asc" | "desc";
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          statuses?: Array<"pending" | "success" | "failed">;
          threadId: string;
          upToAndIncludingMessageId?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            agentName?: string;
            embeddingId?: string;
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            id?: string;
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            order: number;
            provider?: string;
            providerMetadata?: Record<string, Record<string, any>>;
            providerOptions?: Record<string, Record<string, any>>;
            reasoning?: string;
            reasoningDetails?: Array<
              | {
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  signature?: string;
                  text: string;
                  type: "reasoning";
                }
              | { signature?: string; text: string; type: "text" }
              | { data: string; type: "redacted" }
            >;
            sources?: Array<
              | {
                  id: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "url";
                  title?: string;
                  type?: "source";
                  url: string;
                }
              | {
                  filename?: string;
                  id: string;
                  mediaType: string;
                  providerMetadata?: Record<string, Record<string, any>>;
                  providerOptions?: Record<string, Record<string, any>>;
                  sourceType: "document";
                  title: string;
                  type: "source";
                }
            >;
            status: "pending" | "success" | "failed";
            stepOrder: number;
            text?: string;
            threadId: string;
            tool: boolean;
            usage?: {
              cachedInputTokens?: number;
              completionTokens: number;
              promptTokens: number;
              reasoningTokens?: number;
              totalTokens: number;
            };
            userId?: string;
            warnings?: Array<
              | {
                  details?: string;
                  setting: string;
                  type: "unsupported-setting";
                }
              | { details?: string; tool: any; type: "unsupported-tool" }
              | { message: string; type: "other" }
            >;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      searchMessages: FunctionReference<
        "action",
        "internal",
        {
          embedding?: Array<number>;
          embeddingModel?: string;
          limit: number;
          messageRange?: { after: number; before: number };
          searchAllMessagesForUserId?: string;
          targetMessageId?: string;
          text?: string;
          textSearch?: boolean;
          threadId?: string;
          vectorScoreThreshold?: number;
          vectorSearch?: boolean;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      textSearch: FunctionReference<
        "query",
        "internal",
        {
          limit: number;
          searchAllMessagesForUserId?: string;
          targetMessageId?: string;
          text?: string;
          threadId?: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }>
      >;
      updateMessage: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          patch: {
            error?: string;
            fileIds?: Array<string>;
            finishReason?:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other"
              | "unknown";
            message?:
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            image: string | ArrayBuffer;
                            mediaType?: string;
                            mimeType?: string;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "image";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "user";
                }
              | {
                  content:
                    | string
                    | Array<
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            text: string;
                            type: "text";
                          }
                        | {
                            data: string | ArrayBuffer;
                            filename?: string;
                            mediaType?: string;
                            mimeType?: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "file";
                          }
                        | {
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            signature?: string;
                            text: string;
                            type: "reasoning";
                          }
                        | {
                            data: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "redacted-reasoning";
                          }
                        | {
                            args?: any;
                            input: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args: any;
                            input?: any;
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-call";
                          }
                        | {
                            args?: any;
                            experimental_content?: Array<
                              | { text: string; type: "text" }
                              | {
                                  data: string;
                                  mimeType?: string;
                                  type: "image";
                                }
                            >;
                            isError?: boolean;
                            output?:
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-text";
                                  value: string;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "error-json";
                                  value: any;
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  reason?: string;
                                  type: "execution-denied";
                                }
                              | {
                                  type: "content";
                                  value: Array<
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        text: string;
                                        type: "text";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        type: "media";
                                      }
                                    | {
                                        data: string;
                                        filename?: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "file-id";
                                      }
                                    | {
                                        data: string;
                                        mediaType: string;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-data";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-url";
                                        url: string;
                                      }
                                    | {
                                        fileId: string | Record<string, string>;
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "image-file-id";
                                      }
                                    | {
                                        providerOptions?: Record<string, Record<string, any>>;
                                        type: "custom";
                                      }
                                  >;
                                };
                            providerExecuted?: boolean;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            result?: any;
                            toolCallId: string;
                            toolName: string;
                            type: "tool-result";
                          }
                        | {
                            id: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "url";
                            title?: string;
                            type: "source";
                            url: string;
                          }
                        | {
                            filename?: string;
                            id: string;
                            mediaType: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            sourceType: "document";
                            title: string;
                            type: "source";
                          }
                        | {
                            approvalId: string;
                            providerMetadata?: Record<string, Record<string, any>>;
                            providerOptions?: Record<string, Record<string, any>>;
                            toolCallId: string;
                            type: "tool-approval-request";
                          }
                      >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "assistant";
                }
              | {
                  content: Array<
                    | {
                        args?: any;
                        experimental_content?: Array<
                          | { text: string; type: "text" }
                          | { data: string; mimeType?: string; type: "image" }
                        >;
                        isError?: boolean;
                        output?:
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-text";
                              value: string;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              type: "error-json";
                              value: any;
                            }
                          | {
                              providerOptions?: Record<string, Record<string, any>>;
                              reason?: string;
                              type: "execution-denied";
                            }
                          | {
                              type: "content";
                              value: Array<
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    text: string;
                                    type: "text";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    type: "media";
                                  }
                                | {
                                    data: string;
                                    filename?: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "file-id";
                                  }
                                | {
                                    data: string;
                                    mediaType: string;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-data";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-url";
                                    url: string;
                                  }
                                | {
                                    fileId: string | Record<string, string>;
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "image-file-id";
                                  }
                                | {
                                    providerOptions?: Record<string, Record<string, any>>;
                                    type: "custom";
                                  }
                              >;
                            };
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        result?: any;
                        toolCallId: string;
                        toolName: string;
                        type: "tool-result";
                      }
                    | {
                        approvalId: string;
                        approved: boolean;
                        providerExecuted?: boolean;
                        providerMetadata?: Record<string, Record<string, any>>;
                        providerOptions?: Record<string, Record<string, any>>;
                        reason?: string;
                        type: "tool-approval-response";
                      }
                  >;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "tool";
                }
              | {
                  content: string;
                  providerOptions?: Record<string, Record<string, any>>;
                  role: "system";
                };
            model?: string;
            provider?: string;
            providerOptions?: Record<string, Record<string, any>>;
            status?: "pending" | "success" | "failed";
          };
        },
        {
          _creationTime: number;
          _id: string;
          agentName?: string;
          embeddingId?: string;
          error?: string;
          fileIds?: Array<string>;
          finishReason?:
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error"
            | "other"
            | "unknown";
          id?: string;
          message?:
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          image: string | ArrayBuffer;
                          mediaType?: string;
                          mimeType?: string;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "image";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "user";
              }
            | {
                content:
                  | string
                  | Array<
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          text: string;
                          type: "text";
                        }
                      | {
                          data: string | ArrayBuffer;
                          filename?: string;
                          mediaType?: string;
                          mimeType?: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "file";
                        }
                      | {
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          signature?: string;
                          text: string;
                          type: "reasoning";
                        }
                      | {
                          data: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          type: "redacted-reasoning";
                        }
                      | {
                          args?: any;
                          input: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args: any;
                          input?: any;
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-call";
                        }
                      | {
                          args?: any;
                          experimental_content?: Array<
                            | { text: string; type: "text" }
                            | { data: string; mimeType?: string; type: "image" }
                          >;
                          isError?: boolean;
                          output?:
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-text";
                                value: string;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                type: "error-json";
                                value: any;
                              }
                            | {
                                providerOptions?: Record<string, Record<string, any>>;
                                reason?: string;
                                type: "execution-denied";
                              }
                            | {
                                type: "content";
                                value: Array<
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      text: string;
                                      type: "text";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      type: "media";
                                    }
                                  | {
                                      data: string;
                                      filename?: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "file-id";
                                    }
                                  | {
                                      data: string;
                                      mediaType: string;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-data";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-url";
                                      url: string;
                                    }
                                  | {
                                      fileId: string | Record<string, string>;
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "image-file-id";
                                    }
                                  | {
                                      providerOptions?: Record<string, Record<string, any>>;
                                      type: "custom";
                                    }
                                >;
                              };
                          providerExecuted?: boolean;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          result?: any;
                          toolCallId: string;
                          toolName: string;
                          type: "tool-result";
                        }
                      | {
                          id: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "url";
                          title?: string;
                          type: "source";
                          url: string;
                        }
                      | {
                          filename?: string;
                          id: string;
                          mediaType: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          sourceType: "document";
                          title: string;
                          type: "source";
                        }
                      | {
                          approvalId: string;
                          providerMetadata?: Record<string, Record<string, any>>;
                          providerOptions?: Record<string, Record<string, any>>;
                          toolCallId: string;
                          type: "tool-approval-request";
                        }
                    >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "assistant";
              }
            | {
                content: Array<
                  | {
                      args?: any;
                      experimental_content?: Array<
                        | { text: string; type: "text" }
                        | { data: string; mimeType?: string; type: "image" }
                      >;
                      isError?: boolean;
                      output?:
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-text";
                            value: string;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            type: "error-json";
                            value: any;
                          }
                        | {
                            providerOptions?: Record<string, Record<string, any>>;
                            reason?: string;
                            type: "execution-denied";
                          }
                        | {
                            type: "content";
                            value: Array<
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  text: string;
                                  type: "text";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  type: "media";
                                }
                              | {
                                  data: string;
                                  filename?: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "file-id";
                                }
                              | {
                                  data: string;
                                  mediaType: string;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-data";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-url";
                                  url: string;
                                }
                              | {
                                  fileId: string | Record<string, string>;
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "image-file-id";
                                }
                              | {
                                  providerOptions?: Record<string, Record<string, any>>;
                                  type: "custom";
                                }
                            >;
                          };
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      result?: any;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-result";
                    }
                  | {
                      approvalId: string;
                      approved: boolean;
                      providerExecuted?: boolean;
                      providerMetadata?: Record<string, Record<string, any>>;
                      providerOptions?: Record<string, Record<string, any>>;
                      reason?: string;
                      type: "tool-approval-response";
                    }
                >;
                providerOptions?: Record<string, Record<string, any>>;
                role: "tool";
              }
            | {
                content: string;
                providerOptions?: Record<string, Record<string, any>>;
                role: "system";
              };
          model?: string;
          order: number;
          provider?: string;
          providerMetadata?: Record<string, Record<string, any>>;
          providerOptions?: Record<string, Record<string, any>>;
          reasoning?: string;
          reasoningDetails?: Array<
            | {
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                signature?: string;
                text: string;
                type: "reasoning";
              }
            | { signature?: string; text: string; type: "text" }
            | { data: string; type: "redacted" }
          >;
          sources?: Array<
            | {
                id: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "url";
                title?: string;
                type?: "source";
                url: string;
              }
            | {
                filename?: string;
                id: string;
                mediaType: string;
                providerMetadata?: Record<string, Record<string, any>>;
                providerOptions?: Record<string, Record<string, any>>;
                sourceType: "document";
                title: string;
                type: "source";
              }
          >;
          status: "pending" | "success" | "failed";
          stepOrder: number;
          text?: string;
          threadId: string;
          tool: boolean;
          usage?: {
            cachedInputTokens?: number;
            completionTokens: number;
            promptTokens: number;
            reasoningTokens?: number;
            totalTokens: number;
          };
          userId?: string;
          warnings?: Array<
            | { details?: string; setting: string; type: "unsupported-setting" }
            | { details?: string; tool: any; type: "unsupported-tool" }
            | { message: string; type: "other" }
          >;
        }
      >;
    };
    streams: {
      abort: FunctionReference<
        "mutation",
        "internal",
        {
          finalDelta?: {
            end: number;
            parts: Array<any>;
            start: number;
            streamId: string;
          };
          reason: string;
          streamId: string;
        },
        boolean
      >;
      abortByOrder: FunctionReference<
        "mutation",
        "internal",
        { order: number; reason: string; threadId: string },
        boolean
      >;
      addDelta: FunctionReference<
        "mutation",
        "internal",
        { end: number; parts: Array<any>; start: number; streamId: string },
        boolean
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          agentName?: string;
          format?: "UIMessageChunk" | "TextStreamPart";
          model?: string;
          order: number;
          provider?: string;
          providerOptions?: Record<string, Record<string, any>>;
          stepOrder: number;
          threadId: string;
          userId?: string;
        },
        string
      >;
      deleteAllStreamsForThreadIdAsync: FunctionReference<
        "mutation",
        "internal",
        { deltaCursor?: string; streamOrder?: number; threadId: string },
        { deltaCursor?: string; isDone: boolean; streamOrder?: number }
      >;
      deleteAllStreamsForThreadIdSync: FunctionReference<
        "action",
        "internal",
        { threadId: string },
        null
      >;
      deleteStreamAsync: FunctionReference<
        "mutation",
        "internal",
        { cursor?: string; streamId: string },
        null
      >;
      deleteStreamSync: FunctionReference<"mutation", "internal", { streamId: string }, null>;
      finish: FunctionReference<
        "mutation",
        "internal",
        {
          finalDelta?: {
            end: number;
            parts: Array<any>;
            start: number;
            streamId: string;
          };
          streamId: string;
        },
        null
      >;
      heartbeat: FunctionReference<"mutation", "internal", { streamId: string }, null>;
      list: FunctionReference<
        "query",
        "internal",
        {
          startOrder?: number;
          statuses?: Array<"streaming" | "finished" | "aborted">;
          threadId: string;
        },
        Array<{
          agentName?: string;
          format?: "UIMessageChunk" | "TextStreamPart";
          model?: string;
          order: number;
          provider?: string;
          providerOptions?: Record<string, Record<string, any>>;
          status: "streaming" | "finished" | "aborted";
          stepOrder: number;
          streamId: string;
          userId?: string;
        }>
      >;
      listDeltas: FunctionReference<
        "query",
        "internal",
        {
          cursors: Array<{ cursor: number; streamId: string }>;
          threadId: string;
        },
        Array<{
          end: number;
          parts: Array<any>;
          start: number;
          streamId: string;
        }>
      >;
    };
    threads: {
      createThread: FunctionReference<
        "mutation",
        "internal",
        {
          defaultSystemPrompt?: string;
          parentThreadIds?: Array<string>;
          summary?: string;
          title?: string;
          userId?: string;
        },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }
      >;
      deleteAllForThreadIdAsync: FunctionReference<
        "mutation",
        "internal",
        {
          cursor?: string;
          deltaCursor?: string;
          limit?: number;
          messagesDone?: boolean;
          streamOrder?: number;
          streamsDone?: boolean;
          threadId: string;
        },
        { isDone: boolean }
      >;
      deleteAllForThreadIdSync: FunctionReference<
        "action",
        "internal",
        { limit?: number; threadId: string },
        null
      >;
      getThread: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        } | null
      >;
      listThreadsByUserId: FunctionReference<
        "query",
        "internal",
        {
          order?: "asc" | "desc";
          paginationOpts?: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          userId?: string;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            status: "active" | "archived";
            summary?: string;
            title?: string;
            userId?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      searchThreadTitles: FunctionReference<
        "query",
        "internal",
        { limit: number; query: string; userId?: string | null },
        Array<{
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }>
      >;
      updateThread: FunctionReference<
        "mutation",
        "internal",
        {
          patch: {
            status?: "active" | "archived";
            summary?: string;
            title?: string;
            userId?: string;
          };
          threadId: string;
        },
        {
          _creationTime: number;
          _id: string;
          status: "active" | "archived";
          summary?: string;
          title?: string;
          userId?: string;
        }
      >;
    };
    users: {
      deleteAllForUserId: FunctionReference<"action", "internal", { userId: string }, null>;
      deleteAllForUserIdAsync: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        boolean
      >;
      listUsersWithThreads: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<string>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
    };
    vector: {
      index: {
        deleteBatch: FunctionReference<
          "mutation",
          "internal",
          {
            ids: Array<
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
            >;
          },
          null
        >;
        deleteBatchForThread: FunctionReference<
          "mutation",
          "internal",
          {
            cursor?: string;
            limit: number;
            model: string;
            threadId: string;
            vectorDimension: 128 | 256 | 512 | 768 | 1024 | 1408 | 1536 | 2048 | 3072 | 4096;
          },
          { continueCursor: string; isDone: boolean }
        >;
        insertBatch: FunctionReference<
          "mutation",
          "internal",
          {
            vectorDimension: 128 | 256 | 512 | 768 | 1024 | 1408 | 1536 | 2048 | 3072 | 4096;
            vectors: Array<{
              messageId?: string;
              model: string;
              table: string;
              threadId?: string;
              userId?: string;
              vector: Array<number>;
            }>;
          },
          Array<
            string | string | string | string | string | string | string | string | string | string
          >
        >;
        paginate: FunctionReference<
          "query",
          "internal",
          {
            cursor?: string;
            limit: number;
            table?: string;
            targetModel: string;
            vectorDimension: 128 | 256 | 512 | 768 | 1024 | 1408 | 1536 | 2048 | 3072 | 4096;
          },
          {
            continueCursor: string;
            ids: Array<
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
              | string
            >;
            isDone: boolean;
          }
        >;
        updateBatch: FunctionReference<
          "mutation",
          "internal",
          {
            vectors: Array<{
              id:
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string
                | string;
              model: string;
              vector: Array<number>;
            }>;
          },
          null
        >;
      };
    };
  };
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<"mutation", "internal", { before?: number }, null>;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
};
