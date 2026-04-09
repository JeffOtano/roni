# tonal.coach — Reddit Launch: Product Plan

> [!NOTE]
> **Historical product-planning document dated March 14, 2026.** This describes the product at that planning moment, not the current repo state. Several features referenced here (notably the Google Calendar integration and the 50-user beta cap) were later removed when the project went open source. Kept in the repo for historical context only - do not treat as current product guidance.

**Author:** Jeff Otano
**Date:** March 14, 2026
**Goal:** Ship the features required to make the r/tonal Reddit launch post land. Transform from "AI chatbot for Tonal" to "AI personal trainer that programs your week."
**Audience:** Product planning, no technical implementation details.

---

## Table of Contents

1. [What "Reddit-Ready" Means](#1-what-reddit-ready-means)
2. [Feature Brief: Weekly Programming](#2-feature-brief-weekly-programming)
3. [Feature Brief: Activation Flow](#3-feature-brief-activation-flow)
4. [Feature Brief: Progressive Overload Tracking](#4-feature-brief-progressive-overload-tracking)
5. [Feature Brief: Workout Verification](#5-feature-brief-workout-verification)
6. [Feature Brief: Missed Session Detection](#6-feature-brief-missed-session-detection)
7. [Release Plan](#7-release-plan)
8. [Reddit Launch Checklist](#8-reddit-launch-checklist)

---

## 1. What "Reddit-Ready" Means

### The Demo Video Test

The Reddit post lives or dies on a 60-90 second demo video showing this sequence:

1. User connects Tonal
2. AI surfaces a data insight the user didn't know
3. AI programs the full week
4. All sessions appear on Tonal
5. User completes a session and the AI references the results in next week's programming

If any step in this sequence doesn't work flawlessly, the post doesn't land. "Cool chatbot" is not a Reddit post. "AI that programs your entire week and every session is waiting on your Tonal" is.

### What We Have Today

- Chat-based AI coaching with full Tonal data access
- Single workout push-to-Tonal
- Dashboard with training analytics
- Google Calendar integration (basic OAuth + auto-create events)

### What's Missing

The product today is a chatbot. The Reddit post needs to show a personal trainer. That requires:

1. **Weekly programming** — program the full week, push all sessions to Tonal at once
2. **Activation flow** — the first 5 minutes that creates the "holy shit" moment
3. **Progressive overload tracking** — AI references past performance and recommends specific progressions
4. **Workout verification** — confirm pushes actually made it to Tonal
5. **Missed session detection** — AI notices when you skip and offers to adjust the week

### Go / No-Go Criteria

**Must pass all five to post on Reddit:**

- [ ] A new user can connect Tonal, see a personalized insight, and have a full week's workouts on their Tonal within 5 minutes
- [ ] Every push is verified — user always knows whether their workout made it
- [ ] Programmed workouts include specific weight/rep targets based on past performance
- [ ] If a user misses a session and opens the app, the AI addresses it and offers to replan
- [ ] 3 real users (minimum) have completed the full activation flow end-to-end without issues

---

## 2. Feature Brief: Weekly Programming

### Why This Feature

This is the product. Without it, tonal.coach is "a chatbot that makes one workout at a time." With it, tonal.coach is "an AI personal trainer that programs your entire week." That's the difference between a curiosity and a product people need.

The weekly programming creates the core habit: walk up to your Tonal on any training day and your session is waiting. No decisions, no builder, no research. That habit is the retention mechanism.

### User Stories

| #   | As a...                   | I want to...                                           | So that...                                                  |
| --- | ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 1   | Tonal owner               | ask my AI coach to program my entire week              | I can walk up to my Tonal any day and my session is waiting |
| 2   | User                      | tell the coach my preferred split and available days   | the programming fits my life                                |
| 3   | User                      | see my full week's plan before it gets pushed          | I can approve or adjust before it goes to my Tonal          |
| 4   | User                      | swap individual exercises in a planned session         | I can customize without reprogramming the whole week        |
| 5   | User                      | move a session to a different day                      | I can adjust when my schedule changes                       |
| 6   | User                      | say "make today shorter" and get a condensed version   | I can still train when I'm short on time                    |
| 7   | User who missed a session | have the AI automatically adjust my remaining week     | the rest of my week still makes sense                       |
| 8   | User                      | reject the whole plan and ask for a different approach | I'm never stuck with a plan I don't like                    |

### Detailed UX Flows

#### Flow A: First-Time Weekly Programming

**Trigger:** User asks "program my week" or AI suggests it during activation.

**Step 1 — Gather preferences (skip if already known)**

AI: "Let's set up your week. A few quick questions:"

- "What days can you train this week?" → User picks from Mon-Sun
- "How long do you want each session?" → 30 / 45 / 60 minutes
- "Any preference for your split?" → PPL (Push/Pull/Legs), Upper/Lower, Full Body, or "You decide based on my data"

If the user has established preferences from a previous conversation, skip this step entirely. AI: "I've got your preferences from last time — 3 days, PPL, 45 minutes. Programming your week now."

**Step 2 — Present the weekly plan**

AI presents a structured plan — not a wall of text. Each day is a card/block:

```
Here's your week:

MONDAY — Push Day (Chest, Shoulders, Triceps) — 45 min
  1. Bench Press         4x10  target: 72 lbs  (last: 69 avg)
  2. Incline Chest Press  3x12  target: 58 lbs  (last: 55 avg)
  3. Overhead Press       4x10  target: 54 lbs  (last: 52 avg)
  4. Lateral Raise        3x15  target: 15 lbs  (new)
  5. Tricep Pushdown      3x12  target: 38 lbs  (last: 36 avg)
  6. Chest Fly            3x15  target: 32 lbs  (last: 30 avg)

WEDNESDAY — Pull Day (Back, Biceps, Rear Delts) — 45 min
  [similar format]

FRIDAY — Leg Day (Quads, Hamstrings, Glutes, Calves) — 50 min
  [similar format]

Want me to send all three to your Tonal?
Or tell me what to change — swap exercises, move days, adjust anything.
```

**Step 3 — User reviews and modifies**

The user can:

- **Approve:** "Looks good, send it" → All sessions pushed to Tonal, verified, confirmed
- **Swap an exercise:** "Swap overhead press for something else" → AI replaces with an alternative and explains why it works: "Swapped OHP for Arnold Press — hits the same muscles with more front delt emphasis. Updated your Monday."
- **Move a day:** "Move Wednesday to Thursday" → AI adjusts and re-presents
- **Remove a day:** "I don't want to train Friday" → AI redistributes Friday's volume across Monday and Wednesday, explains the trade-off: "Moved leg volume to Monday and Wednesday. You'll have slightly longer sessions (~55 min each) but still hit everything."
- **Adjust duration:** "Make Wednesday shorter" → AI creates a condensed version: compounds only, fewer accessories
- **Reject:** "Start over" or "I want something completely different" → AI asks what didn't work and reprograms

**Step 4 — Push and confirm**

After user approves:

1. AI pushes all workouts to Tonal
2. AI verifies each push (see Workout Verification feature brief)
3. AI confirms: "Done. All 3 sessions are on your Tonal. Monday: Push, Wednesday: Pull, Friday: Legs. Walk up and go."

#### Flow B: Returning User — "Program Next Week"

**Trigger:** User comes back after completing some or all of last week's sessions.

1. AI already knows what happened last week (Tonal data)
2. AI: "Last week: you hit Push and Pull but missed Legs. This week I'll front-load lower body. Here's the plan:" → presents week with progressive overload adjustments baked in
3. No need to re-ask preferences unless the user wants to change them

#### Flow C: Mid-Week Adjustment — Day-Of Change

**Trigger:** User opens chat on a training day and says something about their current state.

| User says                      | AI response                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I only have 30 minutes today" | "Here's a condensed Push Day — 4 compound exercises, 30 minutes. Same muscles, less volume. Want me to update your Tonal?"                          |
| "I'm exhausted today"          | "Let's go lighter. Recovery session — same exercises, 60% intensity, focus on movement quality. Or skip today and I'll adjust the week. Your call." |
| "My shoulder hurts"            | "Let's avoid overhead and chest pressing today. I can reprogram to a row and bicep focus, or swap to Leg Day. What sounds better?"                  |
| "I want to go harder today"    | "I can add a 5th set to your compounds and throw in drop sets on the last set of each exercise. That'll add ~10 minutes. Want that?"                |
| "Skip today entirely"          | "Got it. I'll redistribute today's volume across your remaining sessions this week. [shows updated plan]"                                           |

#### Flow D: Mid-Week Adjustment — Missed Session (Proactive)

Covered in detail in the Missed Session Detection feature brief. Summary:

1. AI detects user didn't complete a programmed session
2. When user opens the app, AI addresses it and offers to shift the week
3. No guilt, only forward-looking options

### What the AI Considers When Programming

The user doesn't see this reasoning, but it shapes every decision:

- **Muscle readiness scores** from Tonal (which muscles are recovered enough to train)
- **Volume distribution** — balanced across muscle groups, not front-loaded or neglected
- **Exercise variety** — not the same 6 exercises every week
- **Compound-first** — big movements at the start of each session
- **Progressive overload** — slightly harder than last week (see Progressive Overload feature brief)
- **User constraints** — injuries, time limits, equipment preferences
- **Session duration** — respecting the user's stated time per session
- **Recovery projection** — if chest is trained Monday, chest exercises don't appear until Thursday at earliest

### Edge Cases

| Situation                                         | How the AI handles it                                                                                                                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User has zero training history                    | Ask preferences, program conservatively with foundational movements. Set baseline weights from strength scores.                                                                                                                          |
| User wants 7 days/week                            | Warn about recovery: "Training every day doesn't leave room for recovery. I'd recommend 5 training days + 2 recovery/mobility days. Want me to build that?" If they insist, comply but with lighter sessions and built-in recovery days. |
| User has a flagged injury                         | Avoid affected areas entirely. Explain: "I'm keeping overhead pressing out because of the shoulder you mentioned. I'll add it back when you tell me it's resolved."                                                                      |
| User rejects the plan 3+ times                    | Stop guessing. Ask directly: "What's not working? Is it the exercises, the split, the volume, or something else? Help me understand what you're looking for."                                                                            |
| User already has workouts on Tonal for those days | "You already have a Chest & Back workout on Monday. Want me to replace it, or should I program around it?"                                                                                                                               |
| Tonal session expires during programming          | "Your Tonal connection needs refreshing. Reconnect and I'll push the workouts I just programmed — you won't lose the plan."                                                                                                              |
| User asks for a split the AI disagrees with       | Comply but explain: "5-day bro split works, but at your training level, a 3-day PPL would probably give you better results. Want to try PPL for a month and compare?"                                                                    |
| User only has 2 days available                    | Program full-body sessions. "With 2 days, full-body is the way to go. I'll make sure we hit everything."                                                                                                                                 |

### Acceptance Criteria

- [ ] User can request a full week's programming through chat
- [ ] AI generates a coherent week — not 3 random workouts — with volume distribution, muscle group rotation, and progressive structure
- [ ] All sessions pushed to Tonal in a single approval flow
- [ ] User can approve, modify individual exercises, move days, adjust duration, or reject the entire plan
- [ ] AI adapts the week when sessions are missed (within 24 hours)
- [ ] Plan respects all user-stated constraints (available days, session duration, injuries)
- [ ] Returning users get next week's plan without re-answering preference questions
- [ ] Mid-week adjustments (time constraints, fatigue, pain) produce a modified plan within the same conversation

### Success Metrics

| Metric                      | Target                                                           | How to measure                                                                                             |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Weekly programming adoption | >50% of active users try it in first 7 days                      | Count unique users who trigger weekly programming flow                                                     |
| Completion rate             | >60% of programmed workouts completed on Tonal                   | Match pushed workout IDs to completed workouts in Tonal history                                            |
| Repeat rate                 | >70% of users who program one week program the following week    | Track week-over-week programming usage per user                                                            |
| Plan acceptance rate        | >80% of presented plans accepted (with or without modifications) | Count approvals / (approvals + rejections)                                                                 |
| Modification rate           | Track but don't target                                           | What % of users modify plans before approving — directionally tells us how good the initial programming is |

---

## 3. Feature Brief: Activation Flow

### Why This Feature

The first 5 minutes determine whether a user becomes a customer or bounces. Fitness apps live and die here. The activation flow needs to accomplish one thing: create the "holy shit" moment where the user realizes this product knows them and can do something valuable immediately.

The anti-pattern is a blank chat box that says "How can I help you?" That puts the work on the user. The AI should lead with value before the user has to think of a question.

### User Stories

| #   | As a...                | I want to...                                                          | So that...                                 |
| --- | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| 1   | New user (data-rich)   | the AI to immediately show me something interesting about my training | I feel the value before I ask a question   |
| 2   | New user (little data) | the AI to ask me smart questions and build a plan                     | I get value even without training history  |
| 3   | New user               | the loading time to feel intentional                                  | the experience doesn't feel broken or slow |
| 4   | New user               | my first week's workouts on my Tonal within 5 minutes                 | I can walk up and train immediately        |

### Detailed UX Flows

#### Flow A: Data-Rich User (2+ Weeks of Tonal History)

This is the primary activation path and the one shown in the demo video.

**Step 1 — Connect Tonal**

User enters Tonal credentials. Clear security disclosure: "Your password is used once to create a secure connection, then discarded. Only the connection token is stored, encrypted."

**Step 2 — Loading state (10-30 seconds)**

NOT a silent spinner. The loading state builds anticipation:

- "Pulling your training history from Tonal..."
- Progress indicator showing workouts being synced: "142 workouts found..."
- "Analyzing your training patterns..."
- "I'm about to show you something interesting."

The copy frames the wait as the AI doing work for them, not the app being slow.

If loading exceeds 30 seconds: "You've got a lot of history — this is taking a bit longer. Almost there."

If loading exceeds 60 seconds: "Still working on it. Want to start chatting while I finish pulling your data?"

**Step 3 — The insight**

The AI's opening message. This is the single most important moment in the product. It must be:

- **Personal** — uses their actual data, not generic advice
- **Surprising** — tells them something they didn't know about their own training
- **Actionable** — naturally leads to "want me to fix that?"

The AI selects the highest-value insight from the user's data. Priority order:

1. **Dangerous imbalance:** "You've done 3x more pushing than pulling this month. That's a shoulder injury pattern waiting to happen. I can fix that this week."
2. **Neglected area:** "Your legs haven't been trained in 3 weeks. Your lower body score dropped 12 points. Let me build that back up."
3. **Hidden progress:** "Your bench press has gone from 62 to 74 avg per rep over 6 weeks. That's 19% — real progress most people don't notice."
4. **Consistency pattern:** "You train Mondays and Wednesdays like clockwork but Fridays are hit or miss. Want me to program around a Mon/Wed schedule?"
5. **Volume insight:** "You're averaging 8 sets per muscle group per week. For your goals, 12-16 would be more effective. I can structure that."

If nothing is notable (rare — most users have at least one imbalance): "Your training is actually really well-balanced. Most people I look at have big imbalances. Let me program your next week to keep building on that."

**Step 4 — The bridge to weekly programming**

Immediately after the insight:

"Want me to program your next week based on what I see? I'll balance things out and push everything straight to your Tonal."

This is the moment. If they say yes, they're in the weekly programming flow and 3-4 minutes from having a full week on their Tonal.

If they ask a follow-up question instead ("what do you mean by push/pull imbalance?"), the AI answers conversationally and re-offers to program the week.

If they go in a completely different direction ("just program me a leg day"), the AI complies — the weekly programming pitch can come after they've seen a single workout pushed successfully.

**Step 5 — Weekly programming (if accepted)**

Flows directly into the Weekly Programming feature. Under 5 minutes from Tonal connection to full week on Tonal.

#### Flow B: Cold Start (< 2 Weeks of History)

**Step 1 — Connect Tonal**

Same as Flow A.

**Step 2 — Loading state (shorter — less data)**

"Pulling your training history from Tonal..."
"Found [X] workouts. Let me take a look."

**Step 3 — Acknowledge and pivot**

AI: "Hey [Name]. I can see you're pretty new to Tonal — [X] workouts so far. Not enough data yet for me to spot patterns, but that's fine. Let me get to know your goals so I can start programming for you."

No fake insights. Don't pretend the data says something when it doesn't. Be honest that there isn't enough data yet, and pivot to being useful immediately.

**Step 4 — Guided onboarding (3-4 questions)**

One question at a time, not a form:

1. "What's your main goal?" → Getting stronger / Building muscle / General fitness / Training for a sport / Losing weight
2. "How many days a week can you realistically train?" → 2 / 3 / 4 / 5+
3. "How long do you like your sessions?" → 30 min / 45 min / 60 min
4. "Any injuries or areas to avoid?" → Free text or "None"

**Step 5 — Program first week**

"Got it. Here's your first week:" → Weekly programming flow with conservative weights and foundational exercises.

Once the user accumulates 2+ weeks of history, the insight-first flow (Flow A) kicks in automatically for future interactions.

#### Flow C: Brand New Tonal (0 Workouts)

Same as Flow B, but the opening message acknowledges the blank slate:

"Hey [Name]. Looks like your Tonal is brand new — no workouts yet. Perfect timing. Let me set you up with your first week of training so you can walk up and go."

Proceed with guided onboarding. Program with beginner-appropriate exercises, conservative weights, and focus on movement quality.

### The Loading State in Detail

The loading state deserves its own section because it's the first impression and most apps get this wrong.

**What users see during data sync:**

| Time   | What's shown                                                                    |
| ------ | ------------------------------------------------------------------------------- |
| 0-3s   | "Connecting to your Tonal..."                                                   |
| 3-10s  | "Pulling your training history..." with workout count ticking up                |
| 10-20s | "Analyzing your training patterns..."                                           |
| 20-30s | "I'm about to show you something interesting."                                  |
| 30-45s | "You've got a lot of history — almost there."                                   |
| 45-60s | "Still working on it. Want to start chatting while I finish?"                   |
| 60s+   | "Having trouble with the connection. [Retry] or [Start with questions instead]" |

**Principles:**

- Every state communicates progress — never a static spinner
- The language frames the AI as doing work ("analyzing"), not the app as being slow ("loading")
- After 30 seconds, acknowledge the wait. After 60 seconds, offer an alternative.

### Edge Cases

| Situation                         | How the AI handles it                                                                                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data sync times out               | "Having trouble connecting to Tonal. Want to try again, or start with a few questions while I keep trying in the background?"                                                                                                                                                             |
| Tonal credentials fail            | Clear, specific error: "Couldn't connect — [reason]. Check your email/password and try again. Your password is used once and never stored."                                                                                                                                               |
| Very long history (500+ workouts) | Focus on recent trends (last 6-8 weeks). Don't enumerate all 500. "I pulled 847 workouts going back to 2023. Focusing on your recent training..."                                                                                                                                         |
| The insight is wrong              | User corrects: "That's not an imbalance, I do push with dumbbells too." AI: "Good to know — I can only see what's on your Tonal. If you're doing push work outside of Tonal, your balance is better than I thought. Want to tell me about your off-Tonal training so I can factor it in?" |
| User doesn't respond to insight   | One follow-up: "Anything jumping out at you? Or want me to just program your week?" Then wait.                                                                                                                                                                                            |
| User is overwhelmed               | "I know that's a lot of info. The short version: you've been doing great, but I can make your training more balanced. Want me to just handle it?"                                                                                                                                         |

### Acceptance Criteria

- [ ] New users with 2+ weeks of history see a personalized, data-driven insight within 60 seconds of connecting
- [ ] New users with < 2 weeks of history get a guided onboarding that leads to their first programmed week
- [ ] Loading state communicates progress at every stage — never a silent spinner for more than 3 seconds
- [ ] The AI leads the conversation — user never faces a blank chat box asking "how can I help?"
- [ ] End-to-end: under 5 minutes from Tonal connection to first week's workouts pushed to Tonal
- [ ] The flow gracefully handles connection failures, timeouts, and credential errors

### Success Metrics

| Metric                                    | Target                                                              | How to measure                                                     |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Activation rate                           | >40% of signups complete first AI workout within 72 hours           | Tonal connection timestamp → first AI workout completion timestamp |
| Time-to-value                             | <5 minutes from Tonal connection to first push                      | Measure median elapsed time                                        |
| First-message engagement                  | >80% of users send a message after AI's opening insight             | Count users who respond within the session                         |
| Weekly programming uptake from activation | >60% of users who complete activation enter weekly programming flow | Track flow progression                                             |
| Bounce rate at loading                    | <10% abandon during data sync                                       | Track users who close app during loading state                     |

---

## 4. Feature Brief: Progressive Overload Tracking

### Why This Feature

Without progressive overload, weekly programming is random workout generation. The AI programs you a bench press, but at what weight? Based on what? The user's last session? Their trend over 6 weeks? Their strength score?

Progressive overload is what makes the programming feel intelligent. It's the difference between "do bench press, 4x10" and "do bench press, 4x10 at 72 lbs — you hit 69 last week, let's push for 3 more." That specificity is what human trainers provide and what every competitor lacks in combination with automated data capture.

This is also table stakes. JuggernautAI, Fitbod, Dr. Muscle, and RP Hypertrophy all track progressive overload. Without it, tonal.coach can't credibly claim to be a training tool.

### User Stories

| #   | As a... | I want to...                                                | So that...                                                  |
| --- | ------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | User    | the AI to remember what I lifted last time on each exercise | I don't have to remember or look it up                      |
| 2   | User    | specific weight/rep targets for each exercise               | I know exactly what to aim for, not vague "try to increase" |
| 3   | User    | to know when I hit a PR                                     | I can celebrate real milestones                             |
| 4   | User    | the AI to tell me when I'm stalling                         | I can make a change before I waste months                   |
| 5   | User    | to understand my progression trends                         | I can see whether my training is actually working           |

### How Progressive Overload Appears in the Product

#### Within Weekly Programming

Every exercise in a programmed week includes progression context. The user sees this when the AI presents the weekly plan:

**For exercises with history:**

```
Bench Press: 4x10 @ target 72 lbs
  └── Last session: 4x10 @ 69 avg — pushing for +3 lbs
```

**For exercises with a progression streak:**

```
Overhead Press: 4x10 @ target 56 lbs
  └── 3-week streak: 50 → 52 → 54. Let's keep it going.
```

**For plateaued exercises:**

```
Barbell Row: 4x10 @ target 62 lbs
  └── Flat at 62 for 3 sessions. I have suggestions (ask me).
```

**For new exercises (no history):**

```
Lat Pulldown: 3x12
  └── New exercise — I'll set weight from your strength scores.
```

#### Post-Workout Summary

After the user completes a workout, the next time they open the app or start a conversation:

"Great session yesterday. Quick notes:"

- "Bench Press: 73 avg (up from 69 — **new PR**)"
- "Rows: flat at 58 for the 3rd session — might want to rotate next week"
- "Lateral Raises: jumped from 12 to 15 — nice improvement"

Keep it concise. 3-5 exercises worth of notes, focused on what's notable (PRs, plateaus, regressions). Don't recap every single exercise — just the ones with a story.

#### PR Celebrations

When a user hits a personal record on any tracked exercise:

"**New PR on Romanian Deadlift** — 115 lbs avg per rep, up from 108. That's a 6.5% jump."

PRs should feel earned. Include the context (what the previous best was, how much improvement) so it doesn't feel like empty praise.

#### Plateau Detection and Intervention

After 3+ sessions where a tracked exercise hasn't progressed in weight OR reps:

"Your Overhead Press has been at 54 avg for 4 sessions. That's a plateau. Three options:"

1. "**Drop reps, add weight** — go to 4x8 at 58 lbs. Heavier stimulus."
2. "**Add volume** — add a 5th set at current weight. More work at the same load."
3. "**Rotate the exercise** — swap to Arnold Press for 4 weeks, then come back to OHP."

"What sounds right? Or want me to pick?"

The AI asks before acting on plateaus. It doesn't silently change the program. The user should feel informed and in control.

#### Regression Handling

If a user's performance drops significantly (>10% below recent average):

"Bench was down from 69 to 61 yesterday. Off day or something bothering you?"

- If user says bad day: "Happens to everyone. I'll keep your target at 69 next week."
- If user mentions pain/fatigue: "Got it. I'll pull back intensity for the next session and see how you feel."

No shame. No "you underperformed." Just curiosity and adaptation.

### What the AI Tracks Per Exercise

For every exercise a user performs on Tonal:

- Average weight per rep (Tonal's primary metric)
- Total reps completed
- Total sets completed
- Total volume (weight x reps)
- Personal record (highest avg weight at a given rep count)
- Trend direction (improving / plateaued / regressing) over the last 4 sessions
- Date of last performance

This data is used to generate targets for future sessions and to detect plateaus and PRs.

### Edge Cases

| Situation                                                      | How the AI handles it                                                                                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User's first week — no history                                 | Set baseline weights from Tonal strength scores and conservative estimates. "First time programming this exercise for you — I'm starting moderate. After this session, I'll have real data to work with." |
| User did a different variation (Flat Bench vs. Incline Bench)  | Track each variation independently. Don't compare Flat Bench to Incline Bench. They're different exercises with different performance profiles.                                                           |
| User regressed significantly                                   | Don't celebrate, don't shame. Inquire: "Bench was down from 69 to 61. Off day or something going on?" Adjust future targets based on what the user says.                                                  |
| Partial workout completion (user stopped early)                | Only track completed exercises. Don't count a 2-set performance as the baseline for a 4-set exercise.                                                                                                     |
| User overrides AI's weight recommendation                      | Respect it. Track what they actually did. Adjust future targets based on actual performance, not what the AI suggested.                                                                                   |
| User does the same exercise in multiple sessions the same week | Track each session independently. Weekly volume is the sum.                                                                                                                                               |
| Exercise removed from Tonal's catalog                          | Historical data preserved. Exercise marked as "no longer available." AI suggests replacement if it was a programmed movement.                                                                             |
| Very long plateau (8+ sessions)                                | More assertive intervention: "This has been flat for 2 months. At this point, I'd strongly recommend switching to [alternative]. The stimulus isn't working. Want to try something new?"                  |

### Acceptance Criteria

- [ ] Every exercise in a programmed workout includes a reference to the user's last performance on that exercise (if available)
- [ ] Weight/rep targets are specific numbers, not vague suggestions ("target 72 lbs" not "try to increase")
- [ ] PRs are detected automatically when a workout is completed
- [ ] PRs are celebrated in the next conversation with specific context (what improved, by how much)
- [ ] Plateaus are detected after 3+ sessions of flat performance
- [ ] Plateau interventions present 2-3 concrete options (not just a diagnosis)
- [ ] The AI asks before acting on plateau detection — doesn't silently change the program
- [ ] Progression tracking is per-exercise, per-variation (Flat Bench and Incline Bench tracked separately)
- [ ] Regressions are handled with curiosity, not judgment

### Success Metrics

| Metric                                   | Target                                               | How to measure                                      |
| ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Progression hit rate                     | >50% of exercises meet or exceed AI's target         | Compare target weight to actual weight per exercise |
| PR frequency                             | Track (no target yet)                                | PRs per user per month — establishes baseline       |
| Plateau intervention acceptance          | >40% of plateaus lead to user accepting a suggestion | Count interventions offered vs. accepted            |
| Average monthly progression per exercise | Track (no target yet)                                | Weight increase per exercise per month across users |

---

## 5. Feature Brief: Workout Verification

### Why This Feature

If weekly programming is the product, trust in the push is the foundation. A user who programs their week and walks up to their Tonal to find nothing — or the wrong workout — will never trust the product again. Silent push failures are a trust-destroying event.

Every push must be verified. The user must always know whether their workout made it.

### User Stories

| #   | As a... | I want to...                                            | So that...                                              |
| --- | ------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 1   | User    | to know my workout actually made it to my Tonal         | I don't walk up to my Tonal and find nothing            |
| 2   | User    | a clear error message if something goes wrong           | I'm not confused about the state of my workouts         |
| 3   | User    | the AI to fix push failures automatically when possible | I don't have to troubleshoot                            |
| 4   | User    | a fallback if the push completely fails                 | I can still do my workout even if the push doesn't work |

### Detailed UX Flows

#### Flow A: Successful Push (Happy Path)

1. AI pushes workout to Tonal
2. AI reads back the created workout from Tonal to verify contents
3. Verification confirms: correct exercises, correct order, correct sets/reps
4. AI confirms to user: "Push Day is on your Tonal. 6 exercises, ~45 minutes."

The verification is invisible to the user. They just see the confirmation. No "verifying..." state unless it takes more than 3 seconds.

#### Flow B: Partial Failure (Some Exercises Didn't Make It)

1. AI pushes workout
2. Read-back reveals missing exercises or wrong configuration
3. AI retries automatically (once)
4. If retry succeeds: "Push Day is on your Tonal. 6 exercises, ~45 minutes." (user never knows there was an issue)
5. If retry fails: "The workout pushed but [exercise names] didn't make it. The other 4 exercises are on your Tonal. Here are the missing ones so you can add them manually:" [shows exercise details]

#### Flow C: Complete Push Failure

1. AI pushes workout
2. Push fails entirely (API error, timeout, etc.)
3. AI retries automatically (once)
4. If retry succeeds: normal confirmation
5. If retry fails: "Couldn't push to your Tonal right now. This usually means the connection needs refreshing. Want to reconnect? In the meantime, here's your workout:" [shows full workout as a card with all exercises, sets, reps, target weights so the user can build it manually]

#### Flow D: Full-Week Push (Multiple Workouts)

When pushing a full week (3-5 workouts):

1. AI pushes all workouts
2. Verifies each independently
3. Reports per-workout status:
   - All succeed: "All 3 sessions are on your Tonal. Monday: Push, Wednesday: Pull, Friday: Legs."
   - Partial: "Monday and Wednesday are on your Tonal. Friday had an issue — retrying... Fixed. All 3 are ready."
   - Multiple failures: "Monday is on your Tonal. Wednesday and Friday had issues. I'll keep trying, but here are those workouts in case you want to build them:" [shows workout cards]

#### Flow E: Auth Token Expired

1. AI attempts to push
2. Tonal returns authentication error
3. AI: "Your Tonal connection expired — this happens periodically. Reconnect your account and I'll push the workouts right away. Your plan is saved."
4. User reconnects → AI automatically pushes the pending workouts

### Edge Cases

| Situation                                                      | How the AI handles it                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Tonal API is completely down                                   | "Tonal's servers seem to be having issues right now. I'll try again in a bit. Here's your workout to reference:" [workout card] |
| Push succeeds but exercise IDs changed (Tonal updated catalog) | Detect mismatch between intended and actual exercises. Alert user and offer to re-push with corrected IDs.                      |
| Network timeout during push                                    | Retry once. If still failing, show workout card and offer to retry later.                                                       |
| User has no internet                                           | "Can't reach Tonal right now. Your plan is saved — I'll push it as soon as you're back online."                                 |
| Push succeeds but with wrong sets/reps                         | Detect via read-back. Delete and re-push with correct configuration.                                                            |

### Acceptance Criteria

- [ ] Every push is verified via read-back within 5 seconds of the push completing
- [ ] Failed pushes are retried once automatically before alerting the user
- [ ] Users always know the state of their workout — pushed successfully, partially pushed, or failed
- [ ] Failed pushes always provide the workout content as a fallback (card with exercises, sets, reps, weights)
- [ ] Multi-workout pushes report per-workout status
- [ ] Auth token expiration is detected and communicated clearly with a re-connect path

### Success Metrics

| Metric                      | Target                                   | How to measure                                           |
| --------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| Push success rate           | >95% on first attempt                    | Successful pushes / total push attempts                  |
| Push + verification latency | <5 seconds                               | Time from push initiation to confirmed verification      |
| Auto-retry success rate     | >80% of first-attempt failures recovered | Successful retries / retry attempts                      |
| Fallback workout usage      | Track (no target)                        | % of push failures where user completes workout manually |

---

## 6. Feature Brief: Missed Session Detection

### Why This Feature

This is the feature that separates an app from a coach. No AI fitness product does proactive outreach today — only human coaches at $99-199/month. When the AI notices you skipped and offers to adjust your week, that's the moment it stops being software and starts being a coach.

For the Reddit launch, this is the retention hook. Weekly programming gets users in. Missed session detection keeps them from silently churning.

### User Stories

| #   | As a...                            | I want to...                                    | So that...                                         |
| --- | ---------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| 1   | User with a programmed week        | the AI to notice when I miss a session          | someone is tracking my training besides me         |
| 2   | User                               | the AI to offer to adjust my week, not guilt me | I feel supported, not judged                       |
| 3   | User                               | the AI to adapt my plan automatically           | the rest of my week still makes sense after a miss |
| 4   | User who consistently misses a day | the AI to suggest a different schedule          | my plan matches my real life                       |

### The Tone — What the AI NEVER Says

This matters enough to call out explicitly. The wrong tone is a churn event.

**Never say:**

- "You missed your session yesterday." (guilt framing — states a negative fact about the user)
- "You're falling behind on your program." (judgment — implies failure)
- "You've only trained once this week." (scorekeeping — tracks their shortcomings)
- "Don't forget your session today!" (nagging — unsolicited pressure)
- "You need to be more consistent." (lecturing — tells them what they already know)

**Always say:**

- "Ready to get back to it? Here's an updated plan." (forward-looking, assumes the best)
- "Life happens. Let me adjust the week." (normalizes the miss, focuses on the solution)
- "Fridays seem tough for training — want to try a different day?" (pattern recognition without judgment)
- "Welcome back. I've got a plan to ease you back in." (warmth after absence)

The principle: **the AI is always looking forward, never looking back with judgment.** State facts if useful ("Pull Day was programmed for yesterday"), then immediately pivot to what's next.

### Detailed UX Flows

#### Flow A: Single Missed Session — User Opens App

**Trigger:** User opens the app on Day N. A session was programmed for Day N-1 and no matching workout appears in their Tonal history.

**AI:** "Pull Day was programmed for yesterday but I don't see it in your history. No worries — want me to shift the week? I can move Pull to today and Legs to Friday."

**User options:**

- "Yeah, shift it" → AI reprograms remaining days and pushes updates to Tonal. "Done. Pull is today, Legs moved to Friday. Updated your Tonal."
- "Skip it entirely" → AI adjusts remaining sessions to compensate for missed volume. "Got it. I've added a few extra back sets to your remaining sessions to keep volume up."
- "I actually did train, just not what you programmed" → AI asks what they did and adjusts accordingly. "What did you do? I'll factor it into the rest of the week."
- User doesn't respond → AI doesn't follow up again. One acknowledgment is enough.

#### Flow B: Multiple Missed Sessions — User Returns After 3+ Days

**Trigger:** User opens the app with 2+ programmed sessions missed and 3+ days since last visit.

**AI:** "Hey — looks like the week didn't go as planned. You hit Push on Monday but missed the other two. That happens. Want me to program a fresh week starting today?"

- No retrospective guilt
- No "you missed 2 sessions"
- Frame it as the week not going as planned (external attribution), not the user failing (internal attribution)
- Offer a fresh start, not a catch-up plan

**User options:**

- "Yeah, fresh week" → Weekly programming flow
- "I'm taking a break" → "Got it. Message me when you're ready and I'll program a ramp-up week to ease you back in."
- "I was sick" → "Take care of yourself. When you're feeling better, I'll start you with a lighter week."

#### Flow C: Pattern Detection — Consistent Misses on Same Day

**Trigger:** After 3+ weeks where the same day's session is consistently missed.

**AI:** "I've noticed Fridays haven't been working for training — you've missed the last 3 Friday sessions. Totally normal, Fridays are hard. Want to switch to a different day? I could move your third session to Saturday, or we could go to a 2-day plan."

- Normalize the pattern — don't frame it as a problem the user has
- Offer concrete alternatives — a different day, or fewer days
- This only fires after 3+ weeks of the same pattern to avoid false positives

#### Flow D: Extended Absence (7+ Days No Activity)

**Trigger:** User returns after 7+ days of no Tonal activity and no app engagement.

**AI:** "Welcome back! It's been [X] days. No pressure — I've got a ramp-up week ready. Lighter weights, same exercises, focuses on getting back in the groove. Want me to send it to your Tonal?"

- Warm, not judgmental
- Ramp-up plan at ~70% of their previous volume and intensity
- Don't ask why they were gone unless they volunteer it

#### Flow E: User Did a Different Workout Than Programmed

**Trigger:** AI detects the user completed a workout on Tonal, but it wasn't the one the AI programmed (user did a coach-led program, a freestyle workout, or a custom workout they built themselves).

**AI:** "I see you did a Full Body workout yesterday instead of the Pull Day I had programmed. Want me to adjust the rest of the week around what you actually did? I'll make sure we're not doubling up on any muscle groups."

- Acknowledge they trained — that's the important thing
- Don't be possessive about the AI's programming
- Adapt the rest of the week to what actually happened

### Edge Cases

| Situation                                                             | How the AI handles it                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User is on vacation (told the AI)                                     | AI backs off completely. "Enjoy the trip. Message me when you're back and I'll have a plan ready." No check-ins during the break.                                                                                                                         |
| User is sick (told the AI)                                            | "Focus on getting better. When you're ready, I'll ease you back in with a lighter week. No rush."                                                                                                                                                         |
| Multiple users on same Tonal                                          | Only track sessions attributed to this specific user's Tonal profile. Don't confuse household members' workouts.                                                                                                                                          |
| User ignores the missed session message                               | AI does NOT follow up. One message. If the user doesn't respond, the AI waits until the user initiates next. Anti-nag principle.                                                                                                                          |
| User misses every session for 2+ weeks                                | After 2 weeks of complete inactivity with no response, the AI stops checking and waits for the user to come back. No escalating messages. The last message should be: "Whenever you're ready, I'm here. Just say the word and I'll program a fresh week." |
| Programmed session is for "today" and it's still morning              | Don't flag as missed until the next day. The user hasn't missed it yet — the day isn't over.                                                                                                                                                              |
| Session was programmed but user had a rest day override from calendar | Don't flag as missed. Calendar integration already indicated this is a rest day.                                                                                                                                                                          |

### Acceptance Criteria

- [ ] Missed sessions are detected within 24 hours of the scheduled day passing
- [ ] AI proactively addresses missed sessions the next time the user opens the app
- [ ] Tone is always forward-looking — no guilt, no scorekeeping, no nagging
- [ ] AI offers concrete replanning options (shift the week, skip and adjust, fresh week)
- [ ] Modified plans are pushed to Tonal after user approval
- [ ] Pattern detection fires after 3+ weeks of consistent misses on the same day
- [ ] If user ignores a missed-session message, the AI does NOT follow up with another
- [ ] Extended absences (7+ days) get a warm welcome-back with a ramp-up plan
- [ ] User-reported context (vacation, sick, break) causes AI to back off

### Success Metrics

| Metric                 | Target                                                               | How to measure                                                                                              |
| ---------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Replan acceptance rate | >50% of missed sessions result in accepted replan                    | Missed session messages → user accepts replan                                                               |
| Post-replan completion | >70% of users complete at least one session after accepting a replan | Track workout completion within 48 hours of replan                                                          |
| Retention impact       | Positive delta vs. non-detected                                      | Compare 30-day retention of users with missed session detection vs. those without (once sample size allows) |
| Anti-nag compliance    | 0 follow-ups after ignored messages                                  | Audit AI behavior — no second message if first is ignored                                                   |

---

## 7. Release Plan

### Milestone Sequence

The features have dependencies. Build in this order:

```
Milestone 1: Core Loop
  └── Weekly Programming + Workout Verification
       "User can program a full week and trust it made it to Tonal"

Milestone 2: Intelligence
  └── Progressive Overload Tracking
       "Programmed workouts reference past performance with specific targets"

Milestone 3: First Experience
  └── Activation Flow
       "New users get the holy shit moment within 5 minutes"

Milestone 4: Retention Hook
  └── Missed Session Detection
       "The AI notices when you skip and adapts the plan"
```

### Why This Order

**Milestone 1 first** because everything depends on weekly programming. Overload tracking needs programmed workouts to attach targets to. Activation flow leads into weekly programming. Missed session detection needs programmed sessions to detect misses against. Workout verification is bundled with weekly programming because pushing without verifying is worse than not pushing.

**Milestone 2 second** because it makes Milestone 1 intelligent. Without overload tracking, weekly programming generates reasonable but generic workouts. With it, every exercise has a specific, personalized target. This is the difference between "the AI gives me workouts" and "the AI knows my training."

**Milestone 3 third** because the activation flow should lead into a fully realized product. If a new user hits the activation flow before weekly programming and overload tracking are solid, the "holy shit moment" falls flat. Better to nail the core product first, then optimize the first impression.

**Milestone 4 last** because it's the retention layer. It matters enormously for long-term retention but doesn't affect the demo video or the first-week experience. It can ship shortly after the Reddit post — the first cohort of users won't need it until they've been using the product for a week.

### Milestone Details

#### Milestone 1: Core Loop

**What ships:** Weekly programming + workout verification

**"Done" when:**

- [ ] User can say "program my week" and get a full week's plan
- [ ] Plan shows exercises, sets, reps, and target weights for each day
- [ ] User can approve, modify (swap exercises, move days, adjust duration), or reject
- [ ] All workouts push to Tonal in one flow
- [ ] Every push is verified via read-back
- [ ] Push failures are retried automatically and communicated clearly
- [ ] Returning users can say "program next week" without re-entering preferences

**Exit criteria to move to Milestone 2:**

- [ ] 3 complete weeks have been programmed and pushed successfully (dogfooding)
- [ ] No silent push failures observed

#### Milestone 2: Intelligence

**What ships:** Progressive overload tracking

**"Done" when:**

- [ ] Every programmed exercise includes a reference to last session's performance
- [ ] Weight/rep targets are specific numbers based on past data
- [ ] PRs are detected and celebrated
- [ ] Plateaus are detected after 3+ flat sessions and options presented
- [ ] Post-workout summaries highlight notable performance (PRs, plateaus, regressions)

**Exit criteria to move to Milestone 3:**

- [ ] Programmed a week where every exercise had a specific target with historical context
- [ ] At least one PR was detected and surfaced correctly
- [ ] Progression targets felt reasonable (not too aggressive, not too conservative)

#### Milestone 3: First Experience

**What ships:** Activation flow (data-rich, cold start, brand new Tonal)

**"Done" when:**

- [ ] New data-rich user sees a personalized insight within 60 seconds
- [ ] Cold start user gets guided onboarding → first programmed week
- [ ] Loading state communicates progress at every stage
- [ ] AI leads with value — user never faces a blank chat box
- [ ] Under 5 minutes from Tonal connection to first week on Tonal
- [ ] Demo video can be recorded showing the full happy-path flow

**Exit criteria to move to Milestone 4:**

- [ ] 3 real users (not Jeff) have completed the activation flow end-to-end
- [ ] Demo video recorded and reviewed

#### Milestone 4: Retention Hook

**What ships:** Missed session detection

**"Done" when:**

- [ ] Missed sessions detected within 24 hours
- [ ] AI proactively addresses misses when user opens app
- [ ] Replanning options offered (shift week, skip and adjust, fresh week)
- [ ] Pattern detection works after 3+ weeks of same-day misses
- [ ] Tone is forward-looking — no guilt, no nag, no follow-up if ignored
- [ ] Extended absence (7+ days) gets warm welcome-back with ramp-up plan

**Exit criteria for Reddit post:**

- [ ] All Milestone 1-4 "done" criteria met
- [ ] All go/no-go criteria from Section 1 met
- [ ] Demo video final and approved
- [ ] Landing page updated to reflect weekly programming

---

## 8. Reddit Launch Checklist

### Before Writing the Post

- [ ] All 4 milestones complete and verified
- [ ] Demo video recorded showing: connect → insight → program week → all sessions on Tonal → complete a session → AI references it next week
- [ ] Video is 60-90 seconds
- [ ] 3+ real users have completed the full flow (activation → weekly programming → at least one completed workout)
- [ ] Landing page (tonal.coach) updated to lead with weekly programming
- [ ] Sign-up flow is smooth on mobile (Reddit users will be on phones)
- [ ] Privacy/security messaging is clear and visible (users will ask about credential safety)

### The Post Itself

**Target subreddit:** r/tonal (~11K members)

**Post structure:**

1. Hook: what this does in one sentence ("I built an AI coach that programs your entire training week and pushes every session straight to your Tonal")
2. Demo video (the hero)
3. What it does (3-4 bullet points, no jargon)
4. How it works (connect Tonal → AI programs → workouts appear)
5. Security/privacy disclosure (password handling, encryption)
6. Free to try (with link)
7. "I built this because..." — Jeff's personal story with Tonal

**What NOT to include:**

- Price (let them try it first)
- Feature comparison charts (feels aggressive)
- Anything that sounds like an ad (the Tonal subreddit will downvote ads)

### After Posting

- [ ] Monitor comments and respond quickly (first 2 hours are critical for Reddit algorithm)
- [ ] Have answers ready for predictable questions:
  - "Is my password safe?" → explain the auth flow
  - "What AI model does this use?" → transparent answer
  - "Why should I use this over Daily Lift?" → between-workout intelligence
  - "Are you affiliated with Tonal?" → no, independent
  - "How much does it cost?" → free tier available, Pro at $14.99/mo
- [ ] Track activation metric from first day: Tonal connections → workouts completed within 72 hours
- [ ] Do NOT cross-post to other subreddits on the same day (looks spammy)

### Secondary Distribution (Week 2+)

- [ ] Tonal Community Facebook group (~50K members) — same demo video, different framing
- [ ] Tonal Custom Workout Share Facebook group — share an AI-generated workout with explanation
- [ ] LinkedIn — "I built an AI trainer in [timeframe]" developer story angle
- [ ] Hacker News (if the story is compelling) — "Show HN" with the reverse-engineering angle
- [ ] YouTube Tonal creators — offer early access for honest reviews

---

_This document is the decision-making reference for what ships before the Reddit launch. Features not listed here are explicitly deferred. If a question comes up about whether to build something, check it against this plan first._
