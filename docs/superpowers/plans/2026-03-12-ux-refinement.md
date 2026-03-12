# UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unified responsive navigation, rich chat rendering with one-coach conversation model, and dashboard-to-chat CTAs across the entire app.

**Architecture:** Three workstreams converge on a shared `AppShell` layout. Backend gets thread auto-resolution and cross-thread history loading. Frontend gets full markdown rendering, new message layout, and upgraded tool/workout indicators. Dashboard cards become actionable with chat-linked CTAs.

**Tech Stack:** Next.js 16 App Router, Convex (`@convex-dev/agent`), TypeScript, Tailwind CSS v4, shadcn/ui (base-nova / `@base-ui/react`), `react-markdown` + `remark-gfm`, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-12-ux-refinement.md`

---

## File Structure

### Created
| File | Responsibility |
|------|---------------|
| `src/app/(app)/layout.tsx` | Authenticated route group layout — renders AppShell, auth guards |
| `src/components/AppShell.tsx` | Responsive nav shell: sidebar (desktop lg+), bottom tabs (mobile) |
| `src/components/MarkdownContent.tsx` | `react-markdown` wrapper with dark-theme styled components |
| `src/components/DateDivider.tsx` | "Today", "Yesterday", "March 8" date separator |
| `convex/threads.ts` | `getActiveThread` (internalQuery), `getCurrentThread` (public query), `listConversationHistory` (public query) |

### Modified
| File | Changes |
|------|---------|
| `convex/chat.ts` | `sendMessage` auto-resolves active thread via `getActiveThread` |
| `convex/dashboard.ts` | `getTrainingFrequency` adds `lastTrainedDate` per area |
| `src/components/ChatMessage.tsx` | Full rewrite: full-width, avatars, timestamps, markdown for coach |
| `src/components/ToolCallIndicator.tsx` | Rewrite: compact chips (animated running, checkmark done) |
| `src/components/WorkoutCard.tsx` | Status badges for all 4 statuses, teal accent border |
| `src/components/ChatThread.tsx` | Auto-session model, two data sources, date dividers |
| `src/components/ChatInput.tsx` | Simplified: no threadId prop, always active |
| `src/components/StatusBanner.tsx` | No changes to component itself, just moves into AppShell |
| `src/app/(app)/chat/page.tsx` | Welcome state, auto-send from `?prompt=` param, no thread routing |
| `src/app/(app)/dashboard/page.tsx` | Greeting header, CTAs on cards |
| `src/app/(app)/settings/page.tsx` | Remove back arrow + standalone wrapper |
| `src/components/MuscleReadinessMap.tsx` | Add CTA link when readiness >80% |
| `src/components/TrainingFrequencyChart.tsx` | Add CTA link when area not trained >7 days |
| `src/components/StrengthScoreCard.tsx` | Add static "Ask coach" CTA |

### Deleted
| File | Reason |
|------|--------|
| `src/app/chat/layout.tsx` | Replaced by `(app)/layout.tsx` |
| `src/app/chat/[threadId]/page.tsx` | Thread managed as state, not route |
| `src/app/dashboard/layout.tsx` | Replaced by `(app)/layout.tsx` |
| `src/components/ThreadSidebar.tsx` | One-coach model, no thread list |

---

## Chunk 1: Foundation + Backend

### Task 1: Install dependencies and scaffold route group

**Files:**
- Modify: `package.json` (add deps)
- Create: `src/app/(app)/layout.tsx` (placeholder)

- [ ] **Step 1: Install react-markdown and remark-gfm**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 2: Create the (app) route group with a pass-through layout**

Create `src/app/(app)/layout.tsx` — a minimal placeholder that just renders children. This establishes the route group before we build AppShell.

```tsx
// src/app/(app)/layout.tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/\(app\)/layout.tsx
git commit -m "chore: install react-markdown, scaffold (app) route group"
```

---

### Task 2: AppShell component

**Files:**
- Create: `src/components/AppShell.tsx`

**Reference:** The existing `src/app/dashboard/layout.tsx` has a working responsive nav pattern with desktop header + mobile bottom tabs at `sm` breakpoint. The new AppShell uses a **sidebar** (not header) on desktop and changes the breakpoint to `lg` (1024px).

**Context files to read first:**
- `src/app/dashboard/layout.tsx` — existing nav pattern, auth guards, StatusBanner integration
- `src/components/StatusBanner.tsx` — renders above main content
- `src/lib/utils.ts` — `cn()` helper
- `src/components/ui/button.tsx` — shadcn Button with `render` prop (base-nova style)

- [ ] **Step 1: Create AppShell component**

Create `src/components/AppShell.tsx` with:

**Layout structure:**
```
Desktop (lg+):         Mobile (<lg):
┌──────┬─────────┐    ┌─────────────────┐
│ Side │ Status  │    │ Mobile header   │
│ bar  │ Banner  │    ├─────────────────┤
│      ├─────────┤    │ StatusBanner    │
│      │ Main    │    ├─────────────────┤
│      │ content │    │ Main content    │
│      │         │    │                 │
│      │         │    ├─────────────────┤
└──────┴─────────┘    │ Bottom tabs     │
                      └─────────────────┘
```

**Props:** `{ children: React.ReactNode }`

**Desktop sidebar (256px, hidden below lg):**
- Logo: "tonal.coach" text, `text-sm font-bold`
- Nav links: Chat (`MessageSquare`), Dashboard (`LayoutDashboard`), Settings (`Settings`)
- Each link: `Link` from next/link, styled with `cn()`, active state uses `bg-primary/10 text-primary`
- Divider below nav
- User name at bottom from `useQuery(api.users.getMe)` — display `tonalName`

**Mobile bottom tabs (visible below lg):**
- Fixed to bottom, `z-40`
- 3 tabs with icon + label, active tab in `text-primary`
- Bottom padding: `pb-[env(safe-area-inset-bottom)]` for notch devices

**Mobile header (visible below lg):**
- "tonal.coach" text centered

**Auth guards:** Import and reuse the pattern from `dashboard/layout.tsx`:
- `useConvexAuth()` for `isAuthenticated`, `isLoading`
- `useQuery(api.users.getMe)` with skip when not authenticated
- Loading: full-screen `Loader2` spinner
- Not authenticated: `router.replace("/login")`
- No Tonal profile: `router.replace("/connect-tonal")`

**Important implementation details:**
- Use `usePathname()` to determine active nav link
- Match on `pathname.startsWith(href)` for nested routes (e.g., `/chat` matches `/chat`)
- Import `StatusBanner` and render it above main content area
- Main content: `flex-1 overflow-auto` with `pb-16 lg:pb-0` to account for mobile tab bar

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2, MessageSquare, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBanner } from "@/components/StatusBanner";

const navLinks = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  if (authLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  if (me && !me.hasTonalProfile) {
    router.replace("/connect-tonal");
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border lg:flex">
        <div className="p-4">
          <span className="text-sm font-bold text-foreground">tonal.coach</span>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith(href) && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mx-4 my-2 border-t border-border" />
        <div className="mt-auto p-4">
          {me?.tonalName && (
            <p className="truncate text-xs text-muted-foreground">{me.tonalName}</p>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center border-b border-border px-4 py-3 lg:hidden">
          <span className="text-sm font-bold text-foreground">tonal.coach</span>
        </header>

        <StatusBanner />

        {/* Content */}
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background py-2 lg:hidden"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground transition-colors",
                pathname.startsWith(href) && "text-primary",
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat: add AppShell component with responsive sidebar/tabs navigation"
```

---

### Task 3: Route restructuring — move pages into (app) group

**Files:**
- Modify: `src/app/(app)/layout.tsx` — wire up AppShell
- Move: `src/app/chat/page.tsx` → `src/app/(app)/chat/page.tsx`
- Move: `src/app/dashboard/page.tsx` → `src/app/(app)/dashboard/page.tsx`
- Move: `src/app/settings/page.tsx` → `src/app/(app)/settings/page.tsx`
- Delete: `src/app/chat/layout.tsx`
- Delete: `src/app/chat/[threadId]/page.tsx`
- Delete: `src/app/dashboard/layout.tsx`
- Delete: `src/components/ThreadSidebar.tsx`

**Context files to read first:**
- `src/app/chat/layout.tsx` — has auth guards (moving to AppShell), sidebar toggle, hamburger menu
- `src/app/chat/page.tsx` — suggestion buttons, thread creation, navigation to `/chat/[threadId]`
- `src/app/chat/[threadId]/page.tsx` — simple wrapper around ChatThread
- `src/app/dashboard/layout.tsx` — has auth guards (moving to AppShell), responsive nav
- `src/app/settings/page.tsx` — has its own auth guards, back arrow

**Critical:** After this task, the chat page will temporarily be broken — specifically, the `handleSuggestion` callback calls `router.push(/chat/${result.threadId})` which navigates to a route that no longer exists. This is expected and fixed in Tasks 12-13. The goal here is just the file moves and layout wiring. Don't spend time debugging chat navigation in this task.

- [ ] **Step 1: Update (app)/layout.tsx to use AppShell**

```tsx
// src/app/(app)/layout.tsx
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 2: Move chat page**

```bash
mkdir -p src/app/\(app\)/chat
cp src/app/chat/page.tsx src/app/\(app\)/chat/page.tsx
```

Then edit `src/app/(app)/chat/page.tsx`:
- Remove any auth guard logic (AppShell handles it)
- Keep the existing functionality for now (will be rewritten in Task 13)

- [ ] **Step 3: Move dashboard page**

```bash
mkdir -p src/app/\(app\)/dashboard
cp src/app/dashboard/page.tsx src/app/\(app\)/dashboard/page.tsx
```

Edit `src/app/(app)/dashboard/page.tsx`:
- Remove any standalone auth guards if present (the dashboard page itself doesn't have them — its layout did)
- Keep existing card rendering

- [ ] **Step 4: Move settings page**

```bash
mkdir -p src/app/\(app\)/settings
cp src/app/settings/page.tsx src/app/\(app\)/settings/page.tsx
```

Edit `src/app/(app)/settings/page.tsx`:
- Remove auth guard logic (lines checking `isAuthenticated`, `authLoading`, redirects)
- Remove the back arrow button and `min-h-screen` wrapper
- Remove `PageLoader` and `useConvexAuth` imports
- Keep `useQuery(api.users.getMe)` for displaying user data, but skip the auth redirect logic
- Keep the `me === null` error rendering (currently shows `ErrorAlert` for authenticated users with no profile) — AppShell doesn't handle this edge case, so settings should still handle it locally
- The component should render just the settings content (account section, Tonal connection, about) without its own full-page wrapper

- [ ] **Step 5: Delete old files**

```bash
rm src/app/chat/layout.tsx
rm -rf src/app/chat/\[threadId\]
rm src/app/dashboard/layout.tsx
rm src/components/ThreadSidebar.tsx
```

Also delete the old route directories if they're now empty (after moving pages):
```bash
# Remove old chat page (now in (app)/chat/)
rm src/app/chat/page.tsx
# Remove old dashboard page (now in (app)/dashboard/)
rm src/app/dashboard/page.tsx
# Remove old settings page (now in (app)/settings/)
rm src/app/settings/page.tsx
```

Clean up empty directories:
```bash
rmdir src/app/chat 2>/dev/null || true
rmdir src/app/dashboard 2>/dev/null || true
rmdir src/app/settings 2>/dev/null || true
```

- [ ] **Step 6: Fix imports**

Check for any import path changes needed due to file moves. The `@/` alias resolves to `src/`, so component imports should work. But relative imports to `convex/_generated/api` may need updating since the files moved deeper:
- Old: `../../../convex/_generated/api` (from `src/app/chat/page.tsx`)
- New: `../../../../convex/_generated/api` (from `src/app/(app)/chat/page.tsx`)

The `@/` alias maps to `./src/*` and does NOT cover `convex/`. Update relative imports in all moved files:
- Old (from `src/app/chat/page.tsx`): `from "../../../convex/_generated/api"`
- New (from `src/app/(app)/chat/page.tsx`): `from "../../../../convex/_generated/api"`

Same change for dashboard and settings pages.

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
```

Fix any import errors. The app should compile but the chat flow will be partially broken (thread navigation removed, to be fixed in Tasks 12-13).

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(app\)/chat/page.tsx src/app/\(app\)/dashboard/page.tsx src/app/\(app\)/settings/page.tsx
git rm src/app/chat/layout.tsx src/app/chat/page.tsx src/app/chat/\[threadId\]/page.tsx src/app/dashboard/layout.tsx src/app/dashboard/page.tsx src/app/settings/page.tsx src/components/ThreadSidebar.tsx
git commit -m "refactor: move authenticated pages into (app) route group with AppShell"
```

---

### Task 4: Backend — convex/threads.ts

**Files:**
- Create: `convex/threads.ts`

**Context files to read first:**
- `convex/chat.ts` — current thread/message handling, see how `listUIMessages` and `syncStreams` are used
- `convex/ai/coach.ts` — agent component setup (`components.agent`)
- `convex/_generated/api.d.ts` — check available component queries (search for `listThreadsByUserId`, `listMessagesByThreadId` or similar)

**Important:** The `@convex-dev/agent` component exposes internal queries for thread and message listing. You need to find the exact function references by examining the generated API types. Look for `components.agent` in the generated types.

- [ ] **Step 1: Create convex/threads.ts with getActiveThread**

```typescript
import { internalQuery, query } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Internal query: find the user's most recent active thread
 * and its last message timestamp.
 * Called by sendMessage action via ctx.runQuery.
 */
export const getActiveThread = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Use agent component to list threads for this user, most recent first
    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId: userId as string,
        paginationOpts: { cursor: null, numItems: 1 },
        order: "desc",
      },
    );

    const thread = threads.page[0];
    if (!thread || thread.status !== "active") return null;

    // Get the last message to check staleness
    const messages = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: thread._id,
        paginationOpts: { cursor: null, numItems: 1 },
        order: "desc",
      },
    );

    const lastMessageTime =
      messages.page[0]?._creationTime ?? thread._creationTime;

    return { threadId: thread._id, lastMessageTime };
  },
});
```

**Note:** The generated types show thread queries under `components.agent.threads` and message queries under `components.agent.messages`. If these paths don't type-check, inspect `convex/_generated/api.d.ts` for the correct namespace.

- [ ] **Step 2: Add getCurrentThread public query**

Add to the same file:

```typescript
/**
 * Public query: client subscribes to this to get the active thread ID.
 * Returns null if no active thread exists.
 */
export const getCurrentThread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return ctx.runQuery(internal.threads.getActiveThread, { userId });
  },
});
```

- [ ] **Step 3: Add listConversationHistory public query**

This loads historical messages across previous threads for the "Load earlier" feature.

```typescript
/**
 * Public query: loads messages from threads older than the current one.
 * Used for "Load earlier" in the continuous scroll.
 * Returns messages from previous threads with thread boundary markers.
 */
export const listConversationHistory = query({
  args: {
    beforeThreadId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { beforeThreadId, limit = 20 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { messages: [], hasMore: false };

    // Get threads for this user, newest first (up to 50 — sufficient for most users)
    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId: userId as string,
        paginationOpts: { cursor: null, numItems: 50 },
        order: "desc",
      },
    );

    // Find threads older than the current one
    let foundCurrent = !beforeThreadId;
    const olderThreads = [];
    for (const thread of threads.page) {
      if (thread._id === beforeThreadId) {
        foundCurrent = true;
        continue;
      }
      if (foundCurrent && thread.status === "active") {
        olderThreads.push(thread);
      }
    }

    if (olderThreads.length === 0) return { messages: [], hasMore: false };

    // Load messages from the next older thread
    const targetThread = olderThreads[0];
    const result = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: targetThread._id,
        paginationOpts: { cursor: null, numItems: limit },
        order: "asc",
      },
    );

    return {
      messages: result.page,
      threadId: targetThread._id,
      hasMore: olderThreads.length > 1 || !result.isDone,
    };
  },
});
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

If the component query paths are wrong, check `convex/_generated/api.d.ts` and adjust. The key is finding the right reference path for `listThreadsByUserId` and the message listing query.

- [ ] **Step 5: Commit**

```bash
git add convex/threads.ts
git commit -m "feat: add thread queries for auto-session model"
```

---

### Task 5: Backend — modify convex/chat.ts for auto-resolve

**Files:**
- Modify: `convex/chat.ts`

**Context files to read first:**
- `convex/chat.ts` — current sendMessage implementation
- `convex/threads.ts` — the getActiveThread query just created
- `convex/ai/coach.ts` — how agent threads are created and continued

- [ ] **Step 1: Modify sendMessage to auto-resolve thread**

The current code (lines 48-57 of `convex/chat.ts`) has:

```typescript
    let targetThreadId: string;
    if (threadId) {
      targetThreadId = threadId;
    } else {
      const { threadId: newThreadId } = await coachAgent.createThread(ctx, {
        userId,
      });
      targetThreadId = newThreadId;
    }
```

Replace that block with the auto-resolve logic:

```typescript
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

    let targetThreadId: string;
    if (threadId) {
      targetThreadId = threadId;
    } else {
      // Auto-resolve to active thread if not stale
      const active = await ctx.runQuery(internal.threads.getActiveThread, {
        userId,
      });

      if (active && Date.now() - active.lastMessageTime < STALE_THRESHOLD_MS) {
        targetThreadId = active.threadId;
      } else {
        // Create new thread (stale or none exists)
        const { threadId: newThreadId } = await coachAgent.createThread(ctx, {
          userId,
        });
        targetThreadId = newThreadId;
      }
    }
```

The file already imports `internal` from `./_generated/api` (line 8), so no new import is needed. The `internal.threads.getActiveThread` reference will resolve after creating `convex/threads.ts` in Task 4.

**Note:** The existing `createThread` mutation export (lines 20-31) is no longer needed by the frontend since `sendMessage` now auto-resolves threads. Leave it in place for now (it's harmless) — removing it is out of scope for this task.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat: auto-resolve active thread in sendMessage with 24h staleness check"
```

---

### Task 6: Backend — modify convex/dashboard.ts for lastTrainedDate

**Files:**
- Modify: `convex/dashboard.ts`

**Context files to read first:**
- `convex/dashboard.ts` — current `getTrainingFrequency` implementation

- [ ] **Step 1: Add lastTrainedDate to getTrainingFrequency response**

Currently returns `{ targetArea: string; count: number }[]`.

Change to return `{ targetArea: string; count: number; lastTrainedDate: string }[]`.

**Note:** `getTrainingFrequency` is an `action` that calls `fetchWorkoutHistory` internally. The code below modifies the section **after** the `activities` array is returned from the proxy call — replace the existing count-accumulation loop and return statement, don't restructure the function:

```typescript
const counts: Record<string, number> = {};
const lastDates: Record<string, string> = {};

for (const activity of activities) {
  const activityTime = new Date(activity.activityTime).getTime();
  if (activityTime < thirtyDaysAgo) continue;

  const area = activity.workoutPreview?.targetArea ?? "Unknown";
  counts[area] = (counts[area] ?? 0) + 1;

  // Track most recent date per area
  if (!lastDates[area] || activity.activityTime > lastDates[area]) {
    lastDates[area] = activity.activityTime;
  }
}

return Object.entries(counts)
  .map(([targetArea, count]) => ({
    targetArea,
    count,
    lastTrainedDate: lastDates[targetArea],
  }))
  .sort((a, b) => b.count - a.count);
```

Also update the `TrainingFrequencyEntry` interface:
```typescript
interface TrainingFrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate: string;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add convex/dashboard.ts
git commit -m "feat: add lastTrainedDate to training frequency response"
```

---

## Chunk 2: Frontend Components + Integration

### Task 7: MarkdownContent component

**Files:**
- Create: `src/components/MarkdownContent.tsx`

**Context:** This wraps `react-markdown` with dark-theme styled component overrides for the coach's messages.

- [ ] **Step 1: Create MarkdownContent component**

```tsx
// src/components/MarkdownContent.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em>{children}</em>,
  code: ({ className, children, ...props }) => {
    // Detect code blocks vs inline code
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={`${className ?? ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-2">{children}</td>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 mt-4 text-xl font-semibold text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-lg font-semibold text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold text-foreground">{children}</h4>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/30 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
};

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="text-sm leading-relaxed text-foreground/85">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MarkdownContent.tsx
git commit -m "feat: add MarkdownContent component with dark-theme styled react-markdown"
```

---

### Task 8: ChatMessage rewrite

**Files:**
- Modify: `src/components/ChatMessage.tsx` (full rewrite)

**Context files to read first:**
- `src/components/ChatMessage.tsx` — current implementation (bubble-style, FormattedText)
- `src/components/MarkdownContent.tsx` — just created
- `src/components/ToolCallIndicator.tsx` — renders inside messages (will be rewritten in Task 9, but keep current interface for now)

**Design:** Full-width messages, no bubbles. Each message has:
- Header: avatar (24px circle) + role name + timestamp
- Content: indented 32px, full width
- Separated by subtle border divider

- [ ] **Step 1: Rewrite ChatMessage**

Replace the entire file content. Key changes:
- Remove `FormattedText` and `TextWithBreaks` helpers
- Remove bubble styling (user right-aligned, assistant left-aligned)
- Add avatar: user gets first initial in primary circle, coach gets sparkle icon in muted circle
- Add role name: "You" / "Coach"
- Coach messages use `MarkdownContent`, user messages use plain text
- Keep streaming cursor: append `▍` to raw markdown string for coach, or after text for user
- Keep tool call rendering via `ToolCallIndicator`

```tsx
"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ToolCallIndicator } from "@/components/ToolCallIndicator";
import { Sparkles } from "lucide-react";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ChatMessageProps {
  message: UIMessage;
  userInitial?: string;
}

export function ChatMessage({ message, userInitial = "U" }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0 sm:px-6">
      {/* Header: avatar + role + timestamp */}
      <div className="mb-1.5 flex items-center gap-2">
        {isUser ? (
          <div className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {userInitial}
          </div>
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-3 text-muted-foreground" />
          </div>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {isUser ? "You" : "Coach"}
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          {formatTime(message._creationTime)}
        </span>
      </div>

      {/* Content — indented to align with role name */}
      <div className="pl-8">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            const text = part.text;
            if (!text && !isStreaming) return null;

            if (isUser) {
              return (
                <p key={i} className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {text}
                </p>
              );
            }

            // Coach: render with markdown
            const displayText = isStreaming ? text + "▍" : text;
            return <MarkdownContent key={i} content={displayText} />;
          }

          return null;
        })}

        {/* Tool calls: completed ones wrap horizontally as chips per spec */}
        {(() => {
          const toolParts = message.parts.filter(
            (part) => part.type === "dynamic-tool",
          );
          if (toolParts.length === 0) return null;

          const hasRunning = toolParts.some(
            (part) => part.state === "input-streaming" || part.state === "input-available",
          );

          // If any are running, render vertically (running indicator + pending chips)
          // If all done, wrap horizontally
          return (
            <div className={hasRunning ? "space-y-1" : "flex flex-wrap gap-1.5 mt-1"}>
              {toolParts.map((part) => (
                <ToolCallIndicator
                  key={part.toolCallId}
                  toolName={part.toolName}
                  state={part.state}
                  input={part.input}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

**Note:** The `UIMessage` type and `part.type`/`part.toolName`/`part.state`/`part.input` property access must match what `@convex-dev/agent/react` exports. Check the existing ChatMessage for the exact property names and adjust if the types differ.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatMessage.tsx
git commit -m "feat: rewrite ChatMessage with full-width layout, avatars, and markdown rendering"
```

---

### Task 9: ToolCallIndicator rewrite

**Files:**
- Modify: `src/components/ToolCallIndicator.tsx` (full rewrite)

**Context files to read first:**
- `src/components/ToolCallIndicator.tsx` — current implementation
- `src/components/WorkoutCard.tsx` — special rendering for create_workout

**Design:**
- Running state: animated teal pulse dot + descriptive text (e.g., "Checking muscle readiness...")
- Completed state: compact chip with teal checkmark + past-tense text
- Multiple completed chips render as horizontal flex-wrap row
- Special case: `create_workout` still renders WorkoutCard on completion

- [ ] **Step 1: Rewrite ToolCallIndicator**

```tsx
"use client";

import { WorkoutCard } from "./WorkoutCard";

// Friendly messages: present tense (running) and past tense (done)
const TOOL_MESSAGES: Record<string, { running: string; done: string }> = {
  search_exercises: { running: "Searching exercises...", done: "Searched exercises" },
  get_strength_scores: { running: "Checking strength scores...", done: "Checked strength scores" },
  get_strength_history: { running: "Reviewing strength history...", done: "Reviewed strength history" },
  get_muscle_readiness: { running: "Checking muscle readiness...", done: "Checked muscle readiness" },
  get_workout_history: { running: "Reviewing workout history...", done: "Reviewed workout history" },
  get_workout_detail: { running: "Loading workout details...", done: "Loaded workout details" },
  get_training_frequency: { running: "Analyzing training frequency...", done: "Analyzed training frequency" },
  create_workout: { running: "Creating workout...", done: "Created workout" },
  delete_workout: { running: "Deleting workout...", done: "Deleted workout" },
  estimate_duration: { running: "Estimating duration...", done: "Estimated duration" },
};

interface ToolCallIndicatorProps {
  toolName: string;
  state: string;
  input?: unknown;
}

export function ToolCallIndicator({ toolName, state, input }: ToolCallIndicatorProps) {
  const messages = TOOL_MESSAGES[toolName] ?? {
    running: `Running ${toolName}...`,
    done: `Ran ${toolName}`,
  };

  const isRunning = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";

  // Special case: create_workout shows WorkoutCard when done
  if (toolName === "create_workout" && isDone && input) {
    const data = input as { name?: string; exercises?: Array<{ exerciseName?: string; name?: string; sets?: number; reps?: number }> };
    return <WorkoutCard title={data.name} exercises={data.exercises} />;
  }

  if (isRunning) {
    return (
      <div className="my-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {messages.running}
      </div>
    );
  }

  if (isDone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
        <span className="text-primary">✓</span>
        {messages.done}
      </span>
    );
  }

  return null;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ToolCallIndicator.tsx
git commit -m "feat: rewrite ToolCallIndicator with compact chip style"
```

---

### Task 10: WorkoutCard upgrade

**Files:**
- Modify: `src/components/WorkoutCard.tsx`

**Context files to read first:**
- `src/components/WorkoutCard.tsx` — current implementation
- `convex/schema.ts` — `workoutPlans` table statuses: draft, pushed, completed, deleted

**Design:** Add status badges based on `workoutPlans` status, teal accent border.

- [ ] **Step 1: Upgrade WorkoutCard**

Add a `status` prop (optional, defaults to "pushed" for backwards compatibility). Add teal border. Add status badges.

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Trash2 } from "lucide-react";

interface WorkoutExercise {
  exerciseName?: string;
  name?: string;
  sets?: number;
  reps?: number;
}

interface WorkoutCardProps {
  title?: string;
  exercises?: WorkoutExercise[];
  status?: "draft" | "pushed" | "completed" | "deleted";
  estimatedDuration?: number;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="outline" className="text-xs">
          <Clock className="mr-1 size-3" />
          Preview
        </Badge>
      );
    case "pushed":
      return (
        <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Pushed to Tonal
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
          <CheckCircle2 className="mr-1 size-3" />
          Completed
        </Badge>
      );
    case "deleted":
      return (
        <Badge variant="secondary" className="text-xs text-muted-foreground">
          <Trash2 className="mr-1 size-3" />
          Removed
        </Badge>
      );
    default:
      return null;
  }
}

export function WorkoutCard({
  title,
  exercises,
  status = "pushed",
  estimatedDuration,
}: WorkoutCardProps) {
  return (
    <div className="my-2 rounded-lg border border-primary/30 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {title ?? "Custom Workout"}
        </h3>
        <StatusBadge status={status} />
      </div>

      {exercises && exercises.length > 0 && (
        <ol className="mb-2 space-y-1 pl-5 text-sm">
          {exercises.map((ex, i) => (
            <li key={i} className="text-foreground/80">
              <span className="font-medium">
                {ex.exerciseName ?? ex.name ?? "Exercise"}
              </span>
              {ex.sets && ex.reps && (
                <span className="ml-1.5 text-muted-foreground">
                  — {ex.sets}×{ex.reps}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {estimatedDuration && (
        <p className="text-xs text-muted-foreground">
          ~{Math.round(estimatedDuration / 60)} min
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkoutCard.tsx
git commit -m "feat: upgrade WorkoutCard with status badges and teal accent"
```

---

### Task 11: DateDivider component

**Files:**
- Create: `src/components/DateDivider.tsx`

- [ ] **Step 1: Create DateDivider**

```tsx
// src/components/DateDivider.tsx

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

interface DateDividerProps {
  timestamp: number;
}

export function DateDivider({ timestamp }: DateDividerProps) {
  const label = formatDateLabel(new Date(timestamp));

  return (
    <div className="flex items-center gap-3 px-4 py-2 sm:px-6">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground/60">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DateDivider.tsx
git commit -m "feat: add DateDivider component for chat history"
```

---

### Task 12: ChatThread rewrite

**Files:**
- Modify: `src/components/ChatThread.tsx` (full rewrite)
- Modify: `src/components/ChatInput.tsx` (simplify props)

**Context files to read first:**
- `src/components/ChatThread.tsx` — current implementation (useUIMessages, pagination, auto-scroll)
- `src/components/ChatInput.tsx` — current props: `{ threadId, onThreadCreated?, disabled? }`
- `convex/threads.ts` — getCurrentThread, listConversationHistory
- `convex/chat.ts` — sendMessage (now auto-resolves thread)

**Design changes:**
- ChatThread no longer receives `threadId` as a prop — it subscribes to `getCurrentThread` query
- Uses `useUIMessages` for current thread (streaming) and `listConversationHistory` for older threads
- Date dividers inserted between messages from different days
- ChatInput simplified: no threadId, no onThreadCreated

- [ ] **Step 1: Simplify ChatInput**

Modify `src/components/ChatInput.tsx`:

Remove `threadId` and `onThreadCreated` props. The input just calls `sendMessage` with the prompt. No thread management.

```tsx
interface ChatInputProps {
  disabled?: boolean;
}

export function ChatInput({ disabled }: ChatInputProps) {
  // ... keep existing textarea, auto-grow, enter/shift+enter logic ...
  // Change the send handler:
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await sendMessage({ prompt: text });
    } catch {
      setInput(text); // Restore on error
    } finally {
      setSending(false);
    }
  };
  // Remove threadId from sendMessage call
  // Remove onThreadCreated callback
}
```

- [ ] **Step 2: Rewrite ChatThread**

Replace `src/components/ChatThread.tsx` entirely.

**Critical API note:** The existing code calls `useUIMessages` with three arguments:
```tsx
useUIMessages(api.chat.listMessages, { threadId }, { initialNumItems: 20, stream: true })
```
It returns `{ results, status, loadMore }` (NOT `{ messages, ... }`). The implementer MUST read the current `ChatThread.tsx` to confirm the exact call signature and return shape, then adapt the code below accordingly.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { DateDivider } from "./DateDivider";
import type { UIMessage } from "@convex-dev/agent/react";

function shouldShowDateDivider(
  currentTimestamp: number,
  prevTimestamp: number | null,
): boolean {
  if (!prevTimestamp) return true;
  const current = new Date(currentTimestamp);
  const prev = new Date(prevTimestamp);
  return (
    current.getDate() !== prev.getDate() ||
    current.getMonth() !== prev.getMonth() ||
    current.getFullYear() !== prev.getFullYear()
  );
}

interface ChatThreadProps {
  userInitial?: string;
}

export function ChatThread({ userInitial }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to active thread
  const activeThread = useQuery(api.threads.getCurrentThread);
  const threadId = activeThread?.threadId ?? undefined;

  // Current thread messages (streaming) — use same call signature as existing code
  // Existing pattern: useUIMessages(api.chat.listMessages, { threadId }, { initialNumItems, stream })
  // NOTE: useUIMessages may not support "skip" like useQuery does. If it doesn't,
  // conditionally render the component instead: only mount ChatThread when threadId exists.
  // Check the @convex-dev/agent/react source to confirm. If "skip" isn't supported,
  // use: `const uiMessages = threadId ? useUIMessages(...) : { results: [], status: "Exhausted", loadMore: () => {} };`
  // or gate the hook call behind a conditional component.
  const { results: currentMessages, status, loadMore } = useUIMessages(
    api.chat.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 20, stream: true },
  );

  // Historical messages from older threads (static, "Load earlier")
  // NOTE: listConversationHistory returns raw MessageDoc objects from the agent
  // component, NOT UIMessage objects. They must be mapped to a compatible shape.
  // MessageDoc has: _id, _creationTime, role, message (string content), threadId
  // UIMessage has: key, _creationTime, role, parts (array), status
  const [historicalMessages, setHistoricalMessages] = useState<UIMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const history = useQuery(
    api.threads.listConversationHistory,
    threadId ? { beforeThreadId: threadId } : "skip",
  );

  const handleLoadEarlier = () => {
    if (history && history.messages.length > 0) {
      setLoadingHistory(true);
      // Convert MessageDoc to UIMessage-compatible shape
      const converted: UIMessage[] = history.messages.map((msg: any) => ({
        key: msg._id,
        _creationTime: msg._creationTime,
        role: msg.role as "user" | "assistant",
        status: "complete" as const,
        parts: [{ type: "text" as const, text: msg.message ?? "" }],
      }));
      setHistoricalMessages((prev) => [...converted, ...prev]);
      setLoadingHistory(false);
    }
  };

  // Merge: historical (older threads) + current (active thread with streaming)
  const allMessages = [...historicalMessages, ...(currentMessages ?? [])];

  // Auto-scroll to bottom on new messages
  const isStreaming = (currentMessages ?? []).some(
    (m) => m.status === "streaming",
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [allMessages.length, isStreaming]);

  // Can load more from current thread pagination OR from older threads
  const canLoadMoreCurrent = status === "CanLoadMore";
  const canLoadMoreHistory =
    history !== undefined && history.hasMore && historicalMessages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Load earlier: first exhaust current thread pagination, then cross-thread history */}
        {canLoadMoreCurrent && (
          <div className="flex justify-center py-3">
            <button
              onClick={() => loadMore(20)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Load earlier messages
            </button>
          </div>
        )}
        {!canLoadMoreCurrent && canLoadMoreHistory && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleLoadEarlier}
              disabled={loadingHistory}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Load earlier conversations
            </button>
          </div>
        )}

        {/* Messages with date dividers */}
        {allMessages.map((message, i) => {
          const prevTimestamp =
            i > 0 ? allMessages[i - 1]._creationTime : null;
          const showDivider = shouldShowDateDivider(
            message._creationTime,
            prevTimestamp,
          );

          return (
            <div key={message.key}>
              {showDivider && (
                <DateDivider timestamp={message._creationTime} />
              )}
              <ChatMessage message={message} userInitial={userInitial} />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3 sm:p-4">
        <ChatInput disabled={isStreaming} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expect possible type errors around `useUIMessages` — the exact call signature and return shape may differ from what's shown above. Check the **current** `ChatThread.tsx` implementation and the `@convex-dev/agent/react` types. The key changes from the current code are: (1) `threadId` comes from `getCurrentThread` query instead of props, (2) historical messages from `listConversationHistory` are prepended, (3) date dividers are inserted.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatThread.tsx src/components/ChatInput.tsx
git commit -m "feat: rewrite ChatThread with auto-session model and date dividers"
```

---

### Task 13: Chat page rewrite

**Files:**
- Modify: `src/app/(app)/chat/page.tsx` (full rewrite)

**Context files to read first:**
- `src/app/(app)/chat/page.tsx` — current: suggestion buttons, thread creation, navigation
- `src/components/ChatThread.tsx` — just rewritten, handles message loading

**Design:**
- Single route `/chat`, no `[threadId]` subroute
- If no messages: show welcome state (avatar, greeting, 4 suggestion cards)
- If messages: show ChatThread immediately
- Read `?prompt=` query param and auto-send
- Chat input always active

- [ ] **Step 1: Rewrite chat page**

**Import path note:** `src/app/(app)/chat/page.tsx` is 4 filesystem levels from the project root (the `(app)` directory exists on disk even though it's a virtual route group in the URL). So the convex import needs 4 `../`: `../../../../convex/_generated/api`.

```tsx
"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ChatThread } from "@/components/ChatThread";
import { ChatInput } from "@/components/ChatInput";
import { Sparkles, Dumbbell, TrendingUp, Zap, Activity } from "lucide-react";

const suggestions = [
  { icon: Dumbbell, text: "Program me a workout for today" },
  { icon: TrendingUp, text: "How are my strength scores trending?" },
  { icon: Zap, text: "Which muscles are freshest right now?" },
  { icon: Activity, text: "Analyze my training this month" },
];

// Wrap in Suspense because useSearchParams requires it in Next.js 14+
export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeThread = useQuery(api.threads.getCurrentThread);
  const sendMessage = useAction(api.chat.sendMessage);
  const me = useQuery(api.users.getMe);
  const autoSentRef = useRef(false);

  // Auto-send from ?prompt= query param (once only)
  const promptParam = searchParams.get("prompt");
  useEffect(() => {
    if (promptParam && !autoSentRef.current) {
      autoSentRef.current = true;
      // Remove param from URL to prevent re-send on refresh
      router.replace("/chat");
      sendMessage({ prompt: promptParam });
    }
  }, [promptParam, router, sendMessage]);

  // Determine if we have messages (thread exists = has messages)
  const hasThread = activeThread !== undefined && activeThread !== null;
  const userInitial = me?.tonalName?.charAt(0).toUpperCase() ?? "U";

  // Show welcome state when no thread/messages exist
  if (activeThread !== undefined && !hasThread && !promptParam) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            What are we working on today?
          </h2>
          <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
            I can check your readiness, program workouts, analyze trends, or
            just talk training.
          </p>
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            {suggestions.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => sendMessage({ prompt: text })}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm text-foreground/80 transition-all hover:border-primary/30 hover:bg-card/80 active:scale-[0.98]"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input always visible even on welcome screen */}
        <div className="shrink-0 border-t border-border p-3 sm:p-4">
          <ChatInput />
        </div>
      </div>
    );
  }

  // Loading or has messages — show ChatThread
  return <ChatThread userInitial={userInitial} />;
}
```

**Note:** `ChatInput` must be a named export. Check the current file — if it's a default export, change it to named export in Task 12 Step 1.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test**

Start the dev server (`npm run dev`) and verify:
1. `/chat` shows welcome state with 4 suggestions when no messages exist
2. Clicking a suggestion sends a message and transitions to ChatThread
3. Navigating to `/chat?prompt=test` auto-sends and shows conversation

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/chat/page.tsx
git commit -m "feat: rewrite chat page with welcome state and auto-send from query param"
```

---

### Task 14: Dashboard CTAs + greeting

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` — greeting header
- Modify: `src/components/MuscleReadinessMap.tsx` — CTA
- Modify: `src/components/TrainingFrequencyChart.tsx` — CTA
- Modify: `src/components/StrengthScoreCard.tsx` — static CTA

**Context files to read first:**
- `src/app/(app)/dashboard/page.tsx` — current dashboard layout and card rendering
- `src/components/MuscleReadinessMap.tsx` — readiness values, readinessColor/readinessLabel helpers
- `src/components/TrainingFrequencyChart.tsx` — frequency data with `targetArea` and `count`
- `src/components/StrengthScoreCard.tsx` — strength scores and percentile
- `convex/users.ts` — `getMe` returns `tonalName`

- [ ] **Step 1: Add greeting header to dashboard page**

In `src/app/(app)/dashboard/page.tsx`, replace the `<h1>Training Dashboard</h1>` heading:

```tsx
// Add useQuery for user data (may already be available from AppShell context, but query is fine)
const me = useQuery(api.users.getMe);
const firstName = me?.tonalName?.split(" ")[0] ?? "there";
const today = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

// In JSX, replace <h1>Training Dashboard</h1> with:
<div className="mb-6">
  <h1 className="text-xl font-semibold text-foreground">
    Hey {firstName}
  </h1>
  <p className="text-sm text-muted-foreground">{today}</p>
</div>
```

Also add the `useQuery` import if not already present, and import `api`:
```tsx
import { useQuery } from "convex/react";
```

Also update the local `FrequencyEntry` interface in `dashboard/page.tsx` (around line 116) to include the new field from Task 6:
```tsx
interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}
```

This ensures the `TrainingFrequencyChart` component can access `lastTrainedDate` when received from the backend.

- [ ] **Step 2: Add CTA to MuscleReadinessMap**

In `src/components/MuscleReadinessMap.tsx`, add a link at the bottom when any muscle group has readiness >80%:

```tsx
import Link from "next/link";
```

After the grid of muscle entries, before the closing `</div>`:

```tsx
{(() => {
  const fresh = entries.find((e) => e.value > 80);
  if (!fresh) return null;
  const prompt = encodeURIComponent(
    `My ${fresh.muscle.toLowerCase()} is at ${fresh.value}% readiness. Can you program a ${fresh.muscle.toLowerCase()} workout?`,
  );
  return (
    <Link
      href={`/chat?prompt=${prompt}`}
      className="mt-3 block text-xs text-primary hover:underline"
    >
      {fresh.muscle} is fresh — ask coach for a workout →
    </Link>
  );
})()}
```

- [ ] **Step 3: Add CTA to TrainingFrequencyChart**

In `src/components/TrainingFrequencyChart.tsx`, accept the new `lastTrainedDate` field and show a CTA when any area hasn't been trained in >7 days:

Update the `FrequencyEntry` interface:
```tsx
interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}
```

Add `Link` import and after the frequency bars, before closing `</div>`:

```tsx
import Link from "next/link";

// After the bars, add:
{(() => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stale = data.find(
    (d) => d.lastTrainedDate && new Date(d.lastTrainedDate).getTime() < sevenDaysAgo,
  );
  if (!stale) return null;
  const days = Math.round(
    (Date.now() - new Date(stale.lastTrainedDate!).getTime()) / (1000 * 60 * 60 * 24),
  );
  const prompt = encodeURIComponent(
    `I haven't trained ${stale.targetArea.toLowerCase()} in ${days} days. Can you suggest a workout?`,
  );
  return (
    <Link
      href={`/chat?prompt=${prompt}`}
      className="mt-3 block text-xs text-primary hover:underline"
    >
      You haven&apos;t hit {stale.targetArea.toLowerCase()} in {days} days — ask coach →
    </Link>
  );
})()}
```

- [ ] **Step 4: Add static CTA to StrengthScoreCard**

In `src/components/StrengthScoreCard.tsx`, add a simple link at the bottom:

```tsx
import Link from "next/link";

// After the progress rings grid, before closing </div>:
<Link
  href={`/chat?prompt=${encodeURIComponent("Tell me about my strength score trends")}`}
  className="mt-3 block text-xs text-primary hover:underline"
>
  Ask coach about your strength trends →
</Link>
```

- [ ] **Step 5: Add hover elevation to dashboard cards**

In `src/app/(app)/dashboard/page.tsx`, the cards are rendered by sub-components. Each sub-component uses a `<div className="rounded-lg border border-border bg-card p-4">` wrapper. Adding hover elevation requires modifying each card component's root div:

```tsx
className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-black/10"
```

Do this for: `MuscleReadinessMap`, `TrainingFrequencyChart`, `StrengthScoreCard`, `RecentWorkoutsList`. Each component has a root `<div className="rounded-lg border border-border bg-card p-4">` — add `transition-shadow hover:shadow-md hover:shadow-black/10` to that className. Note: `RecentWorkoutsList` has two such divs (empty state and content state) — update both.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/components/MuscleReadinessMap.tsx src/components/TrainingFrequencyChart.tsx src/components/StrengthScoreCard.tsx src/components/RecentWorkoutsList.tsx
git commit -m "feat: add dashboard greeting, CTAs linking to chat, and hover elevation"
```
