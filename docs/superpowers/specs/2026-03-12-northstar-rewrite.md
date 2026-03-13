# tonal.coach — North Star (v2)

**Author:** Jeff Otano
**Date:** March 2026
**Purpose:** Decision-making reference. What to build, what to skip, and why.

---

## 1. The Bet

### The insight

A personal trainer delivers two kinds of value:

**Cognitive value** — remembers your history, programs intelligently, tracks your body, manages the whole picture. This is information work. An AI can do it today.

**Relational value** — someone who's disappointed when you skip, who reads your body language mid-rep, who makes you feel seen. This is human work. An AI cannot do it.

The cognitive value is currently locked behind a $400/month paywall. Most people who strength train get none of it — they repeat the same workouts, don't progress systematically, and have no idea whether their training is actually working.

tonal.coach unlocks the cognitive value — I'd estimate roughly half of what makes a trainer worth paying for — at $15/month. The relational half remains a human advantage, and this product doesn't pretend otherwise.

### The wedge

Tonal is the beachhead, not the destination.

Tonal auto-captures every rep, every weight, every set. It accepts programmed workouts pushed via API. That makes it the best possible demo of AI coaching — the loop is fully closed:

```
AI programs → machine executes → data feeds back → AI adapts
```

No manual logging. No friction. The coaching intelligence is hardware-agnostic, but the Tonal integration is where the demo is magical.

If Tonal blocks API access or goes under, the coaching engine works with manual logging or other connected hardware. That's a pivot, not a death sentence.

### The positioning

Tonal is smart during the workout — adaptive weight, form feedback, real-time coaching cues (especially Tonal 2 with camera-based form analysis and auto drop sets).

**Tonal is dumb between workouts.**

It doesn't program your week. It doesn't adapt when you miss Monday. It doesn't notice you haven't trained legs in 3 weeks. It doesn't factor in that you slept 5 hours. Its "Daily Lift" feature generates one workout at a time — workout-level smart, program-level dumb.

tonal.coach owns the space between sessions.

### What this is not

- Not a replacement for a human trainer's relational value
- Not medical advice, not physical therapy, not a nutritionist
- Not a form analysis tool (Tonal's own camera does this better)
- A decision-making tool for your training, powered by your own data

---

## 2. The User

### Primary persona

A Tonal owner who does the same programs on repeat because they don't know what else to do. Not a power user. Someone who bought a $4,000 machine and isn't getting $4,000 of value from it. They've done the built-in programs, maybe repeated their favorites, and hit a plateau they can't articulate. They don't know what progressive overload means, but they'd benefit from it.

### Secondary persona

A committed lifter who knows what they're doing but wants smarter programming than Tonal provides natively. They understand training splits, periodization concepts, and progressive overload. They want it managed for them so they can just show up and train.

### First 5 minutes

This is where fitness apps live and die. The activation path:

1. Land on tonal.coach. See what it does. Connect Tonal account.
2. AI immediately pulls their data and surfaces one insight they didn't know: _"You've done 3x more pushing than pulling this month — that's a shoulder injury waiting to happen."_
3. AI offers to program their next session based on what it sees.
4. User accepts. Workout appears on their Tonal.
5. Holy shit moment.

No blank chat box. No "what would you like to do?" The AI leads with value before the user has to think of a question.

**Cold start:** For new Tonal owners with < 2 weeks of history, the AI won't have enough data for a meaningful insight. In this case, lead with preference questions instead: "What's your training goal? How many days a week do you want to train? Any injuries or areas to avoid?" Then program their first session based on preferences + whatever data exists. The insight-first flow kicks in once 2+ weeks of history are available.

**Latency:** Initial data sync may take 10-30 seconds depending on history depth. Show a progress indicator with a hook: "Pulling your training history from Tonal... I'm about to show you something interesting." Don't let the first experience be a silent loading spinner.

### Activation metric

**First AI-programmed workout completed on Tonal.**

Not "first message sent" (too early, no value delivered). Not "first week completed" (too late, most users will have churned). The moment they walk up to their Tonal and do a workout the AI built for them — that's the moment the product proves itself.

Target: 40%+ of signups reach this within 72 hours. Industry baseline for first-workout completion is 20-30%; top-tier apps hit 40-60%.

**How to measure:** A "signup" = user who connects their Tonal account (not just creates a login). "Completed" = the AI-programmed workout appears in the user's Tonal workout history with at least one exercise logged. Track via Convex: timestamp of Tonal account connection → timestamp of first AI-programmed workout completion. Minimum sample: 50 signups before treating the rate as meaningful.

### Retention story

**Weekly programming is the retention mechanism.**

Once the AI programs your entire week and you're used to walking up to your Tonal with a personalized session waiting, that's the habit. The between-workout intelligence (adapting when you miss, adjusting when life changes, progressing weights session over session) deepens the dependency.

The retention loop:

```
AI programs week → user trains → data feeds back → AI programs next week (better)
```

Each cycle makes the AI smarter about this specific user. Switching to a competitor means losing that accumulated context. This is the real moat — not API knowledge, not code, but months of personalized training data that makes the coaching better over time.

Research supports this: first-28-day consistency is the strongest predictor of long-term exercise adherence. The weekly programming engine must be live before the first cohort of users arrives.

### Behavior change model

Grounded in Self-Determination Theory (the most validated framework in exercise psychology):

**Autonomy** — offer choices, don't dictate. "I've programmed three options for today: full push day (55 min), condensed push (35 min), or a recovery session. Which fits your day?" Not: "Do this workout."

**Competence** — progressive difficulty, celebrate mastery. "Your bench press has moved from 65 to 78 avg per rep over 6 weeks. That's real progress." Not: "Great job!" (empty praise).

**Relatedness** — coaching rapport through conversational quality. The AI remembers past conversations, references shared context, builds a persistent model of the user. This is the closest an AI gets to relational value.

**Identity reinforcement** — exercise identity is as powerful as self-efficacy for predicting long-term adherence. The AI should use identity-reinforcing language:

- "You've trained 3x/week for 6 straight weeks — that's not a streak, that's who you are now."
- "You showed up on a day you didn't feel like it. That's what consistent people do."

Not guilt. Not shame. Never: "You missed your session yesterday." Instead: "Ready to get back to it? I've adjusted your week."

Research: extrinsic motivation (streaks, badges) initiates behavior. Intrinsic motivation (enjoyment, identity, competence) sustains it. The AI should use extrinsic hooks early and actively transition users toward intrinsic engagement.

---

## 3. The Product

Priority-ordered. No timelines. Ship in this order; each layer builds on the previous.

### 3.1 Coaching Conversation (shipped)

Chat-based AI coach with full access to Tonal data: strength scores, muscle readiness, workout history, exercise catalog, user profile.

**What the user does:** Asks questions ("how am I doing?"), requests workouts ("program me a leg day"), reports context ("my shoulder hurts", "I only have 30 minutes"), explores their data ("what was my bench volume last month?").

**The UX tension:** Chat is the right interface for ambiguous, open-ended coaching. It's the wrong interface for structured data.

| Use case                               | Right interface                   |
| -------------------------------------- | --------------------------------- |
| "How am I doing?"                      | Chat (narrative response)         |
| View this week's program               | Calendar/grid view                |
| Compare strength score trends          | Chart                             |
| Check muscle readiness                 | Body map visualization            |
| Swap an exercise in tomorrow's workout | Direct manipulation (tap to swap) |
| "My knee hurts, what should I change?" | Chat                              |

The dashboard (shipped) handles some structured display. As the product matures, more structured UI surfaces should replace what's currently chat-only. The chat becomes the "coach's office" — where you go for advice, not for routine operations.

**Failure modes:**

- AI gives wrong advice (misinterprets data, recommends exercise user can't do) → user corrects, AI learns and adjusts
- User asks medical questions → hard guardrail: "That's outside what I can help with. Please see a healthcare provider." No exceptions.
- AI hallucinates exercise that doesn't exist on Tonal → validate all exercise recommendations against the Tonal exercise catalog before presenting

### 3.2 Weekly Programming Engine (next priority)

This is the product. Everything else is setup or amplification.

**What it does:** Programs the user's entire training week, pushes all workouts to Tonal at once. User walks up to their machine on any training day and their session is waiting.

**How the engine works:**

_Inputs:_

- User's preferred split (PPL, Upper/Lower, Full Body) and available training days
- Current muscle readiness per muscle group (Tonal-provided metric: 0-100 score per muscle group, reflecting estimated recovery based on recent training volume, intensity, and time since last training. Sourced from Tonal's API; not user-reported.)
- Workout history (exercises performed, weights, sets, reps)
- Strength scores (overall, upper, lower, core)
- Session duration preference (30/45/60 min)
- Any reported injuries or constraints

_Exercise selection (the hard engineering problem):_

- Filter Tonal exercise catalog (~200+ movements) by target muscle groups
- Respect equipment and handle position requirements
- Avoid repeating the same exercises on consecutive sessions for the same muscle group
- Match exercise difficulty to user's level and strength scores
- Balance compound and isolation movements (compounds first)
- Map user-language requests ("bench press") to specific Tonal movement IDs
- Validate exercise compatibility within workout blocks (supersets, circuits)

_Volume and intensity:_

- Calculate weekly volume targets per muscle group (based on level and goals)
- Apply progressive overload from previous week: slightly more weight, one more set, or one more rep
- Project muscle readiness across the week (chest trained Monday won't be ready until Thursday)
- Respect session duration constraints

_Adaptive replanning:_

- User misses Monday → AI shifts the week, redistributes volume
- User says "I only have 30 minutes today" → condensed version of today's session, compounds only
- User reports unusual fatigue → downgrade intensity or swap to recovery session

**User's control surface:**

- Accept or reject the entire weekly plan
- Swap individual exercises within a session
- Move sessions to different days
- Adjust session duration
- Add constraints ("no overhead pressing this week")
- Override the AI's weight recommendations

**What the calendar view shows:**

- Training days with session type (Push, Pull, Legs, Full Body, Recovery)
- Rest days explicitly marked
- Target muscle groups per session
- Estimated duration
- Status: programmed / completed / missed / rescheduled

**Failure modes:**

- AI programs a bad workout (wrong intensity, inappropriate exercise for reported injury) → user can reject and request reprogramming; AI explains its reasoning so user can correct the input
- Push-to-Tonal fails silently → verify push succeeded before confirming to user; if push fails, show clear error and retry option
- AI misreads fatigue and programs too heavy or too light → surface the reasoning ("I programmed lighter today because your readiness scores are lower than usual") so the user can override if they disagree
- Tonal API changes and workouts stop pushing → detect failure, alert user, offer exportable workout description as fallback

### 3.3 Progressive Overload Tracking

Per-exercise overload management across sessions.

**What it does:**

- Tracks weight x reps x sets for every movement across sessions
- Recommends specific progressions: "Last time you did Bench Press at 4x10 @ 69 avg. Try pushing for 72-75 today."
- Detects plateaus: "Your Bench Press has been within 2 lbs for 4 sessions. Options: add a 5th set, drop to 8 reps and increase weight, or switch to Incline Bench for 4 weeks."
- Celebrates PRs: "New PR on RDL — 115 lbs avg per rep, up from 108."

**Why it matters:** This is table stakes. JuggernautAI, Fitbod, Dr. Muscle, and RP Hypertrophy all do this. Without it, the weekly programming engine can't make intelligent decisions about weight progression.

### 3.4 Proactive Check-ins

The accountability gap no AI competitor fills. Zero AI fitness apps do proactive outreach today. Only human coaches (Trainwell at $99/mo, Future at $199/mo) actively reach out when you skip.

**Start with in-app notifications, not SMS.** SMS (Twilio) is a Phase 2 feature for this capability. In-app is simpler, cheaper, and doesn't require phone number collection.

**Trigger-based:**

| Trigger                  | Message approach                               | Timing                     |
| ------------------------ | ---------------------------------------------- | -------------------------- |
| Missed scheduled session | Acknowledge without guilt, offer to reschedule | 18 hours after             |
| 3+ day gap               | Offer a quick session option, not a lecture    | After 72 hours             |
| Completed tough session  | Celebrate with specific data (volume, PRs)     | 30 min post-workout        |
| Weekly recap             | Stats + what's planned for next week           | Sunday evening             |
| Strength score milestone | Genuine celebration with context               | Real-time                  |
| Plateau detected         | Present options, don't just diagnose           | After 3 plateaued sessions |

**One voice at launch.** No tone presets (Drill Sergeant, Hype Partner, etc.). Get the default voice right first — direct, knowledgeable, encouraging. Like a good training partner who happens to be a strength coach. Tone presets quadruple the testing surface and one bad "drill sergeant" message to a user having a rough week is a churn event.

**Failure mode:** AI sends a check-in at a bad time or with a tone-deaf message → user must be able to mute, adjust frequency, or turn off check-ins entirely. Recovery path: "Sorry if the timing was off. You can adjust when and how often I check in." Settings must be discoverable.

### 3.5 Progress Photos

Feasible today with Claude/Gemini Vision. The AI compares photos across timepoints and provides observations about visible changes.

**What the AI says:**

- "Comparing January to March: visible increase in shoulder width and upper back thickness. This tracks with your training — 20 upper body sessions in that period."
- "I can see improved definition in your midsection. Your core strength score also went from 840 to 871."

**What the AI never says:**

- Negative body comments
- Weight-related judgments
- Comparisons to other people or standards
- Anything that could be construed as body-shaming

**Privacy design:**

- Photos stored encrypted, accessible only to the user
- User can delete all photos at any time
- Photo analysis can be disabled entirely in settings
- No photos are used for model training
- Clear privacy policy covering photo storage, access, and deletion
- Data deletion on account closure — no retention

**Failure mode:** AI makes an observation that feels judgmental or inaccurate → user can flag, AI acknowledges and adjusts. The system prompt must have hard guardrails: all commentary framed as factual observations relative to the user's own baseline, never evaluative.

### 3.6 The Kill List

Explicitly cut or deferred:

| Feature                           | Decision                                | Reasoning                                                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meal photo macro estimation       | Defer or partner                        | Hard problem, well-funded companies do it poorly. "Looks like ~30-40g protein" is directionally useful but not worth building in-house. Partner with an existing service if demand emerges.                                                    |
| Coach marketplace                 | Cut                                     | Different business entirely. Two-sided marketplace requiring trainer acquisition, vetting, payment splits, liability. Competes with the AI product.                                                                                            |
| Voice interface                   | Defer to v3+                            | Cool demo, low daily utility. Focus on the core loop first.                                                                                                                                                                                    |
| Tone presets                      | Defer to v3+                            | Quadruples testing surface. Get one voice right.                                                                                                                                                                                               |
| Wearable integration              | Defer until PMF                         | Valuable (HRV, sleep data inform programming) but not essential for core value prop. Add after product-market fit is proven.                                                                                                                   |
| Training partners / leaderboards  | Defer until community exists            | Social features with no community are ghost towns. Build when there are enough users for it to matter.                                                                                                                                         |
| Periodization engine (mesocycles) | Defer to after weekly programming       | Weekly programming is hard enough. Multi-week periodization (hypertrophy blocks, strength blocks, deloads) is a training science problem that requires validation. Ship weekly programming, learn from usage, then layer periodization on top. |
| Calendar integration              | Defer until accountability layer exists | Useful for schedule-aware programming but not a retention driver on its own.                                                                                                                                                                   |
| Body composition estimation       | Cut for now                             | Combining photos + weight + strength scores for BF% estimates sounds impressive but is inaccurate enough to be misleading. Not worth the false precision.                                                                                      |

---

## 4. The Landscape

### Competitive matrix

| Competitor       | Price      | Remembers | Programs                | Accountability | Body             | Whole Picture | Hardware Push   |
| ---------------- | ---------- | --------- | ----------------------- | -------------- | ---------------- | ------------- | --------------- |
| Juggernaut AI    | $35/mo     | Yes       | Excellent (strength)    | No             | No               | Partial       | No              |
| RP Hypertrophy   | $35/mo     | Yes       | Excellent (hypertrophy) | No             | No               | No            | No              |
| Fitbod           | $16/mo     | Yes       | Good                    | No             | No               | No            | No              |
| Dr. Muscle       | $49/mo     | Yes       | Strong                  | No             | No               | Partial       | No              |
| Trainwell        | $99/mo     | Yes       | Yes (human)             | Strong         | Partial          | Moderate      | No              |
| Future           | $199/mo    | Yes       | Yes (human)             | Strong         | Partial          | Good          | No              |
| Tonal (built-in) | $60/mo\*   | Yes       | Good (daily)            | No             | Form only        | No            | Yes (own HW)    |
| ChatGPT/Claude   | Free-$20   | No        | Moderate (one-shot)     | No             | No               | No            | No              |
| **tonal.coach**  | **$15/mo** | **Yes**   | **Yes (weekly)**        | **Yes**        | **Yes (photos)** | **Partial**   | **Yes (Tonal)** |

\*Plus hardware cost. Sources: Garage Gym Reviews, company pricing pages, RevenueCat. User counts: Fitbod ~840K, JuggernautAI ~17K, others undisclosed.

### The gap no one fills

1. **Proactive accountability** — zero AI apps do this. Only human coaches ($99-199/mo).
2. **Hardware integration** — Tonal is the only product that pushes workouts to hardware, but its AI coaching is workout-level, not program-level. No third-party app pushes to Tonal.
3. **Between-workout intelligence** — no product programs your week AND adapts it when life changes AND tracks progressive overload AND proactively checks in. Each competitor does 1-2 of these.

### The threat

**Tonal is investing in AI coaching.** Tonal 2 (launched CES January 2025) includes camera-based form analysis, adaptive weight at 500 data points/second, and Daily Lift (AI-generated daily workouts). Their new CEO (Todd Bartee, L Catterton operating partner, installed February 2026) signals PE-driven strategy focused on profitability and AI investment.

Tonal could:

- Build between-workout intelligence into Daily Lift (most likely)
- Block third-party API access (possible, no current stance)
- Acquire tonal.coach (unlikely without significant traction)
- Ignore the space entirely (unlikely given their AI investment)

**Three CEOs in two years.** The company is financially restructured (~$535M total raised, valuation collapsed from $1.9B to ~$550M) and under heavy PE investor control. This creates both risk (strategic instability, possible API lockdown) and opportunity (internal focus on profitability may deprioritize between-workout features).

**Apple Health+ (codename Quartz)** was originally planned as an LLM-powered health coach but has been significantly scaled back due to FDA concerns. Even the diminished version validates the market, but Apple's regulatory constraints are exactly what a focused fitness coaching app doesn't face.

### Honest positioning

tonal.coach's moat is **not** Tonal API knowledge. That's a liability — it can be taken away. The actual defensibility:

1. **Accumulated user training data** — months of personalized coaching context that makes the AI better for each specific user. Switching means starting over.
2. **Between-workout intelligence** — the combination of weekly programming + adaptive replanning + progressive overload + proactive check-ins. No single competitor does all four.
3. **Community traction** — once users share workouts and talk about the product in Tonal communities, social proof compounds.

If Tonal blocks API access: the coaching engine works with manual logging. The UX degrades (no auto-capture, no push-to-machine) but the intelligence persists. The abstraction layer between the coaching engine and the Tonal integration should be designed for this scenario from day one.

---

## 5. The Business

### Market size (honest)

**Tonal-specific TAM:**

- ~140-200K Tonal units installed (estimated from $100M+ ARR at $60/mo subscription)
- Realistic addressable: Tonal owners who are dissatisfied with programming AND tech-comfortable AND willing to share credentials AND willing to pay another $15/mo = maybe 5-15K people
- That's a small market. Enough to prove the product, not enough to build a business.

**Hardware-agnostic TAM:**

- AI personal trainer market: $7.23B in 2025, growing at ~15% CAGR
- Everyone who strength trains and wants smarter programming without paying for a human trainer
- This is the real market. Tonal is the beachhead.

### Pricing

**One paid tier.** The AI quality should be the same for everyone.

| Tier | Price                   | What you get                                                                                                                                   |
| ---- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Free | $0                      | Limited daily conversations, training dashboard, muscle readiness view                                                                         |
| Pro  | $14.99/mo or $119.99/yr | Unlimited coaching, push-to-Tonal, weekly programming, progressive overload tracking, proactive check-ins, progress photos, strength analytics |

Annual plans dominate health & fitness apps (60.6% of revenue per RevenueCat 2025). $119.99/yr ($10/mo effective) is a strong incentive to commit.

No "Elite" tier with a better AI model. Telling users the cheaper tier gets the worse model undermines the "personal trainer" positioning. A trainer doesn't give worse advice because you're on the cheaper plan. Differentiate on access and features, not intelligence quality.

### Revenue at honest conversion rates

Industry median install-to-paid conversion: 6.9%. Health & fitness trial-to-paid: 35% (highest of any app category per Adapty 2026). Conservative modeling below.

**Blended ARPU:** If 60% of paying users choose annual ($10/mo effective) and 40% choose monthly ($14.99/mo), blended ARPU is ~$12/mo. Revenue table uses this blended rate:

| Users | 5% conversion | 10% conversion | 15% conversion |
| ----- | ------------- | -------------- | -------------- |
| 500   | $300/mo       | $600/mo        | $900/mo        |
| 1,000 | $600/mo       | $1,200/mo      | $1,800/mo      |
| 2,000 | $1,200/mo     | $2,400/mo      | $3,600/mo      |
| 5,000 | $3,000/mo     | $6,000/mo      | $9,000/mo      |

At Tonal-only scale (2,000 users, 10% conversion): $2,400/mo MRR, $28.8K ARR. That's a side project, not a business.

At hardware-agnostic scale (10,000 users, 10% conversion): $12,000/mo MRR, $144K ARR. That starts to look like something.

The business case requires hardware-agnostic expansion. Tonal alone doesn't get there.

### Unit economics

- Industry median monthly churn: 7.2%. Target: below 5%. Peloton-tier (1.2%) requires hardware lock-in or deep community.
- At ~$12/mo blended ARPU and 5% monthly churn: LTV = $240. At 7.2% churn: LTV = $167.
- CAC must be near zero at launch. Organic community distribution (Reddit, Facebook groups) is the only viable channel at this scale. No paid acquisition until unit economics are proven.
- Primary cost: LLM API usage per conversation. A weekly-programming user likely triggers 5-10 AI interactions per week (programming, adjustments, coaching chat). At current Claude/GPT-4 pricing (~$0.01-0.05 per interaction with caching), rough estimate is $1-3/user/month in LLM costs. At $12 blended ARPU, that's 75-92% gross margin — healthy if the estimate holds, but must be tracked from day one. Prompt optimization and model tiering (cheaper models for routine workout generation, expensive models for nuanced coaching) are levers if margin gets tight.

### Acquisition strategy

The first 100 users come from the Tonal community:

- **r/tonal** (~11K members) — post demo video, engage with programming questions
- **Tonal Community Facebook group** (~25-35K members) — demo video, before/after programming examples
- **Tonal Custom Workout Share Facebook group** — directly relevant audience
- **YouTube Tonal creators** — reach out for reviews/demos

The launch asset is a **demo video**: connect Tonal → AI surfaces an insight → programs a workout → workout appears on Tonal → user completes it. 60 seconds. The "holy shit" moment captured on video.

After the first 100: word of mouth within the Tonal community, user-shared workouts, content marketing (training tips powered by real data).

### Endgame

Build something people love and see what happens.

Not optimizing for acquisition. Not building a pitch deck. If Tonal wants to acquire or partner, the value is:

- Jeff + demonstrated product instinct
- Community traction and user love
- A working product that proves the concept

Not the codebase, not the API knowledge. Be honest about this.

If the product works for Tonal, it works for every connected fitness device (Speediance, Tempo) and eventually for anyone with a phone and a gym membership. The brand should evolve accordingly — "tonal.coach" works for now, but the domain is a limitation if the product outgrows Tonal.

---

## 6. Risks and Open Questions

### Risks

| Risk                                 | Severity | Likelihood | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tonal blocks API access**          | High     | Medium     | Abstract Tonal integration behind an interface. Coaching engine must work without it (manual logging fallback). Design for this from day one.                                                                                                                                                                                                                                                                                                                                  |
| **Tonal builds this themselves**     | High     | High       | Daily Lift is already moving this direction. **Decision trigger:** if Tonal ships weekly AI programming, immediately accelerate hardware-agnostic expansion and shift positioning to coaching quality + accountability (proactive check-ins, identity-reinforcing coaching, adaptive replanning) — capabilities Tonal is unlikely to invest in given their PE-driven focus on hardware margins. Build community lock-in now so users have switching costs before this happens. |
| **TAM ceiling**                      | Medium   | High       | Tonal-only market is 5-15K addressable. Hardware-agnostic expansion is the answer, but that means building a second integration layer. Prioritize this after PMF on Tonal.                                                                                                                                                                                                                                                                                                     |
| **Injury liability**                 | High     | Low        | Industry-standard disclaimers (Peloton/Fitbod patterns). Hard system prompt guardrails: never diagnose, never rehabilitate, never prescribe therapeutic exercise. "Please see a healthcare provider" for anything beyond normal muscle soreness. No nutrition advice beyond general guidelines from authoritative sources.                                                                                                                                                     |
| **Privacy breach**                   | High     | Low        | Encrypted credential storage, encrypted photo storage. Data deletion on demand. Minimize data collection. Clear privacy policy. Regular security review.                                                                                                                                                                                                                                                                                                                       |
| **User churn at month 3**            | Medium   | High       | 71% of fitness app users churn by month 3. Mitigation: weekly programming creates habit before novelty fades. Proactive check-ins catch disengagement early. Identity-reinforcing coaching builds intrinsic motivation.                                                                                                                                                                                                                                                        |
| **LLM cost per user exceeds margin** | Medium   | Medium     | Track cost per conversation. Set reasonable conversation limits on free tier. Optimize prompts. Use cheaper models for routine tasks (workout generation) and expensive models for complex coaching.                                                                                                                                                                                                                                                                           |
| **Reverse-engineered API breaks**    | Medium   | High       | Expect this. Build monitoring for API failures. Have fallback UX ready (workout description without push-to-Tonal). Treat API stability as a known fragile dependency, not a surprise.                                                                                                                                                                                                                                                                                         |

### Open questions

Things I don't know yet and need to figure out:

1. **What's the real conversion rate?** Need to ship the free tier and measure. The 5-15% range is a guess informed by industry data, not evidence from this product.

2. **Does weekly programming actually retain better than single workouts?** The hypothesis is yes — the habit of walking up to a pre-programmed Tonal is stickier than one-off workout generation. But this is unproven. Need to measure retention cohorts: weekly-programming users vs. single-workout-only users.

3. **Can the coaching conversation drive daily engagement?** Or do users only open the app when they need a workout? If engagement is workout-day-only (3-4x/week), the app is a utility. If the AI can create reasons to engage on rest days (recovery advice, progress updates, programming previews), it's a companion. Different products with different retention profiles.

4. **What's the right abstraction layer for hardware-agnostic expansion?** The Tonal integration is deeply coupled to Tonal's exercise catalog, movement IDs, workout block structure, and push API. Making this generic (so the same coaching engine works with Speediance, manual logging, or Apple Watch) requires defining an exercise abstraction, a workout format abstraction, and a data ingestion abstraction. What does that interface look like without making the Tonal experience worse?

5. **How do users react when the AI says "no"?** The AI should reject workout requests when the muscle isn't ready, recommend deloads when it detects overreaching, and scale back intensity when recovery signals are poor. Does this feel like good coaching or does it feel like the app isn't giving them what they want?

6. **Is there a path to profitability at Tonal-only scale?** At 2,000 users / 10% conversion / ~$12/mo blended = $2,400 MRR. After LLM costs ($1-3/user/mo), hosting, and Tonal API overhead — is there anything left? Or does the business fundamentally require hardware-agnostic expansion?

7. **What's the right response to "my shoulder/knee/back hurts"?** The current approach is: acknowledge → recommend healthcare provider → offer to avoid the affected area. Is that enough? Is it too conservative (users get frustrated that the AI won't help)? Is it not conservative enough (legal exposure if the user interprets avoidance as therapeutic programming)? May need professional legal review.

8. **When should tonal.coach stop being tonal.coach?** If the product outgrows Tonal, the brand and domain become a limitation. When does that rebrand happen? Before or after hardware-agnostic expansion? This affects the name, the positioning, and the community identity.

---

## Appendix: Research Sources

This document is grounded in research conducted March 2026. Key sources:

**Market data:**

- Tonal: ~$100M+ ARR, ~140-200K installed base, <1% claimed churn (Athletech News, TechCrunch, Front Office Sports)
- Fitness app economics: RevenueCat State of Subscription Apps 2025, Adapty State of In-App Subscriptions 2026, Business of Apps H&F Benchmarks 2026
- AI personal trainer market: $7.23B in 2025, 14.57% CAGR (360iResearch)

**Competitive intelligence:**

- Competitor pricing and features: Garage Gym Reviews, company websites and pricing pages (Juggernaut AI, RP Strength, Fitbod, Trainwell, Future)
- Fitbod user base: ~840K users, 150M+ logged workouts (Fitbod blog, GymGod review)
- Juggernaut AI user base: ~17K users (Garage Gym Reviews)
- Tonal 2 AI features: TechCrunch, Connect the Watts, Wareable, Engadget

**Behavior change:**

- Self-Determination Theory in exercise: ScienceDirect 2025 systematic review, PMC systematic review
- Exercise identity meta-analysis: Review of Sport and Exercise Psychology 2025
- First-28-day adherence prediction: SportRxiv longitudinal cohort study
- Fitness app abandonment: 71% churn by month 3 (Autentika research), 45% leave when novelty fades
- AI coaching effectiveness: PMC 2025 (GPT-4 as fitness coach), Frontiers in Psychology 2024 (AI vs human coaches)

**Legal:**

- Fitness app terms of service: Peloton, Fitbod, FitnessAI
- Scope of practice: NFPT, CPH Insurance, Precision Nutrition
- AI exercise safety: Scientific Reports 2024 (physiotherapist assessment of AI recommendations)
- Personal trainer negligence precedents: $2.25M settlement, $1.4M jury verdict (Buckfire Law)
