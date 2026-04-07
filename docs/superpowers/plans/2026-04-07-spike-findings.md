# OSS Release: Spike Findings

**Date:** 2026-04-07
**Context:** Preparation work for the open-source release. Findings captured here so downstream tasks can reference them.

## Task 0.1: @convex-dev/agent per-request provider construction

**Question:** Can we construct a coach agent per-request with a runtime-supplied Gemini API key?

**Answer:** Yes. Two viable patterns are supported. The recommended one for Task 3.8 is "construct the Agent per request with a fresh provider instance." A second viable pattern is "keep a singleton Agent and pass `model` per call." Both work because `@convex-dev/agent` accepts a per-call `model` override that takes precedence over the constructor's `languageModel`.

### Method note

This spike is a code-reading exercise only. The original Task 0.1 included a vitest smoke test, but we are skipping it because:

- It would require a real Gemini API key in CI.
- The behavior can be conclusively verified from the type definitions and runtime source.
- A live test belongs in Task 3.9 (BYOK integration tests), which is already scoped to cover the end-to-end flow.

### Evidence

1. `@convex-dev/agent` exports an `Agent` class whose constructor requires `languageModel` (the type is `LanguageModel`, not `LanguageModel | undefined`).
   - File: `node_modules/@convex-dev/agent/dist/client/index.d.ts:63` and `:95`
   - File (source): `node_modules/@convex-dev/agent/src/client/index.ts:234`

2. The `AgentPrompt` type (mixed into both `TextArgs` and `StreamingTextArgs`) declares an optional per-call `model` field that overrides the constructor's `languageModel`.
   - File: `node_modules/@convex-dev/agent/dist/client/types.d.ts:57-61`
     ```
     /**
      * The model to use for the LLM calls. This will override the languageModel
      * specified in the Agent config.
      */
     model?: LanguageModel;
     ```
   - The same file confirms the AI SDK's underlying `model` is stripped via `Omit<..., "model" | "prompt" | "messages">` so the `AgentPrompt.model` is the only `model` field on the call args. See `types.d.ts:302` (TextArgs) and `:309` (StreamingTextArgs).

3. The runtime path in `Agent.streamText` confirms the override semantics.
   - File: `node_modules/@convex-dev/agent/src/client/index.ts:570`
     ```
     model: streamTextArgs.model ?? this.options.languageModel,
     ```
   - The `Agent.generateText` path goes through `start()`, which performs the same fallback at `node_modules/@convex-dev/agent/src/client/start.ts:158-159`:
     ```
     const model = args.model ?? opts.languageModel;
     assert(model, "model is required");
     ```

4. `@ai-sdk/google` exports `createGoogleGenerativeAI({ apiKey })` which returns a `GoogleGenerativeAIProvider` you can call to get a `LanguageModel`.
   - File: `node_modules/@ai-sdk/google/dist/index.d.ts:343-376`
     ```
     interface GoogleGenerativeAIProviderSettings {
       apiKey?: string;
       baseURL?: string;
       headers?: Record<string, string | undefined>;
       fetch?: FetchFunction;
       ...
     }
     declare function createGoogleGenerativeAI(
       options?: GoogleGenerativeAIProviderSettings,
     ): GoogleGenerativeAIProvider;
     ```
   - The provider is callable directly and exposes `chat()`, `languageModel()`, and `embedding()` accessors.

5. Current Tonal Coach usage today constructs two singletons in `convex/ai/coach.ts:203-213`, both relying on `google("gemini-...")` which under the hood reads `process.env.GOOGLE_GENERATIVE_AI_API_KEY`.
   - These singletons are consumed by `streamWithRetry` in `convex/ai/resilience.ts:57` via `convex/chat.ts:135-141, 211-217, 271-277` and by `coachAgent.createThread`, `coachAgent.approveToolCall`, and `coachAgent.denyToolCall` in `convex/chat.ts:122, 185, 191`.

### Recommended pattern for Task 3.8

Construct the agents per request inside the action handler, keyed by the user's decrypted Gemini key. The shared `coachAgentConfig` object stays as is so we do not duplicate tool wiring. Only `languageModel` differs between the primary and fallback agent.

Sketch:

```typescript
// convex/ai/coach.ts
import { Agent } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { components } from "../_generated/api";

// coachAgentConfig stays exactly as it is today: tools, contextHandler,
// usageHandler, contextOptions, instructions, maxSteps, embeddingModel.
// (Note: embeddingModel below uses a server-side key, see caveats.)
export const coachAgentConfig = {
  /* unchanged */
};

export interface CoachAgentPair {
  primary: Agent;
  fallback: Agent;
}

/**
 * Build a Gemini-backed coach agent pair using the user-supplied API key.
 * Called inside actions after the key has been decrypted by convex/byok.ts.
 */
export function buildCoachAgents(apiKey: string): CoachAgentPair {
  const provider = createGoogleGenerativeAI({ apiKey });

  const primary = new Agent(components.agent, {
    name: "Tonal Coach",
    languageModel: provider("gemini-3-flash-preview"),
    ...coachAgentConfig,
  });

  const fallback = new Agent(components.agent, {
    name: "Tonal Coach (Fallback)",
    languageModel: provider("gemini-2.5-flash"),
    ...coachAgentConfig,
  });

  return { primary, fallback };
}
```

Then in `convex/chat.ts`, the action that streams a response would look up the decrypted key first, build the agent pair, and pass them into `streamWithRetry`:

```typescript
// convex/chat.ts (sketch for processMessage / sendMessage / continueAfterApproval)
const apiKey = await ctx.runAction(internal.byok.getDecryptedGeminiKey, { userId });
if (!apiKey) {
  // Surface BYOK_MISSING error to the chat UI; do not call the agent.
  return;
}

const { primary, fallback } = buildCoachAgents(apiKey);

await streamWithRetry(ctx, {
  primaryAgent: primary,
  fallbackAgent: fallback,
  threadId,
  userId,
  prompt: resolvedPrompt,
});
```

`streamWithRetry`'s signature in `convex/ai/resilience.ts:39-47` already accepts `Agent` instances and does not need to change. No fork or wrapper of `@convex-dev/agent` is required.

### Why per-request construction beats per-call `model` override

Both work, but per-request construction is preferable for Tonal Coach for these reasons:

- The `@ai-sdk/google` `google` singleton reads `process.env.GOOGLE_GENERATIVE_AI_API_KEY` at request time, so if we ever forget to pass `model` on a single call site, it would silently fall back to the server's env var. A per-request agent makes it impossible to call the LLM without the user's key.
- The `Agent.createThread`, `approveToolCall`, and `denyToolCall` methods (used at `convex/chat.ts:122, 185, 191`) do not take a `model` arg. They do not actually invoke the LLM (they only touch the agent component's storage), so for those calls the `languageModel` value is unused. But we still want a single source of truth: build the agent with the user's key, then call any method on it.
- Tool definitions, context handler, and usage handler are shared across both primary and fallback. We construct two `Agent` instances per request, but each one is cheap (no I/O in the constructor; see `index.ts:255-262`).

### Caveats and risks

1. **Embedding model uses a separate code path.** `coachAgentConfig.embeddingModel` is currently `google.textEmbeddingModel("gemini-embedding-001")` (`convex/ai/coach.ts:107`). The embedding model is used by the agent component for vector search across threads (`searchOtherThreads: true`, `vectorSearch: true`). Embeddings are called from inside the agent component, not from our action code. The agent uses whatever model object you pass at construction time, so if we want embeddings to also bill against the user's key, we must construct the embedding model from the same `provider` instance:

   ```typescript
   const provider = createGoogleGenerativeAI({ apiKey });
   const embeddingModel = provider.embedding("gemini-embedding-001");
   ```

   Then move `embeddingModel` out of `coachAgentConfig` and into `buildCoachAgents`. Decision needed: do we want embeddings to bill the user's key, or do we want to keep a single server-side embedding key (cheaper, simpler)? Recommend asking before Task 3.8 starts. The plan currently assumes the server pays for embeddings, which means we should keep `embeddingModel` in the shared config and construct it from a server-keyed provider that reads `process.env.GOOGLE_GENERATIVE_AI_API_KEY` at module scope. Both options are technically supported.

2. **Constructor cost is negligible but not zero.** Each `new Agent(...)` allocates a new options object and binds tools. There is no I/O. For the volume Tonal Coach handles (one agent build per chat message, plus one per `respondToToolApproval`), this is fine. If we ever add a code path that constructs many agents per request, revisit.

3. **`coachAgent` is also referenced from `convex/playground.ts`.** Per Grep results, the playground module imports `coachAgent`. When we refactor, the playground will also need to either:
   - Construct an agent from a server-supplied key (acceptable for an admin-only playground), or
   - Be removed entirely if it is not used in the OSS release.
     Flag this in Task 3.8.

4. **Tests.** `convex/ai/promptSections.test.ts` imports from `./coach`. Verify nothing in that test file relies on the singleton `coachAgent` export. If we keep `coachAgent` as a fallback export for backward compatibility, the test should still pass; if we delete it, update the test imports.

5. **`assert(model, "model is required")` is the only runtime guard.** If a downstream tweak ever passes `undefined` as the user's key, the call would fail with a generic message at `start.ts:159`. Wrap the BYOK lookup so a missing key throws a typed `BYOK_MISSING` error before reaching the agent. This is already in scope for Task 3.2 and Task 4.5.

6. **AI SDK version pinning.** `@convex-dev/agent` v0.6.1 enforces AI SDK v6 via the `AssertAISDKv6` type guard (`types.d.ts:19-21`). The current installed `@ai-sdk/google` is v3.x of the `@ai-sdk/google` package (which corresponds to AI SDK v6). No upgrade needed for this spike, but pin both packages explicitly when bumping either.

## Task 0.2: Tonal legal entity name

**Question:** What is the exact legal entity name to use in the OSS release disclaimer, LICENSE footer, and hosted app footer?

**Answer:** `Tonal Systems, Inc.` (with a comma before `Inc.`)

**Evidence:**

- Tonal's Terms of Service at `https://www.tonal.com/terms` opens with: _"This Agreement is between you and Tonal Systems, Inc. ("Tonal" or "we" or "us")..."_. This is the authoritative legal framing the OSS disclaimer should mirror.
- Tonal's Privacy Policy at `https://www.tonal.com/privacy` contains a shop address section with `"company":"Tonal Systems Inc."` (no comma). This is a commerce-platform address field, not the legal entity name, and is not authoritative for legal references.

**How to use this in downstream tasks:**

- README callout, LICENSE footer, app footer, GitHub repo description: use `Tonal Systems, Inc.` (with comma)
- Trademark attribution language: _"Tonal is a trademark of Tonal Systems, Inc., used here under nominative fair use."_

No code changes in this task. Findings only.

## Controller note

Task 0.2 was handled directly by the controller (not dispatched to a subagent). Rationale: the task is a single WebFetch plus a two-line append to this file. The three-subagent flow (implementer + spec reviewer + code quality reviewer) is designed for code tasks and is disproportionate for a trivial doc lookup. Task 1.4 (below) was also handled directly for the same reason: the work is a series of greps and a short report, and is closer to diligence than implementation.

## Task 1.4: Privileged-access audit

**Question:** After Tasks 1.1-1.3 removed admin impersonation, are there any OTHER privileged capabilities in the codebase that should be removed, gated, or documented before the OSS release?

**Method:** grepped `convex/` and `src/` for known patterns associated with privileged surface: admin allowlists, hardcoded email special-cases, debug/dev/internal routes, rate limit bypasses, feature flags scoped to specific users, author self-references.

### Findings

**1. `isAdmin`, `requireAdmin`, `admin: true`**

Only matches: `convex/lib/auth.test.ts` (the regression guard test from Task 1.1). The test keeps a fake `isAdmin: true` user on the stub context to prove `getEffectiveUserId` ignores it. Expected and correct. No production code still references these patterns.

**2. Hardcoded email special-cases (`email ===`, `email ==`)**

One match: `convex/emailChange.ts:21` — `if (currentUser?.email === normalizedEmail)`. This is a legitimate "same email, no change needed" check in the email change flow, not an admin backdoor. Safe.

**3. Debug, dev, admin, or internal routes in `src/app/`**

None. The glob `src/app/**/*{admin,debug,dev,internal}*` returned no files. All routes under `src/app/` are user-facing.

**4. Rate limit bypasses (`skipRateLimit`, `bypassLimit`, `adminOverride`, `rateLimitBypass`)**

None. No bypass mechanisms exist.

**5. Feature flags scoped to specific users (`featureFlag`, `FEATURE_FLAG`, `enabledFor`)**

None. No user-scoped feature flags exist.

**6. Author self-references (`jeffrey`, `otano`, `jeffotano`) in code**

None in any `.ts` or `.tsx` file. Clean.

**7. Stale "admin only" or "backdoor" comments**

None in code. Several historical references in documentation:

- `CLAUDE.md:85` and `:250` described `getEffectiveUserId` as "supports admin impersonation." **Fixed in this commit** (see change below).
- `docs/superpowers/specs/2026-03-28-posthog-analytics-design.md:213-214` lists `impersonation_started` / `impersonation_stopped` events. **Left unchanged.** Historical design doc describing what was true at the time; rewriting it would falsify history.
- `docs/superpowers/plans/2026-03-28-posthog-analytics.md:60, 447, 448, 990, 1020, 1022, 1026, 1027, 1054` references the deleted components and events. **Left unchanged.** Historical plan.
- `docs/superpowers/plans/2026-03-28-tonal-profile-sync.md:86` has an `impersonatingUserId` entry in an old schema snippet. **Left unchanged.** Historical plan.
- `docs/superpowers/specs/2026-04-07-open-source-release-design.md` and `docs/superpowers/plans/2026-04-07-open-source-release.md` reference admin impersonation as something being removed in this release. **Correct and should stay.**
- `ios/TonalCoach/Onboarding/TrainingOnboardingFlow.swift:41` has a stale comment mentioning impersonation. **Out of scope.** iOS is not in the OSS release; the iOS app will stay in the private repo and can fix stale comments on its own schedule.

### CLAUDE.md fixes applied in this commit

- Line 85: "supports admin impersonation" replaced with "thin wrapper over `getAuthUserId`"
- Line 250: "auth + admin impersonation support" replaced with "to resolve the authenticated user"

### Remaining follow-ups (not blocking)

- Consider a separate cleanup pass on the historical `docs/superpowers/` files if they end up in the public repo and the stale references become confusing. The filter-repo exclusion list in Task 7.2 should decide whether these old plans ship publicly at all.

### Conclusion

No additional privileged capabilities were found beyond what Tasks 1.1-1.3 already removed. The security hardening phase is complete for code purposes. The only remaining work is the launch-day prod data cleanup for stale `impersonatingUserId` values (flagged in the Task 1.2 review; belongs in the Phase 8 cutover).

## Task 3.8a follow-up: routing remaining LLM call sites through BYOK

Code review on Task 3.8 surfaced three `generateText` call sites outside `convex/ai/coach.ts` that were still binding to the default `@ai-sdk/google` client and therefore reading `GOOGLE_GENERATIVE_AI_API_KEY` directly from process env. Without this fix, BYOK users would have had chat correctly billed to their key but library generation and progress photo analysis silently billing the operator. This task closed those gaps:

- **`convex/ai/resilience.ts`** — extracted `withByokErrorSanitization`, originally a private helper inside `convex/chat.ts`, into a shared export so every call site can wrap its `generateText` invocation in the same sanitizer. Added three unit tests covering success, BYOK rethrow with key-leak guard, and non-BYOK passthrough.
- **`convex/coach/libraryGeneration.ts`** — `buildLibraryWorkout` now takes an `apiKey` parameter and instantiates a per-request `createGoogleGenerativeAI({ apiKey })` provider rather than calling the ambient `google("...")` factory. The LLM call is wrapped in `withByokErrorSanitization`. Documented that the caller must always pass the house key here because library generation is operator-run from `scripts/generate-library.sh` and produces a shared catalog with no per-user context.
- **`convex/coach/libraryGenerationActions.ts`** — `generateBatch` and `generateDescriptions` now resolve the house key explicitly via a small `getHouseGeminiKeyForLibraryGeneration()` helper that throws if the env var is missing, then build a per-request provider. The helper exists so future maintainers cannot accidentally swap in the implicit ambient client.
- **`convex/progressPhotos.ts`** — `compareProgressPhotos` is an `internalAction` that already takes `userId` as an argument (called from the `compare_progress_photos` coach tool, which has full auth context). Added a `resolveUserGeminiKey` helper mirroring the one in `convex/chat.ts` that runs `internal.byok._getKeyResolutionContext` and defers to `resolveGeminiKey`, then instantiates a per-request provider. Photo comparison is multimodal and one of the more expensive Gemini calls in the product, which makes the BYOK-no-fallback invariant especially important here.

No mutation-runtime blockers were hit: every billable LLM call lives in an `action` or `internalAction`, where Web Crypto and `runQuery` are both available. Library generation correctly stays on the house key because there is no caller-supplied user identity, and that decision is now documented in code rather than implicit. Typecheck clean, full suite passes (787 tests, +3 from this change).

## Operator runbook: encryption key rotation

Two encryption keys can be rotated independently using the migrations under `convex/migrations/`:

- `TOKEN_ENCRYPTION_KEY` (Tonal OAuth tokens, Google Calendar OAuth tokens, BYOK Gemini keys) - rotated by `migrations/rotateTokenEncryptionKey:run` (an `internalMutation`).
- `PROGRESS_PHOTOS_ENCRYPTION_KEY` (encrypted progress photo blobs in Convex `_storage`) - rotated by `migrations/rotateProgressPhotoEncryptionKey:run` (an `internalAction`, because it has to read, re-encrypt, and re-store storage blobs).

Both share the same procedure shape. Substitute the right key name in the env vars and the right migration path in step 4.

### Procedure

1. Back up the prod Convex database first: `npx convex export --path <file>.zip`
2. Set the OLD key in Convex env:
   - `npx convex env set TOKEN_ENCRYPTION_KEY_OLD <current-key>`
   - or `npx convex env set PROGRESS_PHOTOS_ENCRYPTION_KEY_OLD <current-key>`
3. Set the NEW key in Convex env:
   - `npx convex env set TOKEN_ENCRYPTION_KEY <new-key>`
   - or `npx convex env set PROGRESS_PHOTOS_ENCRYPTION_KEY <new-key>`
4. Run the migration:
   - `npx convex run migrations/rotateTokenEncryptionKey:run`
   - or `npx convex run migrations/rotateProgressPhotoEncryptionKey:run`
5. Verify the output: `{ rotated: <n>, skipped: 0, errors: [] }`
6. Smoke test:
   - For `TOKEN_ENCRYPTION_KEY`: log in as a user and verify their Tonal data loads (proves their token decrypted with the new key).
   - For `PROGRESS_PHOTOS_ENCRYPTION_KEY`: open the Progress Photos screen as a user and verify a thumbnail loads (proves the new ciphertext decrypts with the new key).
7. Unset the OLD key:
   - `npx convex env remove TOKEN_ENCRYPTION_KEY_OLD`
   - or `npx convex env remove PROGRESS_PHOTOS_ENCRYPTION_KEY_OLD`

The token rotation is structured as a single `internalMutation` so all profiles either succeed or get individually counted as skipped. The photo rotation uses an `internalAction` because storage blob APIs are only available in actions; failed rows are similarly counted as skipped, and the row is not patched until the new blob has been written.
