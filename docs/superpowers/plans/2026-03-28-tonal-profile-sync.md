# Tonal Profile Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync additional Tonal profile fields (firstName, lastName, dateOfBirth, username, tonalCreatedAt) into the `users` and `userProfiles` tables, fix the `TonalUser` type, add age to AI context, and provide a one-time backfill action.

**Architecture:** Extend `TonalUser` type with missing fields, add optional fields to both `users` and `userProfiles` schemas, update the connect and refresh flows to write the new fields, and add a backfill action that iterates all existing users. The existing 24h profile refresh (via `maybeRefreshProfile`) handles recurring sync with no new cron needed.

**Tech Stack:** Convex (schema, mutations, actions), TypeScript

---

### Task 1: Fix TonalUser type

**Files:**

- Modify: `convex/tonal/types.ts:2-19`

- [ ] **Step 1: Add workoutDurationMin and workoutDurationMax to TonalUser**

```typescript
// User profile from GET /v6/users/{userId}
export interface TonalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  heightInches: number;
  weightPounds: number;
  auth0Id: string;
  dateOfBirth: string;
  username: string;
  workoutsPerWeek: number;
  workoutDurationMin: number;
  workoutDurationMax: number;
  tonalStatus: string;
  accountType: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (new fields are additive; the `as unknown` casts in connect.ts and historySync.ts will still compile but are now unnecessary - we fix those in later tasks)

- [ ] **Step 3: Commit**

```bash
git add convex/tonal/types.ts
git commit -m "fix: add workoutDurationMin/Max to TonalUser type"
```

---

### Task 2: Extend schemas

**Files:**

- Modify: `convex/schema.ts:10-24` (users table)
- Modify: `convex/schema.ts:33-45` (userProfiles.profileData)

- [ ] **Step 1: Add firstName and lastName to users table**

In `convex/schema.ts`, add two fields to the `users` table definition, after the `name` field:

```typescript
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
    /** Whether this user has admin privileges. */
    isAdmin: v.optional(v.boolean()),
    /** When set, the admin sees the app as this user. */
    impersonatingUserId: v.optional(v.id("users")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
```

- [ ] **Step 2: Add new fields to userProfiles.profileData**

In `convex/schema.ts`, extend the `profileData` object to include the three new optional fields:

```typescript
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
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL - the `profileData` object shape in `userProfiles.ts` (create mutation args and updateProfileData args) no longer matches the schema. We fix these in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add Tonal profile fields to users and userProfiles schemas"
```

---

### Task 3: Update userProfiles mutations

**Files:**

- Modify: `convex/userProfiles.ts:17-66` (create mutation)
- Modify: `convex/userProfiles.ts:311-337` (updateProfileData mutation)

- [ ] **Step 1: Extend create mutation args and handler to include new profileData fields and patch users table**

Replace the `create` mutation's `profileData` arg validator to include the new optional fields, and update the handler to also patch the `users` table:

```typescript
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    tonalUserId: v.string(),
    tonalEmail: v.optional(v.string()),
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
        dateOfBirth: v.optional(v.string()),
        username: v.optional(v.string()),
        tonalCreatedAt: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Sync name fields to users table
    if (args.profileData) {
      await ctx.db.patch(args.userId, {
        firstName: args.profileData.firstName,
        lastName: args.profileData.lastName,
        name: `${args.profileData.firstName} ${args.profileData.lastName}`,
      });
    }

    // Upsert: check if profile exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tonalUserId: args.tonalUserId,
        tonalEmail: args.tonalEmail,
        tonalToken: args.tonalToken,
        tonalRefreshToken: args.tonalRefreshToken,
        tonalTokenExpiresAt: args.tonalTokenExpiresAt,
        profileData: args.profileData,
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      ...args,
      lastActiveAt: now,
      tonalConnectedAt: now,
    });
  },
});
```

- [ ] **Step 2: Extend updateProfileData mutation to include new fields and patch users table**

Replace the `updateProfileData` mutation:

```typescript
/** Refresh cached profile data from Tonal API response. */
export const updateProfileData = internalMutation({
  args: {
    userId: v.id("users"),
    profileData: v.object({
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
  },
  handler: async (ctx, { userId, profileData }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, {
      profileData,
      profileDataRefreshedAt: Date.now(),
    });

    // Sync name fields to users table
    await ctx.db.patch(userId, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      name: `${profileData.firstName} ${profileData.lastName}`,
    });
  },
});
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL - `connect.ts` and `historySync.ts` still pass the old shape (missing new fields). We fix those next.

- [ ] **Step 4: Commit**

```bash
git add convex/userProfiles.ts
git commit -m "feat: extend create and updateProfileData with new Tonal fields"
```

---

### Task 4: Update connect flow

**Files:**

- Modify: `convex/tonal/connect.ts:40-51`

- [ ] **Step 1: Include new fields in profileData and remove unsafe casts**

Replace the `profileData` object in the `connectTonal` action:

```typescript
      profileData: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        heightInches: profile.heightInches,
        weightPounds: profile.weightPounds,
        gender: profile.gender,
        level: profile.tonalStatus ?? "",
        workoutsPerWeek: profile.workoutsPerWeek,
        workoutDurationMin: profile.workoutDurationMin ?? 0,
        workoutDurationMax: profile.workoutDurationMax ?? 0,
        dateOfBirth: profile.dateOfBirth || undefined,
        username: profile.username || undefined,
        tonalCreatedAt: profile.createdAt || undefined,
      },
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL - `historySync.ts` still has the old casts. We fix that next.

- [ ] **Step 3: Commit**

```bash
git add convex/tonal/connect.ts
git commit -m "feat: sync new Tonal profile fields on connect"
```

---

### Task 5: Update profile refresh in historySync

**Files:**

- Modify: `convex/tonal/historySync.ts:191-206`

- [ ] **Step 1: Update maybeRefreshProfile to include new fields and remove unsafe casts**

Replace the `profileData` object inside `maybeRefreshProfile`:

```typescript
await ctx.runMutation(internal.userProfiles.updateProfileData, {
  userId,
  profileData: {
    firstName: u.firstName,
    lastName: u.lastName,
    heightInches: u.heightInches,
    weightPounds: u.weightPounds,
    gender: u.gender,
    level: u.tonalStatus ?? "",
    workoutsPerWeek: u.workoutsPerWeek,
    workoutDurationMin: u.workoutDurationMin ?? 0,
    workoutDurationMax: u.workoutDurationMax ?? 0,
    dateOfBirth: u.dateOfBirth || undefined,
    username: u.username || undefined,
    tonalCreatedAt: u.createdAt || undefined,
  },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS - all `profileData` shapes now match the schema.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run --project backend`
Expected: PASS - no behavior changed, only additive optional fields.

- [ ] **Step 4: Commit**

```bash
git add convex/tonal/historySync.ts
git commit -m "fix: remove unsafe casts, include new fields in profile refresh"
```

---

### Task 6: Add age to AI context

**Files:**

- Modify: `convex/ai/context.ts:110-111`
- Test: `convex/ai/context.test.ts`

- [ ] **Step 1: Write a test for age in the profile line**

Add a new test at the end of `convex/ai/context.test.ts`, after the existing `buildExerciseCatalogSection` describe block. We cannot test `buildTrainingSnapshot` directly (it needs Convex runtime), but we can verify the age computation helper. Add a `computeAge` helper to `convex/ai/snapshotHelpers.ts` and test it:

First, add to `convex/ai/snapshotHelpers.ts` (at the end of the file):

```typescript
/** Compute age in years from an ISO date-of-birth string. Returns null if invalid. */
export function computeAge(dateOfBirth: string | undefined, now: Date): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
```

Then add the test to `convex/ai/context.test.ts`:

```typescript
import { computeAge } from "./snapshotHelpers";

describe("computeAge", () => {
  it("computes age correctly before birthday this year", () => {
    const now = new Date("2026-03-28");
    expect(computeAge("1993-12-15", now)).toBe(32);
  });

  it("computes age correctly after birthday this year", () => {
    const now = new Date("2026-03-28");
    expect(computeAge("1993-01-10", now)).toBe(33);
  });

  it("returns null for undefined dateOfBirth", () => {
    expect(computeAge(undefined, new Date())).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(computeAge("not-a-date", new Date())).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run convex/ai/context.test.ts`
Expected: FAIL - `computeAge` not yet exported from snapshotHelpers (we added the function but haven't saved it yet if doing TDD strictly, but since we need to add both the function and test, save both and verify the test passes).

- [ ] **Step 3: Verify tests pass**

Run: `npx vitest run convex/ai/context.test.ts`
Expected: PASS

- [ ] **Step 4: Update context.ts to include age in profile line**

In `convex/ai/context.ts`, add the import and modify the profile line:

Add to imports at the top of `convex/ai/context.ts`:

```typescript
import { computeAge } from "./snapshotHelpers";
```

Note: `computeAge` should be added to the existing import from `"./snapshotHelpers"`. The file already imports `buildExerciseCatalogSection`, `buildHealthSection`, `formatExternalActivityLine`, `getHrIntensityLabel`, `type HealthSnapshotData`, `SNAPSHOT_MAX_CHARS`, `type SnapshotSection`, and `trimSnapshot` from this module.

Then replace the profile line (line 110-112 area):

```typescript
const profileLines: string[] = [];
const ageSuffix = pd.dateOfBirth
  ? (() => {
      const age = computeAge(pd.dateOfBirth, new Date());
      return age !== null ? ` | Age: ${age}` : "";
    })()
  : "";
profileLines.push(
  `User: ${pd.firstName} ${pd.lastName} | ${pd.heightInches}"/${pd.weightPounds}lbs${ageSuffix} | Level: ${pd.level} | ${pd.workoutsPerWeek}x/week`,
);
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npx vitest run convex/ai/context.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/snapshotHelpers.ts convex/ai/context.ts convex/ai/context.test.ts
git commit -m "feat: add user age from Tonal profile to AI context snapshot"
```

---

### Task 7: Add backfill action

**Files:**

- Create: `convex/tonal/profileBackfill.ts`

- [ ] **Step 1: Create the backfill action**

Create `convex/tonal/profileBackfill.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * One-time backfill: fetch fresh Tonal profile for all users and sync
 * new fields (dateOfBirth, username, tonalCreatedAt) into userProfiles
 * and name fields into the users table.
 *
 * Run manually: npx convex run --prod tonal/profileBackfill:backfillAllProfiles
 */
export const backfillAllProfiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const threeDaysAgo = 0; // Get ALL users, not just active
    const profiles = await ctx.runQuery(internal.userProfiles.getActiveUsers, {
      sinceTimestamp: threeDaysAgo,
    });

    let success = 0;
    let failed = 0;

    for (const profile of profiles) {
      try {
        const u = await ctx.runAction(internal.tonal.proxy.fetchUserProfile, {
          userId: profile.userId,
        });
        await ctx.runMutation(internal.userProfiles.updateProfileData, {
          userId: profile.userId,
          profileData: {
            firstName: u.firstName,
            lastName: u.lastName,
            heightInches: u.heightInches,
            weightPounds: u.weightPounds,
            gender: u.gender,
            level: u.tonalStatus ?? "",
            workoutsPerWeek: u.workoutsPerWeek,
            workoutDurationMin: u.workoutDurationMin ?? 0,
            workoutDurationMax: u.workoutDurationMax ?? 0,
            dateOfBirth: u.dateOfBirth || undefined,
            username: u.username || undefined,
            tonalCreatedAt: u.createdAt || undefined,
          },
        });
        success++;
      } catch (err) {
        failed++;
        console.error(`[profileBackfill] Failed for user ${profile.userId}:`, err);
      }
    }

    console.log(
      `[profileBackfill] Complete: ${success} succeeded, ${failed} failed out of ${profiles.length} total`,
    );
    return { success, failed, total: profiles.length };
  },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run all backend tests**

Run: `npx vitest run --project backend`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/tonal/profileBackfill.ts
git commit -m "feat: add one-time Tonal profile backfill action"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Verify no unsafe casts remain**

Run: `grep -r "as unknown as Record" convex/tonal/connect.ts convex/tonal/historySync.ts`
Expected: No matches

- [ ] **Step 4: Verify new fields are in schema**

Run: `grep -n "dateOfBirth\|tonalCreatedAt\|username" convex/schema.ts`
Expected: Three matches in the profileData object

- [ ] **Step 5: Commit any remaining changes**

Only if the formatter modified files during previous commits.
