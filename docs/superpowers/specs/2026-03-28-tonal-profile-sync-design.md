# Tonal Profile Sync Design

Sync additional Tonal profile fields into the `users` and `userProfiles` tables, with a one-time backfill and recurring refresh.

## Problem

The Tonal API returns rich user profile data (name, date of birth, username, account creation date, workout duration preferences), but we only store a subset in `userProfiles.profileData`. The `users` table has no name fields from Tonal at all -- it only has whatever the user typed at signup. Several fields are accessed via unsafe `as unknown as Record<string, number>` casts because `TonalUser` is incomplete.

## Changes

### 1. TonalUser Type (`convex/tonal/types.ts`)

Add missing fields that the API actually returns:

```typescript
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
  workoutDurationMin: number; // NEW
  workoutDurationMax: number; // NEW
  tonalStatus: string;
  accountType: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Schema (`convex/schema.ts`)

**`users` table** -- add:

- `firstName: v.optional(v.string())`
- `lastName: v.optional(v.string())`

**`userProfiles.profileData`** -- add three optional fields:

- `dateOfBirth: v.optional(v.string())`
- `username: v.optional(v.string())`
- `tonalCreatedAt: v.optional(v.string())`

All additive optional fields. No migration needed for existing rows.

### 3. Connect Flow (`convex/tonal/connect.ts`)

After fetching the Tonal profile, write the new fields:

- Include `dateOfBirth`, `username`, `tonalCreatedAt` (from `profile.createdAt`) in the `profileData` object passed to `userProfiles.create`
- Patch the `users` table with `firstName`, `lastName`, and `name: "${firstName} ${lastName}"`

### 4. Profile Refresh (`convex/userProfiles.ts` + `convex/tonal/historySync.ts`)

**`updateProfileData` mutation** -- expand args to accept the new `profileData` fields plus a `userId` that it uses to also patch `users.firstName`, `users.lastName`, `users.name`.

**`maybeRefreshProfile`** -- include the new fields when calling `updateProfileData`. Remove the `as unknown as Record<string, number>` casts for `workoutDurationMin`/`workoutDurationMax` (now typed properly on `TonalUser`).

**`userProfiles.create`** -- same treatment: accept and store the new fields, patch `users` table.

### 5. One-Time Backfill (`convex/tonal/profileBackfill.ts`)

New internal action:

- Query all `userProfiles` documents
- For each, call `fetchUserProfile` to get fresh Tonal data
- Update `userProfiles.profileData` with all fields (including new ones)
- Patch `users` table with `firstName`, `lastName`, `name`
- Sequential iteration with per-user try/catch so one failure doesn't block others
- Log successes and failures

Triggered manually via `npx convex run`.

### 6. AI Context (`convex/ai/context.ts`)

Add the user's age (computed from `dateOfBirth`) to the profile snapshot line:

```
User: Jeff Otano | 72"/185lbs | Age: 32 | Level: Advanced | 5x/week
```

Age is useful for recovery recommendations, heart rate zone guidance, and volume scaling.

### 7. Recurring Sync

No new cron. The existing `refresh-tonal-cache` cron (every 30 min) calls `cacheRefresh.refreshActiveUsers`, which calls `historySync.syncUserHistory`, which calls `maybeRefreshProfile` with a 24h staleness guard. Since we're extending `maybeRefreshProfile` to include the new fields, active users get their profile data refreshed daily automatically.

## Files Modified

| File                              | Change                                                                  |
| --------------------------------- | ----------------------------------------------------------------------- |
| `convex/tonal/types.ts`           | Add `workoutDurationMin`, `workoutDurationMax` to `TonalUser`           |
| `convex/schema.ts`                | Add fields to `users` and `userProfiles.profileData`                    |
| `convex/tonal/connect.ts`         | Write new fields on connect, patch `users` table                        |
| `convex/userProfiles.ts`          | Extend `create` and `updateProfileData` with new fields + `users` patch |
| `convex/tonal/historySync.ts`     | Update `maybeRefreshProfile` with new fields, remove unsafe casts       |
| `convex/ai/context.ts`            | Add age to profile snapshot                                             |
| `convex/tonal/profileBackfill.ts` | New file: one-time backfill action                                      |

## Verification

- `npx tsc --noEmit` passes
- Existing tests pass
- Backfill action runs successfully against prod (manual trigger)
- New user connecting Tonal gets all fields populated in both tables
- AI context snapshot includes age
- No `as unknown` casts remain for `workoutDurationMin`/`workoutDurationMax`
