# House-Key Monthly Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap grandfathered house-key users at 500 AI messages per 30-day fixed window, with an amber banner routing them to BYOK when exhausted.

**Architecture:** Single enforcement point in `resolveUserGeminiKey` (action context) delegates to a new `_checkHouseKeyQuota` internal mutation (mutation context) for the rate limiter. New error code `house_key_quota_exhausted` flows through the existing BYOK error pipeline (`parseByokError` -> `FailureBanner`) with amber styling instead of red.

**Tech Stack:** `@convex-dev/rate-limiter` (fixed window), Vitest, React Testing Library.

---

## File Structure

| Action | Path                                         | Responsibility                                             |
| ------ | -------------------------------------------- | ---------------------------------------------------------- |
| Modify | `convex/rateLimits.ts`                       | Add `houseKeyMonthly` fixed-window entry + named constants |
| Modify | `convex/byok.ts`                             | Add `_checkHouseKeyQuota` internal mutation                |
| Modify | `convex/chat.ts`                             | Enforce cap in `resolveUserGeminiKey`                      |
| Modify | `src/components/byok/FailureBanner.tsx`      | New reason type, amber variant, "Add your key" link text   |
| Modify | `src/components/byok/parseByokError.ts`      | Add code to match array                                    |
| Modify | `convex/byok.test.ts`                        | Test the new internal mutation                             |
| Modify | `src/components/byok/parseByokError.test.ts` | Test the new error code parsing                            |
| Modify | `src/components/byok/FailureBanner.test.tsx` | Test amber styling + link text                             |

---

### Task 1: Rate limit definition

**Files:**

- Modify: `convex/rateLimits.ts:1-88`

- [ ] **Step 1: Add named constants and the rate limit entry**

Open `convex/rateLimits.ts`. After the existing `NEW_SIGNUP_PERIOD` constant (line 14), add:

```ts
/** Monthly cap for grandfathered users running on the shared house key. */
export const HOUSE_KEY_MONTHLY_LIMIT = 500;
const HOUSE_KEY_MONTHLY_PERIOD = 30 * DAY;
```

Then inside the `rateLimiter` config object, after the `newSignup` entry (line 87), add:

```ts
  houseKeyMonthly: {
    kind: "fixed window",
    rate: HOUSE_KEY_MONTHLY_LIMIT,
    period: HOUSE_KEY_MONTHLY_PERIOD,
  },
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean (no errors)

- [ ] **Step 3: Commit**

```bash
git add convex/rateLimits.ts
git commit -s -m "feat: add houseKeyMonthly rate limit entry"
```

---

### Task 2: Quota check internal mutation

**Files:**

- Modify: `convex/byok.ts:1-222`
- Test: `convex/byok.test.ts`

- [ ] **Step 1: Write failing tests for `_checkHouseKeyQuota`**

Open `convex/byok.test.ts`. At the bottom of the file, add a new describe block:

```ts
describe("_checkHouseKeyQuota", () => {
  // _checkHouseKeyQuota is an internalMutation that calls rateLimiter.limit.
  // We can't invoke it directly without a full Convex test harness, but we
  // CAN verify the module exports it so the internal API reference resolves.
  it("is exported as an internalMutation", async () => {
    const { _checkHouseKeyQuota } = await import("./byok");
    expect(_checkHouseKeyQuota).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run convex/byok.test.ts`
Expected: FAIL -- `_checkHouseKeyQuota` is not exported from `./byok`

- [ ] **Step 3: Implement `_checkHouseKeyQuota`**

Open `convex/byok.ts`. Add the import for `internalMutation` (it's already imported from `./_generated/server` -- verify `internalMutation` is in the destructure on line 2; if not, add it). Add the import for `rateLimiter`:

```ts
import { rateLimiter } from "./rateLimits";
```

Then after the existing `_getKeyResolutionContext` internalQuery (around line 163), add:

```ts
export const _checkHouseKeyQuota = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await rateLimiter.limit(ctx, "houseKeyMonthly", { key: userId, throws: true });
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run convex/byok.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 6: Commit**

```bash
git add convex/byok.ts convex/byok.test.ts
git commit -s -m "feat: add _checkHouseKeyQuota internal mutation"
```

---

### Task 3: Enforce cap in `resolveUserGeminiKey`

**Files:**

- Modify: `convex/chat.ts:16-42`

- [ ] **Step 1: Add the `isBYOKRequired` import**

Open `convex/chat.ts`. Line 16 currently imports `resolveGeminiKey` from `./byok`. Extend it:

```ts
import { isBYOKRequired, resolveGeminiKey } from "./byok";
```

- [ ] **Step 2: Modify `resolveUserGeminiKey` to enforce the cap**

Replace the current `resolveUserGeminiKey` function (lines 36-42) with:

```ts
async function resolveUserGeminiKey(ctx: ActionCtx, userId: string): Promise<string> {
  const context = await ctx.runQuery(internal.byok._getKeyResolutionContext, {
    userId: userId as Id<"users">,
  });
  if (!context) throw new Error("byok_user_not_found");
  const key = await resolveGeminiKey(context.profile, context.userCreationTime);

  // Enforce monthly cap on grandfathered house-key users. Skip when the
  // kill switch is active (emergency mode forces everyone onto the house
  // key -- capping them would break the app for all users).
  const isGrandfathered = !isBYOKRequired(context.userCreationTime);
  const killSwitchActive = process.env.BYOK_DISABLED === "true";
  if (isGrandfathered && !killSwitchActive) {
    try {
      await ctx.runMutation(internal.byok._checkHouseKeyQuota, {
        userId: userId as Id<"users">,
      });
    } catch {
      throw new Error("house_key_quota_exhausted");
    }
  }

  return key;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Run all backend tests**

Run: `npx vitest run --project backend`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add convex/chat.ts
git commit -s -m "feat: enforce house-key monthly cap in resolveUserGeminiKey"
```

---

### Task 4: Frontend error parsing

**Files:**

- Modify: `src/components/byok/parseByokError.ts:1-14`
- Test: `src/components/byok/parseByokError.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/components/byok/parseByokError.test.ts`. Before the closing `});` of the describe block, add:

```ts
it("returns house_key_quota_exhausted when the error message contains the code", () => {
  expect(parseByokError(new Error("house_key_quota_exhausted"))).toBe("house_key_quota_exhausted");
});

it("extracts house_key_quota_exhausted even when wrapped by Convex framing", () => {
  const wrapped = new Error(
    "[CONVEX A(chat:sendMessage)] Uncaught Error: house_key_quota_exhausted",
  );
  expect(parseByokError(wrapped)).toBe("house_key_quota_exhausted");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/byok/parseByokError.test.ts`
Expected: FAIL -- `house_key_quota_exhausted` is not in the BYOK_ERROR_CODES array

- [ ] **Step 3: Add the code to the match array**

Open `src/components/byok/parseByokError.ts`. Add `"house_key_quota_exhausted"` to the `BYOK_ERROR_CODES` array:

```ts
const BYOK_ERROR_CODES: readonly FailureReason[] = [
  "byok_key_invalid",
  "byok_quota_exceeded",
  "byok_safety_blocked",
  "byok_unknown_error",
  "byok_key_missing",
  "house_key_quota_exhausted",
] as const;
```

This will fail typecheck until FailureBanner.tsx is updated in Task 5. That's expected.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/byok/parseByokError.test.ts`
Expected: FAIL on typecheck (FailureReason union doesn't include the new code yet). The runtime test would pass but the type error blocks. We'll fix this in the next task and re-run.

- [ ] **Step 5: Commit (tests + parsing change together, type error resolved in next task)**

Hold this commit -- we'll bundle it with Task 5 to keep the tree type-safe at every commit.

---

### Task 5: FailureBanner amber variant

**Files:**

- Modify: `src/components/byok/FailureBanner.tsx:1-38`
- Test: `src/components/byok/FailureBanner.test.tsx`

- [ ] **Step 1: Write the failing tests**

Open `src/components/byok/FailureBanner.test.tsx`. Before the closing `});`, add:

```ts
  it("renders the house-key quota message with non-destructive styling", () => {
    render(<FailureBanner reason="house_key_quota_exhausted" />);

    expect(screen.getByRole("alert")).toHaveTextContent(/500 free AI messages/i);
    // Amber/default variant should NOT have the destructive classes
    expect(screen.getByRole("alert").className).not.toMatch(/destructive/);
  });

  it("shows 'Add your key' link text for house-key quota exhaustion", () => {
    render(<FailureBanner reason="house_key_quota_exhausted" />);

    const link = screen.getByRole("link", { name: /add your key/i });
    expect(link).toHaveAttribute("href", "/settings#gemini-key");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/byok/FailureBanner.test.tsx`
Expected: FAIL -- `house_key_quota_exhausted` is not in the FailureReason type

- [ ] **Step 3: Update the FailureBanner component**

Open `src/components/byok/FailureBanner.tsx`. Replace the entire file contents with:

```tsx
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type FailureReason =
  | "byok_key_invalid"
  | "byok_quota_exceeded"
  | "byok_safety_blocked"
  | "byok_unknown_error"
  | "byok_key_missing"
  | "house_key_quota_exhausted";

interface FailureBannerProps {
  reason: FailureReason;
}

const MESSAGES: Record<FailureReason, string> = {
  byok_key_invalid: "Your Gemini API key isn't working anymore.",
  byok_quota_exceeded: "You've hit Gemini's free daily limit. It resets at midnight UTC.",
  byok_safety_blocked: "Gemini declined to answer this one. Try rephrasing.",
  byok_unknown_error: "Something went wrong with Gemini. Try again in a moment.",
  byok_key_missing: "You need to add your Gemini API key to use chat.",
  house_key_quota_exhausted:
    "You've used your 500 free AI messages this month. Add your own Gemini key to keep going -- it's free from Google.",
};

const isInfoReason = (reason: FailureReason): boolean => reason === "house_key_quota_exhausted";

export function FailureBanner({ reason }: FailureBannerProps) {
  const variant = isInfoReason(reason) ? "default" : "destructive";
  const linkText = isInfoReason(reason) ? "Add your key" : "Fix it";

  return (
    <Alert
      variant={variant}
      className={
        variant === "destructive" ? "border-destructive bg-destructive/10 text-destructive" : ""
      }
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${variant === "destructive" ? "text-destructive" : ""}`}
      >
        <span>{MESSAGES[reason]}</span>
        <a
          href="/settings#gemini-key"
          className={`font-medium underline underline-offset-4 ${variant === "destructive" ? "text-destructive hover:text-destructive/80" : "text-primary hover:text-primary/80"}`}
        >
          {linkText}
        </a>
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 4: Run the FailureBanner tests**

Run: `npx vitest run src/components/byok/FailureBanner.test.tsx`
Expected: All pass (including the two new tests)

- [ ] **Step 5: Run the parseByokError tests (unblocked now)**

Run: `npx vitest run src/components/byok/parseByokError.test.ts`
Expected: All pass

- [ ] **Step 6: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 7: Commit the parsing + banner changes together**

```bash
git add src/components/byok/parseByokError.ts src/components/byok/parseByokError.test.ts src/components/byok/FailureBanner.tsx src/components/byok/FailureBanner.test.tsx
git commit -s -m "feat: amber FailureBanner for house-key quota exhaustion"
```

---

### Task 6: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass, no regressions

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: Clean (--max-warnings=0)

- [ ] **Step 3: Run knip**

Run: `npm run knip`
Expected: Clean (no new dead exports)

- [ ] **Step 4: Run format check**

Run: `npm run format:check`
Expected: Clean

- [ ] **Step 5: Review the full diff**

Run: `git diff main --stat`
Expected: Only these files touched:

- `convex/rateLimits.ts`
- `convex/byok.ts`
- `convex/byok.test.ts`
- `convex/chat.ts`
- `src/components/byok/FailureBanner.tsx`
- `src/components/byok/FailureBanner.test.tsx`
- `src/components/byok/parseByokError.ts`
- `src/components/byok/parseByokError.test.ts`
