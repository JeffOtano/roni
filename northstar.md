# tonal.coach — Vision PRD: The Ideal End State

**Version:** 3.0 — North Star
**Author:** Jeff Otano
**Date:** March 13, 2026
**Domain:** tonal.coach
**Status:** Vision / Long-term roadmap

---

## 1. Vision

tonal.coach is a full-stack AI personal trainer. It starts with Tonal as its first and best integration — automatic data capture, conversational coaching, and workouts pushed directly to the machine. But the coaching intelligence is hardware-agnostic. Tonal is the beachhead, not the ceiling.

The long-term product is an AI that maintains a persistent, comprehensive model of a person's fitness — training history, body composition, nutrition, recovery, schedule — and uses it to make intelligent coaching decisions. The kind of coaching that costs $400/month from a human, available to anyone for $15.

**One-liner:** AI coach that programs your training week and adapts when life happens.

---

## 2. The Core Insight

A personal trainer does five things well:

1. **Remembers everything** about your training history and uses it to make decisions
2. **Programs intelligently** — periodization, progressive overload, weak point identification, injury management
3. **Holds you accountable** — notices when you skip, calls you out, keeps you on track
4. **Sees your body changing** — tracks visual progress, connects it to what you're doing in the gym
5. **Manages the whole picture** — knows your schedule, your nutrition, your stress, your sleep, and factors it all in

No single product does all five well. Tonal auto-captures data (#1) but doesn't reason about it conversationally. JuggernautAI does smart periodized programming (#2) but requires manual logging and has no hardware integration. Future pairs human coaches with Apple Watch data (#3, #5) but costs $149/month. Trainwell powers Peloton's coaching with human trainers at $100/month. Nobody connects all five into a single AI system with automatic data capture and hardware write access.

tonal.coach's specific advantage: it's the only product that combines conversational AI coaching with automatic data capture AND the ability to push workouts directly to the user's machine. That combination doesn't exist anywhere else.

---

## 3. Who This Is For

### 3.1 Primary: The Lost Tonal Owner (Beginner)

The biggest opportunity isn't the power user — it's the person who bought a Tonal and doesn't know what to do with it.

They spent $4,000+. They did the onboarding program. They tried a few coach-led workouts. Now they're 3 months in and doing the same Full Body workout every week because they don't understand programming. They don't know what progressive overload means. They don't know what a PPL split is. They just know they spent a lot of money and aren't seeing results.

**What tonal.coach does for them:** "I just got my Tonal and I don't know what to do." → The AI asks a few questions (goals, available days, experience level), generates a 4-week beginner program, pushes the first week's workouts to their Tonal, and checks in after each session. No jargon. No decision fatigue. Just "go do this, then tell me how it went."

This user doesn't need periodization theory or bodybuilding symmetry analysis. They need a patient, knowledgeable coach who removes the friction between "I want to work out" and "I know exactly what to do today."

### 3.2 Secondary: The Frustrated Custom Builder (Intermediate)

Tonal owner, 6-18 months in, builds their own workouts because programs feel generic. Knows exercise basics but struggles with programming — how much volume, which muscles on which days, when to increase weight. Spends 15 minutes before each session in the custom workout builder.

**What tonal.coach does for them:** Replaces that 15 minutes with a 30-second conversation. AI handles programming, progressive overload, and training balance. This user gets the coaching assessment, the data-driven callouts, and the push-to-Tonal experience.

### 3.3 Tertiary: The Serious Lifter (Advanced)

Bodybuilder, powerlifter, or athlete who uses Tonal as part of a broader training program. They want sophisticated periodization, mode-specific coaching, and integration with off-Tonal training.

**What tonal.coach does for them:** Training modes (hypertrophy, strength, athletic) with specialized coaching logic. For powerlifters, Tonal handles accessories while main lifts are tracked via manual logging. For bodybuilders, the AI manages volume per muscle group and uses progress photos to identify lagging body parts.

This user is the smallest segment but the most vocal — they'll be the ones posting about the product in communities and providing the most detailed feedback.

### 3.4 Anti-target

Users who love Tonal's coach-led video workouts and have no interest in custom programming. They want to press play and follow along, not think about their training. That's fine — Tonal's existing experience serves them well.

---

## 4. Risks

### 4.1 Platform Dependency

The entire MVP depends on a reverse-engineered API. Tonal can change endpoints, add auth barriers, or block third-party access at any time.

**Mitigation:** Build the coaching intelligence as a hardware-agnostic layer. Tonal integration is a plugin. If locked out, we lose push-to-machine but retain the coaching AI, analytics, and user relationships. Accelerate multi-device support so no single dependency is fatal.

### 4.2 Tonal's Financial Health

Tonal has had layoffs, restructuring, and viability questions. If Tonal goes under, the installed base stops growing.

**Mitigation:** Hardware-agnostic coaching. Tonal's installed base would still need coaching for years without corporate support. Their death accelerates the pivot to general-purpose AI coaching.

### 4.3 Tonal Builds This Internally

Tonal has every advantage: the data, the platform, the users, the API. Daily Lift (algorithmic workout generation) is a first step.

**Mitigation:** Speed and community. If Tonal builds this, the best outcome is acquisition/hire. The most likely outcome — they ship something worse — is where we win.

### 4.4 TAM Ceiling

Tonal has ~200-300K units sold. Addressable market at launch is realistically 1,000-3,000 users.

**Mitigation:** Multi-device expansion is the priority path to a real business. Tonal is the proof-of-concept market.

### 4.5 Credential Trust

Asking users to enter Tonal credentials into a third-party app is a significant trust barrier.

**Mitigation:** Password never stored — used only to obtain token. Token encrypted at rest (AES-256-GCM). Open-source MCP server for code verification. Long-term: pursue OAuth or official API partnership.

### 4.6 AI Training Advice Liability

AI-programmed workouts that lead to injury create legal exposure.

**Mitigation:** Disclaimers, coaching guardrails (never program through pain), server-side movement ID validation, no medical claims, ToS with liability limitation.

---

## 5. Privacy & Trust

This section exists because the product asks users to share some of the most personal data imaginable: their body, their diet, their health metrics, their physical vulnerabilities, and their training insecurities. "Encrypted storage" is a feature note, not a trust strategy. This is the trust strategy.

### 5.1 What We Collect and Why

| Data type                      | Why we need it                                                                 | How it's stored                                                                                 | User control                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tonal auth token               | Access training data, push workouts                                            | Encrypted at rest (AES-256-GCM), server-side only, never exposed to client                      | User can disconnect anytime; token deleted immediately                                             |
| Tonal password                 | One-time use to obtain auth token                                              | Never stored. Used in memory for token exchange, then discarded.                                | N/A — never persisted                                                                              |
| Training history               | Core coaching data — exercise selection, volume, progressive overload          | Cached from Tonal API, refreshed periodically                                                   | Deletes when user disconnects Tonal                                                                |
| Conversation history           | Coaching continuity — the AI remembers past discussions, injuries, preferences | Stored in database, associated with user account                                                | User can delete individual conversations or all history                                            |
| Progress photos                | Visual progress tracking, body composition analysis                            | Encrypted at rest, stored in isolated storage bucket, accessible only by the authenticated user | User can delete individual photos or all photos at any time. Photos never used for model training. |
| Meal photos / nutrition data   | Directional nutrition coaching (protein intake)                                | Same encrypted storage as progress photos                                                       | Same deletion controls                                                                             |
| Calendar data                  | Schedule-aware programming (avoid conflicts)                                   | Cached from Google Calendar API, refreshed per session                                          | User can disconnect calendar integration anytime                                                   |
| Wearable data (HRV, sleep, HR) | Recovery-informed programming adjustments                                      | Cached from wearable API, refreshed periodically                                                | User can disconnect wearable anytime                                                               |

### 5.2 What We Never Do

- **Never sell or share user data** with third parties, advertisers, or data brokers
- **Never use photos, conversations, or training data to train AI models.** User data stays in the product, period.
- **Never store Tonal passwords.** Only the resulting auth token, encrypted.
- **Never access data beyond what's needed for coaching.** We don't scrape social profiles, contacts, or anything outside the explicitly connected services.
- **Never retain data after account deletion.** Full deletion within 30 days, with immediate removal of photos and auth tokens.

### 5.3 What Happens If tonal.coach Shuts Down

- All user data deleted within 30 days of shutdown announcement
- Users notified with at least 30 days notice
- Data export available (training history, conversation logs) before deletion
- Photos and auth tokens deleted first, within 72 hours of shutdown decision
- Open-source MCP server continues to function independently

### 5.4 GDPR and Data Rights

- **Right to access:** Users can export all their data at any time
- **Right to deletion:** Users can delete their account and all associated data
- **Right to portability:** Training history exportable as JSON/CSV
- **Data processing basis:** Explicit consent at signup, with clear explanation of what's collected and why
- **Data location:** Stored in US-based infrastructure (Convex). Disclosed to EU users at signup.

### 5.5 The Trust Conversation

The first time a user is asked for sensitive data (body photos, meal photos, wearable connection), the app should explain in plain language what happens with that data and give the user a clear opt-out. Not a 10-page privacy policy — a 3-sentence explanation on the screen where the action happens.

Example for progress photos: "Your photos are encrypted and stored privately. Only you and your AI coach can see them. They are never used to train AI models. You can delete them anytime."

---

## 6. Theory of Behavior Change

The doc previously described what the AI says without explaining why people stick with training or why they quit. A coaching product needs a theory of behavior change, not just a feature list.

### 6.1 Why People Quit Training

Research and practical experience point to four primary reasons:

**Identity.** They don't see themselves as "someone who works out." Training feels like something they're trying to do, not something they are. When life gets hard, non-identity behaviors are the first to go.

**Friction.** The gap between intention and action is too large. "I should work out" → "but what should I do?" → "let me figure out a program" → "actually I'll just do it tomorrow." Decision fatigue kills more training plans than laziness.

**Social isolation.** Nobody notices if they stop. No one's expecting them. No consequence for missing a session beyond their own guilt, which is a poor motivator.

**Loss of autonomy.** Being told what to do feels controlling. Rigid programs that don't respect how someone feels today create resentment. People who feel they "have to" train eventually rebel against it.

### 6.2 How tonal.coach Addresses Each

**Identity building.** The AI doesn't just track streaks — it narrates the user's transformation into a person who trains. There's a difference between "you hit 3 sessions this week" and "you've trained 3x/week for 6 straight weeks. That's not a streak anymore — that's who you are." The AI reflects back the user's consistency as identity, not just behavior. After enough repetition, the user starts to believe it — because it's true.

**Friction elimination.** This is the core product. The weekly programming engine removes the #1 source of friction: deciding what to do. The user walks up to their Tonal and a personalized session is waiting. No decisions, no builder, no research. "What should I do today?" is answered before they ask it. The activation flow targets under 5 minutes from signup to first workout on Tonal.

**Social presence.** The AI notices. It reaches out when you miss a session. It celebrates milestones. It remembers what you said last week about your knee. For many users, the AI coach will be the only entity in their life that consistently tracks and responds to their training behavior. That presence — even from an AI — creates a sense of being seen. Shared workouts and training partner features add human social connection over time.

**Autonomy support.** The AI proposes, it doesn't dictate. "Here's what I'd recommend today. Want to adjust anything?" The user always has the final say. They can swap exercises, reject a session, change the plan. When the AI detects resistance ("I don't feel like training today"), it doesn't push harder — it adapts. "OK, how about a 20-minute recovery session instead? No pressure." This is self-determination theory in practice: competence (seeing progress), autonomy (choosing how to train), and relatedness (connection to the AI coach).

### 6.3 What the AI Never Does

- **Never guilts.** "You missed 3 sessions this week" is data. "You're falling behind" is guilt. The AI presents data and offers solutions. It never implies the user is failing.
- **Never nags.** If a user ignores a check-in, the AI doesn't send another one the next day. It backs off and waits. Nobody uninstalls an app that helps them — they uninstall apps that annoy them.
- **Never removes agency.** The user can always override, modify, or ignore the AI's recommendations. The AI adjusts its future recommendations based on what the user actually does, not what it told them to do.

---

## 7. The Product: What It Actually Is

The product is not five layers built sequentially. It's a coaching system with parallel capabilities that share a data foundation. Users access the capabilities they want. The build order is driven by retention impact per unit of effort, not a neat diagram.

```
                ┌──────────────────────────────────────────┐
                │          COACHING INTELLIGENCE            │
                │   System prompt · Training modes ·        │
                │   Behavior theory · Personality            │
                └──────────┬───────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────┐
        │                  │                      │
┌───────┴───────┐  ┌───────┴────────┐  ┌──────────┴────────┐
│  PROGRAMMING  │  │ ACCOUNTABILITY │  │   BODY & CONTEXT  │
│               │  │                │  │                   │
│ Weekly plans  │  │ SMS check-ins  │  │ Progress photos   │
│ Multi-week    │  │ Missed session │  │ Nutrition coach   │
│ Periodization │  │ Weekly recaps  │  │ Calendar sync     │
│ Overload      │  │ Milestones     │  │ Wearable data     │
│ Plateau fix   │  │ Re-entry plans │  │ Life context      │
└───────┬───────┘  └───────┬────────┘  └──────────┬────────┘
        │                  │                      │
        └──────────────────┼──────────────────────┘
                           │
                ┌──────────┴───────────────────────────────┐
                │            DATA FOUNDATION                │
                │  Training history · Strength scores ·     │
                │  Muscle readiness · Exercise catalog ·    │
                │  User profile · Conversation history      │
                └──────────┬───────────────────────────────┘
                           │
                ┌──────────┴───────────────────────────────┐
                │          HARDWARE INTEGRATIONS            │
                │  Tonal (shipped) · Speediance · Manual    │
                └──────────────────────────────────────────┘
```

### 7.1 Foundation: Coaching Conversation (Shipped)

Conversational AI coach with full access to training data. User asks questions, gets data-backed answers, requests workouts, receives coaching.

Capabilities: training assessment, single workout programming, real-time adaptation ("my shoulder hurts"), exercise education, data exploration.

Actions: create workout → push to Tonal, delete workout, estimate duration.

### 7.2 The Product: Adaptive Programming Engine

**This is the product. Everything else is setup or amplification.**

The programming engine is what makes tonal.coach a personal trainer and not a chatbot. It's what creates the habit of walking up to your Tonal with a session waiting. It's the retention mechanism, the coaching credibility, and the reason users tell their friends.

#### Single-Week Programming

The AI programs your full week, not just one session.

- User tells the AI their preferred split and available days
- AI generates a full week considering: muscle readiness projections, volume targets for the current phase, progressive overload from last week, exercise variation, session duration constraints
- All workouts pushed to Tonal at once
- User opens Tonal on Tuesday → their Pull Day is waiting

**The user's control surface:**

- "Swap the overhead press for something else" → AI replaces it and explains why the alternative works
- "I don't want to train Friday anymore" → AI redistributes Friday's volume across remaining sessions
- "Make today shorter, I only have 30 minutes" → AI generates a condensed version prioritizing compounds
- "I'm exhausted, give me something easy" → lighter recovery session
- "Skip legs this week" → AI complies but notes the pattern. Doesn't nag — adjusts next week's plan to compensate.

**Adaptive replanning:**

- Missed session → auto-shift remaining days
- Reported pain/injury → reprogram around it, remember for future sessions
- Unusual fatigue → downgrade intensity or insert recovery day
- Schedule change → redistribute volume across new available days

#### Multi-Week Mesocycle Management

The AI doesn't just think about this week. It manages 4-8 week training blocks with structure, purpose, and adaptive transitions.

**Training plan state the AI maintains:**

```
Current Phase: Hypertrophy (Week 3 of 5)
Volume Target: 16-18 sets/muscle group/week
Rep Range: 8-12 main, 12-15 accessories
Overload Strategy: +2-5% weight OR +1 rep per exercise per week
Deload Trigger: End of week 5, or readiness scores < 30 for 2+ weeks
Next Phase: Strength (3 weeks) → Deload (1 week) → Hypertrophy (5 weeks)
```

**The plan adapts based on what actually happens:**

| What happens             | What the AI does                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Progressing well         | Stays the course. "Week 3, volume tracking up, bench weight +4 lbs from week 1."                                   |
| Plateau on 2+ exercises  | Intervenes. "OHP and bench stalled for 3 sessions. Options: rotate variations or transition to strength block."    |
| Fatigue accumulating     | Pulls back. "Readiness scores trending down 2 weeks. Inserting deload — 50% volume, same exercises."               |
| Missed multiple sessions | Replans. "Hit 3 of 4 sessions again. Third week in a row. Should we drop to a 3-day plan? Consistency > ambition." |
| Crushing it              | Progresses. "Hit every target for 3 weeks, scores jumped 12 points. Bumping volume from 16 to 18 sets/group."      |
| Completed block          | Proposes next phase. "5-week hypertrophy complete. Strength block next — heavier, lower reps. Ready?"              |
| Returns after absence    | Offers re-entry. "Welcome back. 10 days off. Ramp-up week at 70% volume before going full send."                   |

**None of this requires the user to ask.** A background cron pulls Tonal data nightly, evaluates the training plan, and proactively adjusts. When the user opens the app, the AI already knows what happened and what's next.

#### Progressive Overload Tracking

Per-exercise tracking across sessions:

- Recommend specific progressions: "Bench Press 4x10 @ 69 avg last time. Push for 72-75 today."
- Detect plateaus: "Barbell Bench flat for 4 sessions. Options: add a 5th set, drop to 8 reps and increase weight, or rotate to Incline for 4 weeks."
- Celebrate PRs: "New PR on RDL — 115 avg per rep, up from 108."

#### Weak Point Identification

Continuous analysis for imbalances:

- Strength score gaps between body regions
- Push/pull volume ratios
- Movement pattern gaps (no single-leg work, no horizontal pull, etc.)
- Muscle group neglect
- Bodybuilding mode: visual lagging parts from progress photos

### 7.3 Accountability

The AI reaches out. This is what separates an app from a coach.

**Proactive check-ins (SMS via Twilio, push, or email):**

| Trigger                  | Message example                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Missed scheduled session | "Pull day was yesterday. Want me to move it to today or adjust the week?"             |
| 3+ day gap               | "4 days since your last session. Quick 30-min full body to get back in?"              |
| Post-workout             | "16,500 lbs volume. Bench was up 3 lbs. Solid session."                               |
| Weekly recap             | "3 sessions, 42K lbs, hit all target areas. Lower body volume up 40% from last week." |
| Milestone                | "Overall score crossed 850. 92nd percentile."                                         |
| Phase transition         | "Hypertrophy block wraps up this week. Strength block programmed for Monday."         |
| Re-entry                 | "Welcome back. Ramp-up session ready — 70% volume to ease in."                        |
| Identity reinforcement   | "6 straight weeks at 3+ sessions. That's not a streak — that's who you are now."      |

**Anti-nag design:**

- If a check-in is ignored, the AI backs off. No follow-up the next day.
- User controls: channel (SMS/push/email/in-app), frequency (every session/daily/weekly/milestones only), quiet hours
- Tone: supportive by default. Never guilt. Present data and offer solutions, not judgment.

**Streak and consistency tracking:**

- Weekly target adherence
- Target area compliance
- Progressive overload streak
- Phase completion
- Monthly consistency score

### 7.4 Body & Nutrition

**Progress photos (not yet built, priority feature):**

- Front/side/back photos every 2-4 weeks
- Camera interface with pose guide overlay for consistency
- Encrypted storage, user-only access
- AI compares across timepoints, correlates with training data
- Mode-specific analysis: bodybuilding mode checks symmetry and lagging parts; general mode tracks overall composition; strength mode focuses on bodyweight trends
- All commentary relative to user's own baseline, never comparative
- Photos never used for model training

**Nutrition coaching (conversational approach):**

- Self-reported via chat: "I had eggs, chicken salad, and steak today"
- AI provides directional coaching: "That's roughly 120g protein. At your weight and volume, aim for 140-175g."
- Track weekly trends, correlate with strength score movement
- NOT calorie counting. NOT a food database. The AI cares about one question: is nutrition supporting training goals?
- Evaluate later: meal photo macro estimation (build vs. integrate with MyFitnessPal/Cronometer API)

### 7.5 Lifestyle Integration (Lower Priority)

Build only after Programming + Accountability + Body are proven.

- **Calendar sync:** training sessions on calendar, AI avoids conflicts, travel-aware scheduling
- **Wearable data:** HRV, sleep, resting HR → recovery-informed intensity adjustments
- **Life context:** schedule patterns, injury history, goal evolution, stress signals

---

## 8. Training Modes

Not every lifter wants the same thing. Training modes shape every decision the AI makes — exercise selection, rep ranges, volume targets, how it reads data, and what it prioritizes.

Selected at onboarding. Can switch anytime.

### 8.1 General Fitness (Default)

For the typical Tonal user who wants to get stronger, look better, stay consistent. Probably 70%+ of users, including most beginners.

- Balanced programming, compound-first
- 12-16 sets per muscle group per week
- 8-12 rep range, 12-15 for accessories
- Progressive overload per exercise
- Deloads every 5-6 weeks or when fatigue accumulates
- AI prioritizes: consistency, balanced strength scores, volume distribution

### 8.2 Hypertrophy / Bodybuilding

For users who care about muscle size, proportions, symmetry, and aesthetics.

- High volume: 16-22+ sets per muscle group per week
- Rep ranges: 8-15 main, 15-20 isolation
- Exercise selection emphasizes angles — incline for upper chest, close-grip for long head triceps
- Supersets and drop sets for metabolic stress
- Eccentric mode used intentionally
- Exercise rotation across the week for multi-angle stimulus
- AI prioritizes: volume per muscle group, lagging parts (from strength scores AND photos), exercise variety
- Progress photos become a programming input: "Side delts underdeveloped vs. front delts. Adding lateral raise volume."
- Tonal's constant tension cables are arguably better than free weights for hypertrophy work

### 8.3 Strength / Powerlifting

For users focused on raw strength. May compete in powerlifting.

- Lower volume, higher intensity: 1-6 reps main lifts, 6-10 accessories
- Percentage-based programming off estimated 1RMs
- RPE/RIR tracking for autoregulation
- Tonal used primarily for accessories (rows, tricep work, lat pulldowns, hamstring curls)
- Main lifts programmed off-Tonal with manual logging (Tonal's 200lb limit constrains advanced main lifts)
- Peaking cycles for competition prep
- AI prioritizes: estimated 1RM progression, accessory work addressing weak points in main lifts, fatigue management

### 8.4 Athletic Performance

For users training for a sport — football, basketball, tennis, martial arts, etc.

- Power development, moderate weight, explosive intent
- Unilateral work for sport carryover
- Core and rotational emphasis
- Movement patterns over muscle groups
- In-season vs. off-season periodization
- Sport-specific injury prevention

### 8.5 Rehab / Conservative

For users recovering from injury or focused on functional strength.

- Conservative weight progression
- Full ROM, controlled tempos
- PT-prescribed exercise integration
- Pain monitoring
- Asymmetry detection and correction
- Smart Flex mode for accommodating resistance

---

## 9. Competitive Landscape

### 9.1 Direct Competitors

| Product                                         | What it does well                                                                                                             | What it lacks                                                                                                                    | Price                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **JuggernautAI**                                | Excellent periodized programming for powerlifting/bodybuilding. Large community. AI adapts based on reported RPE/performance. | Requires manual logging. No hardware integration. No conversational coaching — it's a program, not a coach. No push-to-machine.  | $15-35/mo              |
| **Dr. Muscle**                                  | AI progressive overload tracking. Been doing this for years. Auto-adjusts weight based on performance.                        | Basic UI. No conversational interface. No hardware integration. Limited programming sophistication vs. JuggernautAI.             | $10/mo                 |
| **Fitbod**                                      | Decent algorithmic workout generation. Large exercise library. Apple Watch integration.                                       | Requires manual logging. No conversational coaching. Programming is formulaic, not adaptive. No hardware push.                   | $13/mo                 |
| **Future**                                      | Real human coaching + Apple Watch data. Trainer texts you, adjusts programs based on wearable data.                           | $149/month. Async communication. No hardware integration. Human trainer quality varies.                                          | $149/mo                |
| **Trainwell (powers Peloton Personal Trainer)** | Human coaching at scale. Platform connects trainers with clients. AI assists with data synthesis.                             | $100/month for Peloton version. Only integrates with Peloton hardware.                                                           | $99-149/mo             |
| **Tonal Daily Lift**                            | Native Tonal integration. Uses muscle readiness and recent training to generate daily workouts. Smart recommendations.        | Non-conversational — you can't ask it questions. No multi-week planning. No coaching personality. Can't tell it your knee hurts. | Included in $60/mo sub |
| **Tonal programs**                              | Coach-led, structured multi-week programs. Professional programming.                                                          | Generic — not personalized to your specific data. Can't adapt to injuries, schedule changes, or individual weaknesses.           | Included in $60/mo sub |

### 9.2 What Specifically Makes tonal.coach Different

1. **Automatic data capture + conversational coaching.** JuggernautAI has great programming but requires manual logging. Tonal has automatic data capture but no conversational interface. tonal.coach is the only product with both — the AI knows every weight you lifted without you entering anything, AND you can talk to it about your training.

2. **Hardware write access.** No other third-party product can push workouts directly to a Tonal. The user walks up and their session is waiting. This is the magical experience that no competitor can replicate without hardware integration.

3. **Adaptive multi-week programming with proactive adjustment.** JuggernautAI programs in blocks but adjusts based on user-reported RPE after each session. tonal.coach adjusts based on objective data (actual weights lifted, muscle readiness scores, strength score trends) without the user reporting anything. The AI detects plateaus and fatigue from the data itself.

4. **Full-spectrum coaching.** JuggernautAI is programming only. Future is coaching only. Fitbod is workout generation only. tonal.coach combines programming + coaching + accountability + body tracking in one AI system with shared context. The AI that programs your workout is the same AI that notices you skipped legs for 3 months and the same AI that sees your progress photos.

### 9.3 Where Competitors Beat Us (Be Honest)

- **JuggernautAI** has deeper periodization science, more training data to draw from, and a larger community. Their programming for competitive powerlifters is probably better than ours until we invest deeply in that niche.
- **Future** has real human coaches who can do things AI can't — read body language on a video call, provide tactile form cues, build genuine human relationships.
- **Tonal Daily Lift** has native integration that will always be tighter than ours. They can access internal data we can't see through the API.
- **Fitbod** has a much larger user base and years of algorithmic training data.

Our advantage is narrow: automatic data + conversational AI + hardware write. If we lose any of those three (Tonal locks the API, AI quality isn't good enough, or competitors add hardware integration), the advantage shrinks.

---

## 10. When Things Go Wrong

The previous versions of this doc described happy paths. This section describes what happens when the AI is wrong — because it will be.

### 10.1 AI Programs a Bad Workout

**Scenario:** The AI programs a workout with an exercise that aggravates an injury the user mentioned 3 weeks ago.

**Why it happens:** Conversation history wasn't properly loaded, the AI lost context, or the injury mention was ambiguous and the AI didn't flag it as persistent.

**Recovery path:**

- User tells the AI ("this bothered my knee")
- AI immediately apologizes, removes the exercise, offers an alternative
- AI logs the injury/sensitivity as a persistent note on the user profile — not just conversation history
- Future sessions are validated against the injury log before being pushed
- "I should have remembered your knee. I've flagged it permanently. I won't program knee-dominant movements unless you tell me it's resolved."

### 10.2 Push-to-Tonal Fails Silently

**Scenario:** The API call succeeds but the workout doesn't appear on the Tonal, or appears incorrectly (empty blocks, wrong exercises).

**Recovery path:**

- After every push, the app reads back the created workout to verify it matches what was intended
- If verification fails, user is notified: "The workout didn't push correctly. I'm retrying. If it still doesn't work, here's the workout plan you can build manually."
- Fallback: display the workout as a visual card in chat with exercise names, sets, and reps so the user can manually recreate it

### 10.3 Plateau Detection Is Wrong

**Scenario:** The AI tells a user they're stalling when they're actually progressing (e.g., weight is the same but reps are increasing, or the user is intentionally maintaining for a cut).

**Recovery path:**

- The AI presents its analysis with the data: "Your Bench Press has been at 69 avg for 3 sessions" — so the user can correct it
- User says "I'm doing that on purpose, I'm cutting" → AI adjusts its model and stops flagging it
- Plateau detection should consider weight AND reps AND volume, not just weight
- The AI asks before acting on plateau detection: "Your OHP hasn't moved in 3 weeks. Want me to adjust the programming, or is this intentional?"

### 10.4 AI Gives Nutrition Advice with Bad Outcome

**Scenario:** User follows protein intake advice and has digestive issues, or the macro estimates from photos were wildly wrong.

**Recovery path:**

- The AI is always clear that nutrition coaching is directional, not medical advice
- Disclaimers on every nutrition-related response: "I'm estimating based on what you've told me. For specific dietary needs, please consult a registered dietitian."
- If a user reports a bad outcome, the AI stops giving nutrition advice for that user until they explicitly re-enable it
- Meal photo estimation (if built) should always show confidence level: "rough estimate — within ±30%"

### 10.5 User Follows the Program and Doesn't See Results

**Scenario:** User has been using tonal.coach for 3 months, training consistently, but strength scores are flat and they don't look different.

**Recovery path:**

- The AI should proactively surface this: "You've been training 3x/week for 12 weeks. Your consistency is excellent, but your strength scores have only moved 8 points. Let's look at what might be limiting progress."
- Investigate in order: nutrition (are they eating enough?), sleep, stress, program design (maybe they need a different stimulus), recovery between sessions
- Be honest: "Training is only part of the equation. If nutrition and sleep aren't supporting your training, progress will be slow regardless of how good the programming is."
- Never blame the user. Help them troubleshoot.

---

## 11. AI Coaching Personality

### 11.1 Personality Traits

| Trait                | Description                                          | Example                                                                                      |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Direct               | States what users need to hear                       | "You're skipping legs. Lower body is falling behind. We're fixing it."                       |
| Data-backed          | Every claim supported by actual numbers              | "Bench volume flat at 3,400 lbs for 3 sessions."                                             |
| Encouraging          | Celebrates real progress genuinely                   | "Overall score crossed 850. Top 8% of Tonal users."                                          |
| Adaptive             | Adjusts to how the user feels today                  | "I'm wiped." → "Lighter recovery session. No ego today."                                     |
| Remembers everything | References past conversations naturally              | "Last time your knee acted up we went hip-hinge only. Want that again?"                      |
| Safety-first         | Never programs through pain                          | "That sounds like more than soreness. See a professional before we train that area."         |
| Opinionated          | Has actual training philosophy                       | "You don't need more arm isolation. Arms get enough from compounds. That time goes to legs." |
| Identity-building    | Reinforces the user's identity as someone who trains | "6 weeks at 3x/week. That's not a streak — that's who you are."                              |
| Autonomy-respecting  | Proposes, doesn't dictate                            | "Here's what I'd recommend. Want to adjust anything?"                                        |

### 11.2 Voice

Ship with one voice: direct, knowledgeable, encouraging. Like a good training partner who's also a certified strength coach. Not a drill sergeant, not a therapist, not a hype man — a competent peer who cares about your progress.

Tone presets (drill sergeant, science coach, hype partner, calm guide) are a future consideration after the core voice is proven and refined through real user conversations. Adding multiple personalities quadruples the surface area for tone-deaf moments ("Get to your Tonal, no excuses" → user having a terrible week → churn). Get one voice right first.

---

## 12. Multi-Device Expansion

Not a nice-to-have — it's the path from Tonal accessory to real business.

### 12.1 Hardware Roadmap

| Priority    | Platform       | Data capture          | Workout push | Notes                                                                       |
| ----------- | -------------- | --------------------- | ------------ | --------------------------------------------------------------------------- |
| 1 (shipped) | Tonal          | Automatic             | Yes          | Best experience — data in AND out                                           |
| 2           | Manual logging | Chat-based            | N/A          | Expands TAM immediately. Critical for strength mode (main lifts off-Tonal). |
| 3           | Speediance     | TBD (API exploration) | TBD          | Growing competitor to Tonal, no subscription.                               |
| 4           | Apple Watch    | Semi-automatic        | N/A          | Rep detection, wearable data                                                |
| 5           | Tempo          | Automatic (camera)    | TBD          | Barbell/dumbbell tracking                                                   |

### 12.2 Architecture Requirement

The coaching AI, user data model, and conversation system must be hardware-agnostic from day one. Tonal is a "provider" plugin. Adding Speediance or manual logging should require a new provider module, not a rewrite.

---

## 13. User Acquisition Strategy

### 13.1 Launch Assets

- **Demo video (highest priority).** Screen recording: open app → chat with coach → get assessment → AI programs workout → workout appears on Tonal. 60-90 seconds.
- **Open-source MCP server.** GitHub as `tonal-coach-mcp`. Power users connect to Claude directly.

### 13.2 Distribution Channels

| Channel                               | Size           | Approach                                            |
| ------------------------------------- | -------------- | --------------------------------------------------- |
| r/tonal                               | ~11K           | Demo video, helpful comments in programming threads |
| Tonal Community (Facebook)            | ~50K           | Demo video, answer custom workout questions         |
| Tonal Custom Workout Share (Facebook) | ~5K            | Share AI-generated workouts                         |
| YouTube Tonal creators                | Varies         | Early access to creators                            |
| LinkedIn                              | Jeff's network | "Built an AI trainer for Tonal in a weekend"        |
| Hacker News                           | Tech audience  | "Show HN" with the reverse-engineering story        |

### 13.3 Activation Flow

1. User sees demo → visits tonal.coach
2. Signs in with Tonal (clear security disclosure)
3. AI greets by name, shows scores and readiness, gives 3-sentence assessment
4. User asks a question → immediate value
5. Under 5 minutes: first workout on Tonal

### 13.4 First User Personas

**The Lost Beginner:** "I bought a Tonal and I don't know what to do next." Hook: "Tell me your goals and how many days you can train. I'll handle everything."

**The Frustrated Builder:** "I spend 15 minutes building workouts before every session." Hook: "Your workout is already on your Tonal. Just walk up and go."

---

## 14. Monetization Strategy

### 14.1 Pricing Tiers

AI quality is the same everywhere. Tiers are differentiated by access and features, not coaching quality.

| Tier      | Price                   | Features                                                                                                   |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Free**  | $0                      | Limited coaching messages/day, training dashboard, muscle readiness                                        |
| **Pro**   | $14.99/mo or $119.99/yr | Unlimited coaching, push-to-Tonal, weekly + multi-week programming, training modes, strength analytics     |
| **Elite** | $29.99/mo               | Everything in Pro + progress photos, proactive SMS/push outreach, wearable integration, nutrition coaching |

### 14.2 Revenue Projections

Modeled at 5%, 10%, 15% conversion (industry standard for fitness apps: 2-5%; strong premium apps: 8-12%).

**Tonal-only:**

| Milestone | Users | 5%        | 10%       | 15%        |
| --------- | ----- | --------- | --------- | ---------- |
| Month 6   | 500   | $375/mo   | $750/mo   | $1,125/mo  |
| Month 12  | 2,000 | $1,500/mo | $3,000/mo | $4,500/mo  |
| Month 24  | 5,000 | $3,750/mo | $7,500/mo | $11,250/mo |

Honest: at 5% Tonal-only, this is a side project. The business requires multi-device expansion.

**Multi-device:**

| Milestone | Users   | 5%         | 10%         | 15%         |
| --------- | ------- | ---------- | ----------- | ----------- |
| Month 12  | 5,000   | $3,750/mo  | $7,500/mo   | $11,250/mo  |
| Month 24  | 25,000  | $18,750/mo | $37,500/mo  | $56,250/mo  |
| Month 36  | 100,000 | $75,000/mo | $150,000/mo | $225,000/mo |

---

## 15. Competitive Moat

### Real Moats

1. **Data accumulation.** Months of coaching context creates switching cost.
2. **Coaching voice and philosophy.** Refined through real conversations. Taste, not technology.
3. **Community network effects.** Shared workouts, partners, leaderboards. Only matters at scale.

### Not Moats

4. **Tonal API knowledge.** Head start, not defensible.
5. **Feature breadth.** Hard to build, not hard to replicate with funding.

---

## 16. The Endgame

### Outcome A: Tonal Partnership (Most Desirable)

500+ active users → Tonal notices → acquisition, licensing, official API, or acqui-hire. The real value is Jeff + product instinct + community traction, not the codebase.

### Outcome B: Standalone Business (Requires Multi-Device)

Expand beyond Tonal. Harder path — without Tonal integration, we compete with every AI fitness app.

### Outcome C: Portfolio Project + Open Source (Most Likely)

MCP server as open-source community tool. Web app serves passionate niche. Compelling portfolio piece.

**Optimizing for:** A first, B as backup, C as floor.

---

## 17. Possible Futures (Not In Scope)

Ideas that don't belong in the product spec but could matter later:

- **Coach marketplace.** Human trainers use tonal.coach to coach remote Tonal clients. AI handles data, human handles relationship. This is a fundamentally different business (two-sided marketplace, trainer acquisition, vetting, payment splits, liability) and should only be explored if organic demand from trainers emerges. It also competes with the core AI product — why pay $100/mo for a human when $15/mo AI coaches you?
- **Voice interface.** "Hey Coach, what should I do today?" while standing at the Tonal. Cool but complex — speech-to-text quality, latency, handling corrections. Evaluate when the core product is mature.
- **Tone presets.** Let users choose coach personality (drill sergeant, science coach, etc.). Creates massive surface area for safety issues. Ship one voice first.

---

## 18. If We Could Only Build Three More Features

1. **Multi-week adaptive programming.** The product. Mesocycle management, proactive phase transitions, nightly data pulls, adaptive replanning. This is why users stay.

2. **Progress photos.** The emotional hook and the proof. AI correlates visual changes with training data. Especially powerful in bodybuilding mode.

3. **Proactive SMS check-ins.** The accountability that makes it feel like a coach, not an app. Identity-reinforcing, not nagging.

Everything else: later.

---

## 19. Roadmap

Priority-ordered, not time-bound.

### Phase 1: Foundation — SHIPPED

- [x] Tonal MCP server (open source)
- [x] Web app with chat interface
- [x] Tonal auth flow
- [x] AI coaching with full data access
- [x] Push workouts to Tonal

### Phase 2: The Product — Programming Engine

- [ ] Training mode selection (General, Hypertrophy, Strength, Athletic, Rehab)
- [ ] Mode-specific system prompts
- [ ] Weekly programming (full week pushed to Tonal)
- [ ] Multi-week mesocycle management
- [ ] Proactive phase transitions (plateau, fatigue, completion)
- [ ] Adaptive replanning
- [ ] Progressive overload tracking
- [ ] Plateau detection
- [ ] Injury/sensitivity persistent log
- [ ] Background cron for nightly data pull
- [ ] Workout verification after push (read-back check)

### Phase 3: Accountability

- [ ] Proactive SMS (Twilio)
- [ ] Missed session detection
- [ ] Weekly recaps
- [ ] Identity-reinforcing messages
- [ ] Milestones
- [ ] Re-entry plans
- [ ] Communication preferences
- [ ] Anti-nag back-off logic

### Phase 4: Body & Progress

- [ ] Progress photo upload with pose guide
- [ ] Encrypted storage
- [ ] AI photo comparison
- [ ] Mode-specific analysis
- [ ] Conversational nutrition coaching
- [ ] Evaluate: meal photo estimation (build vs. integrate)

### Phase 5: Multi-Device

- [ ] Hardware-agnostic refactor
- [ ] Manual logging (chat-based)
- [ ] Speediance API exploration
- [ ] Mobile app (iOS)

### Phase 6: Lifestyle

- [ ] Calendar sync
- [ ] Wearable integration
- [ ] Training partners
- [ ] Shared workouts

### Phase 7: Monetization (Parallel from 100+ users)

- [ ] Free/Pro/Elite tiers
- [ ] Stripe integration

---

## 20. The Bigger Vision

tonal.coach starts as an AI coach for Tonal. The coaching intelligence is hardware-agnostic. Tonal is the beachhead — automatic data capture and push-to-machine make it the best first integration. But the coaching AI is the real product.

If this works for Tonal, it works for every connected fitness device. And eventually, it works for anyone with a phone and a gym membership.

Whether that becomes a company, a Tonal feature, or an open-source community project — the coaching AI is worth building regardless.
