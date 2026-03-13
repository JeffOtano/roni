# MCP Integration: Embedded Tonal MCP Server

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Embed an MCP server inside the Convex backend so any tonal-coach user can connect Claude Desktop/Code to their Tonal data.

---

## 1. Problem

The standalone tonal-mcp project provides Claude with direct access to Tonal fitness data (profiles, analytics, workout creation). It works well as a personal tool but requires hardcoded credentials and runs as a separate process. To make this available to all tonal-coach users, the MCP server needs to authenticate through existing Convex-managed tokens and deploy as part of the main application.

## 2. Goals

1. **Full MCP parity** -- all 15 tools, 3 resources, and 3 prompts from tonal-mcp available via Convex HTTP endpoint.
2. **Multi-user** -- any tonal-coach user with a connected Tonal account can generate an API key and use the MCP server.
3. **Single deployment** -- no separate server to manage. MCP is a Convex HTTP route.
4. **Shared infrastructure** -- MCP tools use the same caching, token retry, and Tonal API proxy as the web app.
5. **Monorepo** -- move tonal-mcp source into `docs/reference/tonal-mcp-original/` as archived reference material.

## 3. Non-Goals

- OAuth-based MCP auth (API key is sufficient for v1)
- SSE/WebSocket transport (Streamable HTTP only)
- MCP server SDK dependency in Convex (stateless handler instead)
- Hosted MCP proxy for non-Convex deployments

---

## 4. Architecture

### 4.1 High-Level Data Flow

```
Claude Desktop / Claude Code
  -> POST https://<deployment>.convex.site/mcp
  -> Authorization: Bearer <api-key>
  -> JSON-RPC 2.0 request body
  -> Convex HTTP action (convex/mcp/server.ts)
     -> Validates API key, resolves userId
     -> Routes JSON-RPC method to handler
     -> Handler calls existing Convex actions (proxy, cache, tokenRetry)
     -> Returns JSON-RPC 2.0 response
```

### 4.2 File Structure

```
convex/
  mcp/
    server.ts          # HTTP action: JSON-RPC dispatcher
    auth.ts            # API key validation + userId resolution
    keys.ts            # generateMcpApiKey, revokeMcpApiKey, listMcpApiKeys
    usage.ts           # logMcpUsage mutation
    tools/
      user.ts          # get_user_profile, get_strength_scores, get_muscle_readiness
      exercises.ts     # list_movements, search_movements, get_movements_by_id
      workouts.ts      # create_custom_workout, estimate_workout, list_custom_workouts, delete_custom_workout
      analytics.ts     # list_workout_history, get_workout_detail, get_workout_movements, get_progress_metrics, get_strength_score_history, get_training_frequency
    resources.ts       # exercises, user-profile, muscle-readiness
    prompts.ts         # build_workout, weekly_plan, analyze_progress
  http.ts              # Add POST /mcp route
```

HTTP route registration in `convex/http.ts`:

```typescript
import { mcpHandler } from "./mcp/server";

http.route({
  path: "/mcp",
  method: "POST",
  handler: mcpHandler,
});
```

### 4.3 Reference Material

```
docs/reference/
  tonal-mcp-original/  # Archived tonal-mcp source (read-only reference, not running code)
    src/               # Original source files
    package.json
    README.md
```

---

## 5. MCP Protocol Layer

### 5.1 Transport

**Streamable HTTP** via a single Convex HTTP action at `POST /mcp`. Each request is a self-contained JSON-RPC 2.0 message. No session state.

### 5.2 Stateless Design

Convex HTTP actions are stateless -- there is no persistent server instance. The MCP SDK's `McpServer` class assumes a long-lived process, so we implement a lightweight JSON-RPC dispatcher instead.

The dispatcher handles these methods:

| JSON-RPC Method             | Handler                                                 |
| --------------------------- | ------------------------------------------------------- |
| `initialize`                | Returns server capabilities (tools, resources, prompts) |
| `tools/list`                | Returns tool definitions with Zod-derived JSON schemas  |
| `tools/call`                | Validates args, calls Convex action, returns result     |
| `resources/list`            | Returns resource definitions                            |
| `resources/read`            | Fetches data, returns resource content                  |
| `prompts/list`              | Returns prompt definitions                              |
| `prompts/get`               | Returns parameterized prompt messages                   |
| `notifications/initialized` | No-op acknowledgment                                    |
| `ping`                      | Returns pong                                            |

### 5.3 Error Handling

JSON-RPC errors follow the spec:

| Code   | Meaning             | When                                                               |
| ------ | ------------------- | ------------------------------------------------------------------ |
| -32600 | Invalid request     | Malformed JSON-RPC                                                 |
| -32601 | Method not found    | Unknown method                                                     |
| -32602 | Invalid params      | Zod validation failure on tool args                                |
| -32603 | Internal error      | Tonal API failure, unexpected error                                |
| -32000 | Unauthorized        | Invalid or missing API key                                         |
| -32001 | Tonal not connected | User has no linked Tonal account (project-specific extension code) |

---

## 6. Authentication

### 6.1 API Key Lifecycle

Users can create multiple API keys (e.g., one per device: Claude Desktop at home, Claude Code at work).

**Generate:**

1. User visits `/settings` in tonal-coach
2. Clicks "Create API Key"
3. Optionally enters a label (e.g., "Claude Desktop - MacBook Pro")
4. `generateMcpApiKey` mutation:
   - Generates 32 random bytes, base64url-encoded
   - Hashes with SHA-256
   - Inserts row into `mcpApiKeys` table with hash, label, userId, timestamps
   - Returns plaintext key (shown once)
5. User copies key into Claude Desktop/Code config

**Revoke:**

- User clicks "Revoke" next to a specific key in the list
- `revokeMcpApiKey` mutation (args: `{ keyId }`): deletes the row from `mcpApiKeys`. Returns `{ revoked: true }`
- Verifies ownership (key's userId matches authenticated user)

**List:**

- Settings page shows all active keys via `listMcpApiKeys` query
- Displays: label, created date, last used date
- No plaintext key shown (only stored as hash)

### 6.2 Schema Changes

New `mcpApiKeys` table:

```typescript
mcpApiKeys: defineTable({
  userId: v.id("users"),
  keyHash: v.string(), // SHA-256 hash of the plaintext key
  label: v.optional(v.string()), // User-provided label (e.g., "Claude Desktop")
  createdAt: v.number(),
  lastUsedAt: v.optional(v.number()),
})
  .index("by_keyHash", ["keyHash"])
  .index("by_userId", ["userId"]);
```

New `mcpUsage` table (see Section 11.2):

```typescript
mcpUsage: defineTable({
  userId: v.id("users"),
  keyId: v.id("mcpApiKeys"),
  tool: v.string(), // tool name or "resource:uri" or "prompt:name"
  calledAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_calledAt", ["userId", "calledAt"]);
```

No changes to `userProfiles` table.

### 6.3 Request Validation (`convex/mcp/auth.ts`)

```
1. Extract Authorization header -> Bearer <key>
2. SHA-256 hash the key
3. Query mcpApiKeys.by_keyHash for matching hash
4. If not found -> JSON-RPC error -32000 (Unauthorized)
5. If found -> update lastUsedAt on the key row
6. Load userProfile by key's userId
7. If no tonalToken on profile -> JSON-RPC error -32001 (Tonal not connected)
8. Return { userId, userProfile, keyId }
```

### 6.4 Security

- Plaintext key never stored -- only SHA-256 hash
- Key is scoped to MCP access only (cannot authenticate web sessions)
- Rate limited: 30 requests/minute per userId (reuses `rateLimiter` pattern)
- Requires connected Tonal account (tools fail gracefully otherwise)
- Key revocation is immediate -- next request with revoked key returns -32000
- Ownership verified on revoke (cannot delete another user's keys)

---

## 7. Tools

### 7.1 User Tools (`convex/mcp/tools/user.ts`)

| Tool                   | Description                                   | Existing Convex Action                              |
| ---------------------- | --------------------------------------------- | --------------------------------------------------- |
| `get_user_profile`     | User profile (name, stats, account info)      | `fetchUserProfile`                                  |
| `get_strength_scores`  | Current strength per body region + percentile | `fetchStrengthScores` + `fetchStrengthDistribution` |
| `get_muscle_readiness` | Muscle recovery status (0-100 per group)      | `fetchMuscleReadiness`                              |

### 7.2 Exercise Tools (`convex/mcp/tools/exercises.ts`)

| Tool                  | Description                                     | Existing Convex Action              |
| --------------------- | ----------------------------------------------- | ----------------------------------- |
| `list_movements`      | Full exercise catalog (ID, name, muscle groups) | `fetchMovements`                    |
| `search_movements`    | Filter by name, muscle group, on/off machine    | `fetchMovements` + in-memory filter |
| `get_movements_by_id` | Batch lookup by UUID                            | `fetchMovements` + Map lookup       |

`search_movements` parameters:

- `name` (optional string) -- substring match, case-insensitive
- `muscleGroup` (optional string) -- filter by muscle group
- `onMachine` (optional boolean) -- on-machine vs free-lift

`get_movements_by_id` parameters:

- `movementIds` (string[] UUIDs, 1-50) -- batch lookup

### 7.3 Workout Tools (`convex/mcp/tools/workouts.ts`)

| Tool                    | Description                         | Existing Convex Action                            |
| ----------------------- | ----------------------------------- | ------------------------------------------------- |
| `create_custom_workout` | Create workout from block structure | `doTonalCreateWorkout` (via `tonal/mutations.ts`) |
| `estimate_workout`      | Estimate duration before creating   | `estimateWorkout` (via `tonal/mutations.ts`)      |
| `list_custom_workouts`  | List user's custom workouts         | `fetchCustomWorkouts`                             |
| `delete_custom_workout` | Delete a custom workout by ID       | existing delete in `tonal/mutations.ts`           |

Workout creation payload schema (top-level `title` is the workout name; each block contains only the `exercises` array):

```typescript
{
  title: string,
  blocks: [{
    exercises: [{
      movementId: string (UUID),
      sets: number (1-10, default 3),
      reps?: number,
      duration?: number (seconds, for timed exercises),
      spotter: boolean (default false),
      eccentric: boolean (default false),
      warmUp: boolean (default false),
    }]
  }]
}
```

Block-to-sets transformation uses the existing `expandBlocksToSets` in `convex/tonal/transforms.ts`.

### 7.4 Analytics Tools (`convex/mcp/tools/analytics.ts`)

| Tool                         | Description                              | Convex Action                                  | Status  |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------- | ------- |
| `list_workout_history`       | Recent workouts with summaries           | `fetchWorkoutHistory`                          | Exists  |
| `get_workout_detail`         | Full set-by-set breakdown                | `fetchWorkoutDetail` + `fetchFormattedSummary` | Exists  |
| `get_workout_movements`      | Per-exercise performance data            | **New action**                                 | New     |
| `get_progress_metrics`       | Aggregated volume/frequency/duration     | **New action**                                 | New     |
| `get_strength_score_history` | Strength trend over time                 | `fetchStrengthHistory`                         | Exists  |
| `get_training_frequency`     | Sessions per target area with days-since | Exists, **needs enhancement**                  | Enhance |

### 7.5 New Convex Actions

Both new actions are `internalAction` (not exposed to web clients) since they're consumed exclusively by the MCP layer. They may be promoted to public actions later if the web app needs them.

**`fetchWorkoutMovements(userId, activityId)`** -- added to `convex/tonal/proxy.ts`

Groups sets from a workout detail by exercise. Returns per-movement stats:

- Exercise name, movement ID
- Total sets, total reps, volume (lbs)
- Average weight per rep
- Spotter/eccentric usage
- Individual set details

Implementation: calls `fetchWorkoutDetail` + `fetchFormattedSummary` (both exist), then aggregates by movementId. Uses cached movements list for name resolution.

**`fetchProgressMetrics(userId, limit)`** -- added to `convex/tonal/proxy.ts`

Aggregates across recent workouts:

- Total workouts, volume, duration
- Average volume per workout, average duration
- Workouts grouped by target area

Implementation: calls `fetchWorkoutHistory`, aggregates in-memory.

**`fetchTrainingFrequency(userId, days)`** -- new `internalAction` in `convex/tonal/proxy.ts` (does not modify the existing `getTrainingFrequencyTool` in `convex/ai/tools.ts`)

Returns:

```typescript
{
  periodDays: number,
  totalSessions: number,
  sessionsPerWeek: number,
  byTargetArea: Array<{
    targetArea: string,
    sessions: number,
    totalVolumeLbs: number,
    lastWorkout: string,       // ISO date
    daysSinceLastWorkout: number,
  }>
}
```

Implementation: calls `fetchWorkoutHistory(userId, 100)`, filters to `days` window, aggregates by target area.

---

## 8. Resources

Three read-only data resources exposed via `resources/read`:

| Resource           | URI                        | Description                                                              | Data Source                                |
| ------------------ | -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| `exercises`        | `tonal://exercises`        | Full movement catalog (ID, name, muscle groups, skill level, on-machine) | `fetchMovements`                           |
| `user-profile`     | `tonal://user-profile`     | User profile + current strength scores snapshot                          | `fetchUserProfile` + `fetchStrengthScores` |
| `muscle-readiness` | `tonal://muscle-readiness` | Per-muscle recovery status (0-100)                                       | `fetchMuscleReadiness`                     |

Resources return `{ contents: [{ uri, mimeType: "application/json", text }] }`.

---

## 9. Prompts

Three parameterized prompts that guide Claude through multi-step workflows:

### 9.1 `build_workout`

**Description:** Build a custom Tonal workout targeting specific muscle groups and duration.

**Parameters:**

- `muscleGroups` (string) -- comma-separated target muscles
- `durationMinutes` (string) -- target duration
- `difficulty` (string) -- beginner, intermediate, or advanced

**Output:** System message with step-by-step instructions:

1. Search movements for target muscles
2. Select 4-8 balanced exercises
3. Group into blocks (1-2 exercises per block)
4. Estimate duration
5. Adjust if needed
6. Create the workout

### 9.2 `weekly_plan`

**Description:** Design a weekly Tonal training plan based on goals and recovery.

**Parameters:**

- `daysPerWeek` (string) -- training days (3-6)
- `goals` (string) -- strength, endurance, or hybrid

**Output:** System message with instructions to check recovery, review history, design split, and create workouts for each day.

### 9.3 `analyze_progress`

**Description:** Analyze Tonal training progress and suggest improvements.

**Parameters:**

- `timeframe` (string) -- week, month, or quarter

**Output:** System message with instructions to fetch metrics, analyze patterns (frequency, volume, balance), and provide recommendations.

---

## 10. Settings UI

### 10.1 New Section in `/settings`

Add a "Claude Integration" card to the existing settings page:

**States:**

1. **No keys:** Shows description of Claude integration + "Create API Key" button
2. **Key just created:** Shows the plaintext key with copy button + warning ("This key won't be shown again") + copyable Claude Desktop config JSON + "Done" button
3. **Keys exist:** Shows list of active keys with label, created date, last used date, and "Revoke" button per key. "Create API Key" button to add more.

### 10.2 Claude Desktop Config Snippet

Pre-filled and copyable:

```json
{
  "mcpServers": {
    "tonal-coach": {
      "url": "https://<deployment>.convex.site/mcp",
      "headers": {
        "Authorization": "Bearer <their-key>"
      }
    }
  }
}
```

The deployment URL is derived from `NEXT_PUBLIC_CONVEX_URL` (replace `.cloud` with `.site`).

---

## 11. Rate Limiting

Add to `convex/rateLimits.ts`:

```typescript
mcpRequest: {
  kind: "token bucket",
  rate: 30,
  period: MINUTE,
  capacity: 10,
},
```

30 requests/minute per userId (resolved from API key hash lookup) with burst capacity of 10. This prevents abuse while allowing normal Claude tool-call patterns (typically 3-8 calls per interaction).

### 11.2 Usage Analytics

Every MCP tool call, resource read, and prompt get is logged to the `mcpUsage` table:

```typescript
{
  userId: Id<"users">,
  keyId: Id<"mcpApiKeys">,
  tool: string,        // "get_user_profile", "resource:exercises", "prompt:build_workout"
  calledAt: number,
}
```

This enables:

- Per-user usage dashboards (which tools are most used)
- Key-level activity tracking (which device is most active)
- Product analytics (most popular tools across all users)
- Abuse detection (unusual call patterns)

Usage is recorded asynchronously via `ctx.runMutation` after the tool response is sent, so it doesn't add latency to MCP responses.

The `lastUsedAt` field on `mcpApiKeys` is also updated on each request for quick "last active" display in settings.

---

## 12. Testing Strategy

### 12.1 Unit Tests

- **JSON-RPC dispatcher** (`convex/mcp/server.test.ts`): Verify routing, error codes, and response format for each method.
- **Auth** (`convex/mcp/auth.test.ts`): Key hashing, lookup, missing key, invalid key, no Tonal connection.
- **Tool wrappers** (one test file per tool module): Verify arg validation and response formatting. Mock the underlying Convex actions.
- **New analytics actions**: Test aggregation logic with fixture data.
- **Key management** (`convex/mcp/keys.test.ts`): Generate key, revoke key, hash validation, multiple keys per user, ownership verification on revoke.
- **Usage tracking**: Verify `mcpUsage` rows are created on tool calls, `lastUsedAt` updated on key.

### 12.2 Integration Tests

- End-to-end: generate API key -> call `initialize` -> call `tools/list` -> call a tool -> verify response.
- Auth flow: invalid key returns -32000, missing Tonal connection returns -32001.

### 12.3 What Not to Test

- Existing Convex actions (already tested)
- MCP protocol spec compliance beyond what we implement
- Tonal API responses (mocked at the action boundary)

---

## 13. Migration & Rollout

1. **Schema migration:** Add `mcpApiKeys` and `mcpUsage` tables. No changes to existing tables -- no data migration needed.
2. **Deploy:** New HTTP route and MCP handler deploy with normal `convex deploy`.
3. **Feature flag:** None needed. The MCP endpoint exists but is inert until a user generates a key.
4. **Monorepo move:** Copy tonal-mcp into `docs/reference/tonal-mcp-original/` as read-only reference (avoids creating a `packages/` directory for non-runnable code). Original repo can be archived.

---

## 14. Client Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "tonal-coach": {
      "url": "https://<deployment>.convex.site/mcp",
      "headers": {
        "Authorization": "Bearer <api-key>"
      }
    }
  }
}
```

### Claude Code

```json
{
  "mcpServers": {
    "tonal-coach": {
      "type": "url",
      "url": "https://<deployment>.convex.site/mcp",
      "headers": {
        "Authorization": "Bearer <api-key>"
      }
    }
  }
}
```

---

## 15. Resolved Decisions

1. **Multi-key support:** Yes. Users can create multiple labeled API keys (one per device). Separate `mcpApiKeys` table instead of fields on `userProfiles`.
2. **Usage analytics:** Yes. All MCP calls logged to `mcpUsage` table. Per-key `lastUsedAt` tracking. Enables product analytics and abuse detection.
3. **Tool descriptions in settings:** No. Settings page shows only the key management UI and config snippet. Tool discovery happens through the MCP protocol itself (`tools/list`).
