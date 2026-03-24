# UX Refinement: Navigation, Chat, Dashboard, Polish

## Goal

Holistic UX pass across the entire app: unified responsive navigation, rich chat rendering with a "one coach" conversation model, upgraded dashboard, and consistent polish. Structural improvements and visual quality in one pass.

## Context

tonal.coach is a small, new app with a solid backend (AI agent, 10 tools, Tonal API integration) but a rough frontend. Navigation is fragmented (no way to move between pages), chat messages only render bold and code, the thread sidebar is a shell, tool call indicators are minimal, and the workout creation flow is invisible. The app just got a design system refresh (DM Sans, teal accent, shadcn components) and is ready for the UX layer.

The product vision: a virtual personal trainer for Tonal owners. The chat should feel like texting your coach, not managing threads. The dashboard is a separate training data home base that will grow over time (progress photos, nutrition, body comp).

**Existing responsive nav:** `src/app/dashboard/layout.tsx` already has a responsive layout with desktop header nav, mobile bottom tabs, and full auth guards — but uses the `sm` (640px) breakpoint and only wraps dashboard pages. The new AppShell unifies this across all authenticated pages and changes the breakpoint to `lg` (1024px) for a better tablet experience.

## Architecture

Three independent workstreams that can be implemented in parallel:

1. **Navigation shell** — shared `AppShell` component with responsive layout (sidebar on desktop, bottom tabs on mobile). All authenticated pages become children of this shell.
2. **Chat quality** — new conversation model (auto-sessions, one continuous scroll), rich markdown rendering, upgraded tool indicators, workout card, chat home personality.
3. **Dashboard bridge** — CTAs on dashboard cards that link into the chat with pre-filled prompts.

### New dependencies

- `react-markdown` + `remark-gfm` — markdown rendering for coach messages
- `tailwindcss-safe-area` plugin (or custom `env(safe-area-inset-bottom)` utility) — for `pb-safe` on mobile bottom tab bar
- shadcn `Sheet` component — mobile thread drawer (if needed for history scroll)

### Backend changes

- Modify `listMessages` or add a new query to support the continuous conversation model (load messages across auto-sessions, stitched together with date dividers)
- Auto-session logic: new session (thread) created automatically if last message is >24h old. Transparent to user.
- Thread title generation: first user message, truncated to ~50 chars (used internally, not shown to user)

---

## 1. Navigation Shell

### 1.1 AppShell component

New component: `src/components/AppShell.tsx`

A responsive layout wrapper used by all authenticated pages (chat, dashboard, settings). Replaces both `chat/layout.tsx` (chat only) and `dashboard/layout.tsx` (dashboard only, uses `sm` breakpoint). The new breakpoint is `lg` (1024px) — up from `sm` (640px) — so tablets get the mobile layout instead of a cramped sidebar.

**Desktop (lg and above):**

- Left sidebar (256px width), fixed height, flex column
- Sidebar contains: logo ("tonal.coach"), nav links (Chat, Dashboard, Settings), divider, user name at bottom (from `tonalName`)
- Main content fills remaining width
- No thread list in sidebar (one-coach model)

**Mobile (below lg):**

- No sidebar
- Bottom tab bar with 3 tabs: Chat, Dashboard, Settings
- Each tab: Lucide icon + label text
- Active tab highlighted with primary color
- Safe area padding (`pb-safe`) for notch devices
- Tab bar has subtle top border, semi-transparent background

**Nav links:**

- Chat: `MessageSquare` icon, routes to `/chat`
- Dashboard: `LayoutDashboard` icon, routes to `/dashboard`
- Settings: `Settings` icon, routes to `/settings`

**Breakpoint:** `lg` (1024px), consistent with existing Tailwind usage.

### 1.2 Layout restructuring

**Current structure:**

- `src/app/chat/layout.tsx` — wraps chat pages with sidebar + auth guards
- `src/app/dashboard/layout.tsx` — wraps dashboard with header nav (desktop) + bottom tabs (mobile) + auth guards, uses `sm` breakpoint
- `src/app/dashboard/page.tsx` — dashboard page inside dashboard layout
- `src/app/settings/page.tsx` — standalone page with back arrow, own auth guards

**New structure:**

- `src/app/(app)/layout.tsx` — `AppShell` wrapper with auth guards. Applies to all authenticated routes.
- `src/app/(app)/chat/page.tsx` — chat (single route, thread managed as state)
- `src/app/(app)/dashboard/page.tsx` — dashboard
- `src/app/(app)/settings/page.tsx` — settings

**Auth guards move to AppShell:** The `useConvexAuth` + `useQuery(getMe)` + redirect logic currently duplicated across chat layout, settings, and dashboard moves into AppShell once. Individual pages no longer handle auth.

**Settings loses its back arrow and min-h-screen wrapper.** It renders inside AppShell's main content area.

**Dashboard loses its standalone heading.** The nav indicates which page you're on.

### 1.3 Mobile chat header

On mobile, the chat page gets a minimal header bar (below the status bar, above the message area):

- Left: coach avatar/icon
- Center: "Coach" or "tonal.coach"
- Right: (reserved for future — notifications, etc.)

This replaces the current hamburger menu button since the sidebar no longer exists on mobile.

---

## 2. Chat Quality

### 2.1 Conversation model: auto-sessions

**User experience:** One continuous conversation. Open the app, your coach is there, scroll up to see history. No threads, no "New Chat" button.

**Technical implementation:**

- When user sends a message, check the last message timestamp in the most recent thread.
- If >24 hours since last message: create a new thread automatically. User doesn't see this.
- If ≤24 hours: append to existing thread.
- The chat UI loads messages from the current thread. A "Load earlier" button at the top loads messages from the previous thread, seamlessly stitched.
- Date dividers ("Today", "Yesterday", "March 8") inserted between messages from different days.

**Backend changes:**

- New `internalQuery`: `getActiveThread` in `convex/threads.ts` — uses the agent component's `listThreadsByUserId` internal query (accepts `userId`, returns threads with `_creationTime`, `status`, `title`) to find the most recent active thread. Returns its ID and the timestamp of the last message in that thread (fetched separately via the agent's message listing, since the thread record itself doesn't store message timestamps). Must be `internalQuery` (not public query) so `sendMessage` action can call it via `ctx.runQuery`.
- Modify `sendMessage` action in `convex/chat.ts`: staleness check happens inside the action (not client-side). Logic: if no `threadId` provided, call `getActiveThread` via `ctx.runQuery`. If no thread exists or last message is >24h old, create a new thread via the agent component's `createThread`. Then send the message to the resolved thread.
- Also expose `getActiveThread` as a public query wrapper (or a separate `getCurrentThread` query) so the chat page can subscribe to the current thread ID on load.

**Message loading — two data sources:**

- **Current thread (streaming):** The chat page continues to use `useUIMessages` + `syncStreams` from `@convex-dev/agent/react`, bound to the active thread ID. This preserves real-time streaming for new messages.
- **Previous threads (static, "Load earlier"):** New public query `listConversationHistory` in `convex/threads.ts` loads historical messages across older threads. Called from the client when user clicks "Load earlier". Paginated with cursor. Returns messages with thread boundary markers for date dividers. These are fully-formed historical messages — no streaming.
- **Merge strategy:** The chat UI maintains two message arrays: `historicalMessages` (from `listConversationHistory`, prepended at top) and `currentMessages` (from `useUIMessages`, appended at bottom). A date divider component is inserted between messages from different days across both arrays.

**Chat routing:** `/chat` is the only user-facing route. The `[threadId]` route is removed. The chat page calls the public `getCurrentThread` query to subscribe to the active thread ID, then binds `useUIMessages` to it. Thread ID is reactive state from the query, not a URL param.

**Chat home page (`/chat`) changes:**

- No longer a "pick a suggestion to start" gate. The chat input is always active.
- If no messages exist yet: show the welcome/personality state (section 2.4) above the input.
- If messages exist: show the conversation immediately, scrolled to bottom.
- Suggestion cards appear as part of the welcome state, not as a blocking step.

### 2.2 Message rendering

**Replace `ChatMessage.tsx` entirely.**

New message layout (both roles):

- Header row: avatar (24px circle) + role name ("You" / "Coach") + timestamp
- Content: indented 32px (aligned with role name), full width
- Messages separated by subtle `border-border` divider (not inside a bubble)

**User messages:**

- Avatar: user's first initial in a teal (primary) circle
- Role name: "You"
- Content: plain text, no markdown processing

**Coach messages:**

- Avatar: sparkle/star icon in a muted circle
- Role name: "Coach"
- Content: rendered with `react-markdown` + `remark-gfm`

**Markdown styling (dark theme):**

- **Bold:** `font-semibold text-foreground` (brighter than surrounding text)
- **Italic:** standard italic
- **Inline code:** `rounded bg-muted px-1.5 py-0.5 font-mono text-sm`
- **Code blocks:** `rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto`
- **Unordered lists:** standard disc bullets, `pl-5 space-y-1`
- **Ordered lists:** decimal numbers, `pl-5 space-y-1`
- **Tables:** bordered with `border-border`, header row with `bg-muted/50`, cells padded
- **Headers (h1-h4):** scaled sizes, `font-semibold text-foreground`, appropriate margins
- **Links:** `text-primary underline underline-offset-2`
- **Blockquotes:** `border-l-2 border-primary/30 pl-4 italic text-muted-foreground`

**Streaming cursor:** Keep the existing blinking cursor at the end of streaming text. Append the cursor character (`▍`) to the raw markdown string _before_ passing it to `react-markdown`, not after the rendered output — this ensures it appears inside the last rendered element (e.g., at the end of a list item) rather than floating outside.

### 2.3 Tool call indicators

**Replace `ToolCallIndicator.tsx`.**

**Running state (input-streaming / input-available):**

- Inline chip: animated teal pulse dot + descriptive text
- e.g., `● Checking muscle readiness...`
- Rendered between user message and coach response

**Completed state (output-available):**

- Compact chip: teal checkmark + past-tense text
- e.g., `✓ Checked muscle readiness`
- Multiple completed calls render as a horizontal `flex-wrap` row of chips
- Chips have subtle background (`bg-muted/50`), rounded, small text (`text-xs`)

**Special case — `create_workout`:** Still renders the WorkoutCard on completion (section 2.5).

**Completed tool calls that aren't `create_workout`** return `null` in the current code. In the new design, they render as the compact chips described above — this gives the user visibility into what the coach looked at.

### 2.4 Chat home personality

When the user has no messages (first visit) or the conversation area is empty:

- Coach avatar (larger, 48px) centered
- Greeting: **"What are we working on today?"** (bold, larger text)
- Subtext: "I can check your readiness, program workouts, analyze trends, or just talk training."
- 4 suggestion cards in a 2x2 grid below (same suggestions as current, but with slightly more padding, subtle hover scale animation, and the icons in primary color)
- Chat input always visible at bottom

This state disappears once there are messages — it's a welcome screen, not a permanent fixture.

### 2.5 Workout card upgrade

**When `create_workout` tool completes:**

Render a dedicated `WorkoutCard` component inline in the chat:

- Card with subtle primary border (teal accent)
- Title: workout name (bold)
- Exercise list: numbered, with exercise name + sets × reps
- Estimated duration if available
- Status badge based on `workoutPlans` table status:
  - `"draft"` → "Preview" (outline badge) — workout proposed but not yet pushed. Currently `create_workout` pushes immediately, so this badge only appears if we add a confirmation step in a future iteration.
  - `"pushed"` → "Pushed to Tonal" (teal filled badge with checkmark) — workout successfully sent to the Tonal machine. This is the default state after `create_workout` completes.
  - `"completed"` → "Completed" (green filled badge with checkmark) — workout was done on the Tonal.
  - `"deleted"` → "Removed" (muted/strikethrough badge) — workout was deleted.

The current WorkoutCard already exists but is basic. Enhance it with the status badges (reading from the `workoutPlans` record) and the teal accent treatment to make it feel like a celebration moment.

---

## 3. Dashboard Bridge

### 3.1 Actionable cards

Each dashboard card gets an optional CTA that links to the chat with a pre-filled prompt:

- **Muscle Readiness card:** When a muscle group is at high readiness (>80%), show a CTA like "Legs are fresh — ask coach for a leg day". The >80% threshold is specific to this CTA — it's separate from the MuscleReadinessMap's color thresholds (which use >60% for "Ready" green). The CTA only fires for genuinely fresh muscles worth training.
- **Strength Scores card:** "Ask coach about your strength trends" — static link at the bottom (always visible, no conditional logic).
- **Training Frequency card:** If a muscle group hasn't been trained in >7 days, surface it: "You haven't hit back in 10 days". **Data gap:** The current `getTrainingFrequency` action returns `{ muscleGroup, count }` for the last 30 days but not `lastTrainedDate`. Add `lastTrainedDate` (most recent workout date per area) to the response so the CTA can compute days since last training.
- **Recent Workouts card:** No CTA needed (informational).

**Implementation:** CTAs use `router.push('/chat?prompt=...')`. The chat page reads the `prompt` query param, populates the input, and auto-sends it once. Edge cases: the param is consumed on first read (removed from URL via `router.replace` to prevent re-send on refresh), auto-send is skipped if the coach is already streaming, and the prompt text is briefly visible in the input before sending.

### 3.2 Dashboard polish

- Add a greeting header: "Hey {firstName}" with today's date. **Note:** `getMe` returns `tonalName` (full name, e.g., "Jeffrey Otano"), not `firstName` separately. Parse client-side: `tonalName?.split(" ")[0]`. No backend change needed.
- Cards get subtle hover elevation on desktop
- Skeleton loading already uses shadcn (from previous work) — no changes needed

---

## 4. Files Summary

### Created

- `src/components/AppShell.tsx` — responsive navigation shell
- `src/components/BottomTabs.tsx` — mobile tab bar (or inline in AppShell)
- `src/components/Sidebar.tsx` — desktop sidebar (or inline in AppShell)
- `src/components/MarkdownContent.tsx` — react-markdown wrapper with styled components
- `src/components/DateDivider.tsx` — "Today", "Yesterday", date separator
- `src/app/(app)/layout.tsx` — authenticated route group layout
- `convex/threads.ts` — `getActiveThread` (internalQuery), `getCurrentThread` (public query wrapper), `listConversationHistory` (public query, paginated)

### Modified

- `src/components/ChatMessage.tsx` — full rewrite (full-width, avatars, markdown)
- `src/components/ToolCallIndicator.tsx` — rewrite (chip style)
- `src/components/WorkoutCard.tsx` — add status badges, teal accent
- `src/components/ChatThread.tsx` — adapt to auto-session model, date dividers, continuous scroll
- `src/app/chat/page.tsx` — move into `(app)` group, new welcome state, auto-send from query param, remove `[threadId]` routing (thread managed as state)
- `src/app/dashboard/page.tsx` — move into `(app)` group, add CTAs, greeting header
- `src/app/settings/page.tsx` — move into `(app)` group, remove back arrow and standalone wrapper
- `src/components/ChatInput.tsx` — minor: always active (no "disabled until suggestion picked" state)
- `src/components/StatusBanner.tsx` — move inside AppShell (above main content, below nav)
- `convex/chat.ts` — modify `sendMessage` to auto-resolve active thread (staleness check in action)
- `convex/dashboard.ts` — add `lastTrainedDate` per muscle group to `getTrainingFrequency` response
- `src/components/MuscleReadinessMap.tsx` — add CTA when any muscle group readiness >80%
- `src/components/TrainingFrequencyChart.tsx` — add CTA when any area not trained in >7 days
- `src/components/StrengthScoreCard.tsx` — add static "Ask coach" CTA link

### Deleted

- `src/app/chat/layout.tsx` — replaced by `(app)/layout.tsx`
- `src/app/chat/[threadId]/page.tsx` — removed (thread managed as state in `/chat`, not as a route)
- `src/app/dashboard/layout.tsx` — replaced by `(app)/layout.tsx` (had its own responsive nav at `sm` breakpoint + auth guards)
- `src/components/ThreadSidebar.tsx` — replaced by Sidebar inside AppShell

### Not touched

- All other Convex backend files (tonal/, dashboard actions, etc.) except `convex/dashboard.ts` (minor)
- Landing page, login, connect-tonal (not inside `(app)` group)
- Dashboard sub-components other than those listed above

---

## 5. Success Criteria

- All authenticated pages share the AppShell with working navigation
- Bottom tabs work on mobile, sidebar on desktop, with correct active states
- Chat feels like one continuous conversation — no thread management visible to user
- Coach messages render full markdown (bold, lists, tables, code, headers, links)
- Tool calls render as compact chips (animated when running, checkmark when done)
- Workout creation has a visible card with status badges
- Dashboard cards have CTAs that link to the chat
- Type-checks pass (`npx tsc --noEmit`)
- No visual regressions on landing, login, connect-tonal pages
