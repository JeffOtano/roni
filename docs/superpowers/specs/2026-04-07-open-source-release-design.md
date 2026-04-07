# Open-Source Release of Tonal Coach

**Date:** 2026-04-07
**Status:** Approved
**Author:** Jeff Otano (brainstormed with Claude)
**Context:** Solo dev burning out on Gemini API costs for 50 beta users. Users hesitant to connect Tonal accounts because they suspect the app stores their password. Goal is to open-source the project so technical users can self-host, new hosted users bring their own Gemini key (BYOK), existing beta users stay grandfathered. iOS app remains private. Project name stays "Tonal Coach" with clear unofficial/non-affiliated disclaimers.

## Motivation

Three things drive this release:

1. **Stop paying out-of-pocket for Gemini API usage.** The current hosted instance uses one shared Google AI key funded by the operator. With BYOK, new hosted users and self-hosters pay Google directly. Existing beta users stay grandfathered so they experience no disruption.
2. **Solve the trust problem.** Beta users hesitate to connect Tonal because the integration requires sharing credentials with a closed-source app. Open-sourcing the code lets them (or anyone) audit how credentials are handled, which is the only credible answer to "are you storing my password?"
3. **Give the project back to the community.** After a significant solo build, the operator wants technical users to be able to run it themselves, fork it, and extend it. Not a commercial play, not a community-building project, not a portfolio move. Just making it available.

## Goals

1. Publish a clean, MIT-licensed public repo containing the web app and Convex backend
2. Add bring-your-own-key (BYOK) support to the hosted instance so new users cost the operator $0 in AI spend
3. Keep existing 50 beta users on the current experience (grandfathered on the shared Gemini key) with no migration ask
4. Make the trust story credible: no admin backdoors in the codebase, no hidden data access, clear legal disclaimers
5. Stay out of Tonal Systems, Inc.'s way while being honest about what this is (an unofficial third-party tool)
6. Ship in a weekend-to-two-weekends timeframe without scope creep

## Non-Goals

- Attracting contributors or building a community in v1 (no CONTRIBUTING.md, no CODE_OF_CONDUCT.md, no GitHub Discussions)
- Making money from the OSS release (donations are a tip jar, not a contract)
- Seeking Tonal's blessing before launch (deferred until post-launch if traction warrants)
- Migrating existing beta users (they stay grandfathered)
- Open-sourcing the iOS app (stays in the existing private repo)
- Refactoring code for "portfolio readability" beyond what the publish requires
- Renaming the project or distancing it from the "Tonal" trademark (accepted risk)
- Publishing a docs site, launch blog post, or press campaign

## Approach: Self-Host + BYOK Hosted

Of the three approaches considered, this plan implements Approach B from the brainstorm:

- **Self-host path (headline).** Technical users clone the repo, spin up a free Convex deployment of their own, provide their own Gemini API key via env var, and run the whole stack on free tiers. This is the recommended path for any user who can follow a README.
- **Hosted + BYOK path (for less technical users).** The existing hosted instance stays alive. New signups go through an onboarding flow that requires them to paste their own Gemini API key before they can use the chat. Their key is encrypted at rest using the same AES-256 infrastructure as Tonal tokens. The operator pays zero AI costs for new hosted users.
- **Hosted grandfathered path (existing 50 beta users).** Users whose `_creationTime` precedes the BYOK launch timestamp continue using the shared Gemini key, same as today. No banner forcing migration. No deprecation warnings. Nothing changes for them operationally.

Two rejected alternatives:

- **Approach A (minimal publish, no BYOK)** would ship faster but freeze the cost problem rather than solve it. New signups would still cost the operator money or would require closing hosted signups entirely.
- **Approach C (polish + community)** would add a docs site, launch announcement, CONTRIBUTING.md, and refactoring. Too much scope for a solo dev with cost anxiety; high risk of never shipping.

## Scope

### In scope

- Web app (`src/app/`, `src/components/`, `lib/`)
- Convex backend (`convex/` including agent, coach engine, Tonal proxy, auth, schema, crons)
- BYOK support on the hosted instance (new engineering work)
- Admin impersonation removal (security hardening for the trust story)
- Broader privileged-access audit (admins, debug routes, hardcoded special-cases)
- Secret rotation (both encryption keys with migration scripts, plus all API credentials)
- Git history scrub via `git filter-repo`
- Documentation: README rewrite, LICENSE (MIT), Tonal disclaimer, SECURITY.md, FUNDING.yml
- Existing beta user notification: one-time dismissible in-app banner
- Reddit launch post (r/tonal first)

### Out of scope

- iOS app (`ios/` directory) stays in the existing private repo
- Private planning docs: `northstar.md`, anything in `docs/superpowers/` that references internal context
- Internal AI tooling configs: `.agent/`, `.agents/`, `.claude/`, `.conductor/`, `.factory/`, `.junie/`, `.kiro/`, `.windsurf/`, `.superpowers/`
- Tonal partnership outreach
- Docs site, launch blog post, Show HN / press
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue templates
- Refactoring for polish

## Success Criteria

1. Public repo is live, MIT-licensed, with a README that a moderately technical user can follow end-to-end
2. Gitleaks shows zero leaked secrets in the new repo's history
3. Existing 50 beta users experience zero disruption (verified via smoke tests on a grandfathered test account)
4. A fresh signup on the hosted instance cannot access chat without providing a valid Gemini API key
5. Admin impersonation is removed from the codebase AND from the production deployment
6. Operator's monthly Gemini bill stops growing; existing users' usage decays naturally
7. GitHub Sponsors button and Buy Me a Coffee link are live and reachable from the README
8. The Reddit launch post is live in r/tonal with the operator actively responding in the first 4 hours

---

## Section 1: Repo Strategy and Security Cleanup

### Repo strategy

Split the current private repo into two:

1. **A new public repo** (name: `tonal-coach`) containing the web app, Convex backend, docs, and license. Developed in public going forward.
2. **The existing private repo** is stripped down to the iOS app only. iOS continues to develop there, independent of the public repo.

Rejected alternatives:

- Making the existing repo public in place (history scrub on a shared repo invalidates Conductor workspaces and breaks cross-references)
- Publishing a separate "release" repo that gets synced from a private dev repo via script (solo-dev maintenance nightmare, two repos always drift)

### Cleanup process

**Step 1: Secret inventory.** Run `gitleaks` (or `trufflehog`) against the full history of the existing private repo. Catalog every commit that contains a secret. This is an audit pass; findings inform the exclusion list.

**Step 2: Build the `git filter-repo` exclusion list.**

Paths to exclude (entire directory + history):

- `ios/`
- `.env.local`, `.env.sentry-build-plugin`
- `northstar.md`
- `.agent/`, `.agents/`, `.factory/`, `.junie/`, `.kiro/`, `.windsurf/`, `.superpowers/`, `.conductor/`, `.claude/`
- Any `docs/superpowers/plans/` or `docs/superpowers/specs/` files that reference internal context (audit each)
- Any file flagged by gitleaks in step 1

**Step 3: Rotate all secrets before the public push.** This happens regardless of what gitleaks finds (safe-route decision from brainstorm).

Category A: Encryption keys (requires migration scripts)

- `TOKEN_ENCRYPTION_KEY`: walk every row in `userProfiles`, decrypt Tonal OAuth tokens with the old key, re-encrypt with the new key, write atomically. Uses a transitional `TOKEN_ENCRYPTION_KEY_NEW` env var so the migration code can read both, then the old key is removed after the migration completes.
- `PROGRESS_PHOTOS_ENCRYPTION_KEY`: same pattern applied to whatever table stores encrypted photo references.

Category B: API credentials (rotate via provider dashboards, no migration needed)

- `GOOGLE_GENERATIVE_AI_API_KEY` (Google AI Studio)
- `AUTH_RESEND_KEY` (Resend)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Google Cloud Console)
- `CONVEX_DEPLOY_KEY` (Convex dashboard)
- Sentry DSN / auth token
- PostHog tokens

**Step 4: Run `git filter-repo` in a fresh local clone of the existing repo.** Verify the cleaned history by re-running gitleaks against it. Must come back clean.

**Step 5: Manual review pass.** Walk every file in the cleaned tree and every commit message. Look for hardcoded prod Convex deployment names, personal email addresses, user IDs, internal Slack handles, "TODO @jeffrey" comments. Strip or genericize.

**Step 6: Push to a new private GitHub repo for a final review.** Browse in the GitHub UI. Sometimes browser views surface things a `git log` misses. Then flip to public.

### The existing private repo after the split

Strip the existing repo down to `ios/` only. Delete everything else. iOS development continues in that private repo, pointing at whatever Convex deployment is appropriate (dev or prod).

### Files modified

- New public repo: `/Users/jeffreyotano/GitHub/tonal-coach` (created fresh from filter-repo'd clone)
- Existing private repo: `/Users/jeffreyotano/GitHub/tonal-coach` (stripped to iOS only, private)

---

## Section 2: BYOK Engineering

### Data model

Add two nullable fields to the `userProfiles` table:

```ts
geminiApiKeyEncrypted?: string  // AES-256 ciphertext, null = grandfathered
geminiApiKeyAddedAt?: number    // Unix ms timestamp, for UX display
```

No `status` field. Validity is checked at the call site, not stored.

Encryption key: reuse `TOKEN_ENCRYPTION_KEY`. Introducing a separate `USER_API_KEYS_ENCRYPTION_KEY` adds complexity without security benefit for this threat model.

Migration: nullable schema addition, no backfill. Convex handles it.

### Grandfathering gate

Add a constant (likely in `convex/byok.ts`):

```ts
export const BYOK_REQUIRED_AFTER = <launch timestamp, Unix ms>
```

Chat mutation logic (pseudocode):

```ts
const user = await ctx.db.get(userId);
const requiresBYOK = user._creationTime >= BYOK_REQUIRED_AFTER;

const key = requiresBYOK
  ? decryptUserKey(user.geminiApiKeyEncrypted) // throws if null or invalid
  : process.env.GOOGLE_GENERATIVE_AI_API_KEY; // grandfathered path
```

The gate is `_creationTime`-based so a user who deletes their account and re-signs up lands correctly in the BYOK cohort.

### Runtime hot path

Currently `@convex-dev/agent` is initialized at module load with a fixed Gemini provider. BYOK requires per-request provider construction:

1. Chat mutation receives a user message
2. Look up `userProfiles`
3. Resolve the Gemini key via the grandfathering gate
4. Construct the Gemini provider for this request with the resolved key
5. Run the agent with that provider
6. On Gemini error, catch, sanitize (never leak the key in the error message), return a typed error code (`byok_key_invalid`, `byok_quota_exceeded`, etc.)

**Critical invariant: on BYOK user key failure, do NOT silently fall back to the house key.** The chat fails with a clear error and the user fixes their key in settings. Violating this invariant re-creates the cost leak silently.

### Spike required before full implementation

`@convex-dev/agent` may not support per-request provider construction cleanly, since its agent instance is typically a module-level singleton. The first engineering task is a half-day spike:

1. Read the `@convex-dev/agent` source
2. Build a throwaway test that constructs a Gemini provider with a runtime-supplied key and runs a single agent call
3. Confirm it works OR identify the blocker

If blocked, the fallback is a provider wrapper or a thin fork that accepts a key override parameter. Not expected to be blocking but must be validated before building the rest.

### BYOK kill switch

Add `BYOK_DISABLED` as a Convex env var. When `true`, the chat mutation ignores the grandfathering gate and uses `process.env.GOOGLE_GENERATIVE_AI_API_KEY` for all users. This is the rollback lever if a BYOK bug surfaces in production after launch. 30 seconds to flip, restores pre-launch behavior.

### Onboarding (new hosted users)

Current onboarding: questionnaire, equipment, training preferences (3 steps). New flow adds a fourth step: **Gemini API key**.

Required for all users whose `_creationTime >= BYOK_REQUIRED_AFTER`. Not skippable. Chat is gated until a valid key is saved.

UX requirements (all implemented in a single React component under 300 lines):

1. **Warm explainer copy**, not legal boilerplate. Example: _"Tonal Coach uses Google's Gemini AI to design your workouts. Gemini is free for personal use. We use your own key so you control your usage and we don't see your conversations. Getting a key takes about 60 seconds."_
2. **One-click "Get a key" button** opening `aistudio.google.com/app/apikey` in a new tab.
3. **Inline visual walkthrough**: three screenshots showing the AI Studio flow (click Create API Key, select project, copy). Screenshots live in `public/onboarding/byok-*.png` and can be updated when Google's UI changes.
4. **Smart paste handling**:
   - Auto-trim whitespace and newlines (avoids the trailing-newline class of bug)
   - Inline format validation as the user types (Gemini keys match `AIza[A-Za-z0-9_-]{35}`)
   - Clipboard API: detect Gemini-key-shaped strings in the clipboard on tab focus and offer a one-click paste button
5. **Test call on save**: single request to Google AI (e.g., list models or minimal generate). Green checkmark within one second on success; specific error message on failure.
6. **Immediate payoff on success**: redirect straight to `/chat` with a pre-composed starter message so the user sees the coach respond within 5 seconds of saving the key.

### Settings page

Existing settings page gains a "Gemini API Key" section:

- Grandfathered user with no key set: shows "Using shared hosted AI. Want to switch to your own key? [Learn more]." No pressure.
- User with key set: shows masked last-4 characters, added-at date, "Test key" button, "Remove" button.
- Key failing: persistent banner at the top of chat and dashboard linking to settings.

### Graceful failure UX

Five failure modes and their recovery paths:

| Failure               | User-facing message                                                | Recovery                                                                                           |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Invalid / revoked key | "Your Gemini key isn't working anymore."                           | Persistent banner + "Fix it" button deep-linking to settings. Draft message preserved in composer. |
| Quota exceeded        | "You've hit Gemini's free daily limit. It resets at midnight UTC." | Countdown to reset + link to Google AI billing. Draft preserved.                                   |
| Network / Google down | "Can't reach Google AI right now."                                 | Automatic retry with exponential backoff (3 attempts). Manual retry button after. Draft preserved. |
| Safety filter         | "Gemini declined to answer this one."                              | Suggest rephrasing. Optional report link for tracking.                                             |
| Model not available   | "Your key doesn't have access to Gemini 2.5 Pro."                  | Link to Google's enable-the-model docs with exact steps.                                           |

Core principles:

- Never show raw Google error strings (they can contain the plaintext key and are scary)
- Never lose the user's input (composer persists through errors)
- Transient errors retry automatically; auth/config errors ask the user to act
- Banners are persistent and one-click-to-fix, not transient toasts
- All errors logged to Sentry with the key redacted

### Security

- Key encrypted at rest with `TOKEN_ENCRYPTION_KEY` (AES-256)
- Key only decrypted inside actions that need it (never in queries)
- Key never returned by any query; settings page gets a masked last-4 view computed server-side inside an action
- Key never logged; error-path tests verify sanitization
- Key rotatable at any time; delete fully removes the ciphertext
- Sentry scrubbing rules updated to redact any field matching `AIza[A-Za-z0-9_-]{35}`

### Tests

- Unit: encrypt/decrypt roundtrip with `TOKEN_ENCRYPTION_KEY`
- Unit: key validation function (mock Google AI, test success / invalid / quota / network / safety)
- Unit: error sanitization (input contains plaintext key, output must not)
- Integration: settings mutation rejects invalid keys at save time
- Integration: agent action with BYOK user uses their key (mock provider, verify key passed)
- Integration: agent action with grandfathered user falls back to house key
- Integration: agent action with BYOK user whose key fails returns typed error; house key is NOT used as fallback
- Manual: full UX walkthrough on a fresh test account (signup -> onboarding -> first chat)

### Engineering estimate

3 to 4 focused days.

- `@convex-dev/agent` provider spike: 0.5 day
- Schema + encryption helpers + mutations: 0.5 day
- Settings UI + onboarding step: 0.5 day
- Agent hot-path refactor + error sanitization: 0.5 day
- Onboarding polish (walkthrough screenshots, clipboard detection, deep-linking): 0.5 day
- Failure UX (5 failure components, banner system, draft persistence): 0.5 day
- Tests + manual QA: 0.5 day
- Buffer: 0.5 day

---

## Section 3: Hosted Lifecycle

### Grandfathering gate

Existing 50 beta users (`_creationTime < BYOK_REQUIRED_AFTER`) stay on the shared Gemini key. They see no changes to their onboarding, no migration prompts, no emails. The shared-key path remains in the codebase and is only reached for grandfathered users.

New users (`_creationTime >= BYOK_REQUIRED_AFTER`) go through the BYOK onboarding step. They cannot reach `/chat` until a valid key is saved.

### Remove the 50-user beta cap

`BETA_SPOT_LIMIT` is currently enforced in both `convex/userProfiles.ts` (client-side pre-check) and `convex/auth.ts` (server-side callback). CLAUDE.md warns these must stay in sync.

Remove both enforcements as part of the BYOK cutover. Replace with a short comment explaining why the cap existed historically and when it was lifted. New signups are unbounded since they cost the operator $0 in AI spend.

### Privileged-access audit and admin impersonation removal

**This is the single most important security-and-trust task in the release.** The project is being open-sourced specifically to reassure users about data handling. An admin-impersonation backdoor in the codebase destroys that story the moment a Reddit commenter finds it.

Audit tasks:

1. **Remove admin impersonation from `getEffectiveUserId()`.** The helper becomes a simple "return the auth'd user ID, throw if not authenticated." Delete any admin allowlist.
2. **Deploy the removal to production** before the repo goes public. The codebase and the live deployment must match.
3. **Enumerate all other privileged capabilities** and decide remove / gate-behind-env-var / document:
   - Any admin-only mutations (manual user deletion, beta access granting, field overrides)
   - Any debug or dev-only routes in `src/app/` (e.g., `/debug`, `/admin`)
   - Any `if (user.email === "jeffrey@...")` hardcoded special-cases
   - Rate limit bypasses for specific users
   - Feature flags that behave differently for specific users
   - Internal Convex functions that could be called from the Convex dashboard to do privileged things
4. **Document any capability that stays.** If a capability is genuinely necessary for self-hosters, it gets a clear env-var gate with a default of off and a README note.

Support cost of removing impersonation: real but bounded. Reading a user's data still works via the Convex dashboard directly (the operator has full DB read access regardless). The loss is the ability to visually debug another user's UI session on the live app. Acceptable trade-off.

### Cutover sequence on launch day

1. **Backup production Convex database** via `npx convex export`. Store the snapshot outside the repo. This is the rollback point for the encryption-key migration.
2. **Deploy BYOK backend code** to prod Convex (`npx convex deploy`). New schema fields, per-request key resolution, grandfathering gate, kill switch, impersonation removal.
3. **Smoke test on the grandfathered test account.** Sign in to the prod app as the test user created in pre-launch week (whose `_creationTime` is earlier than `BYOK_REQUIRED_AFTER`). Verify chat works and uses the house key. If it fails, roll back.
4. **Run the encryption-key rotation migrations.** Verify by logging in as a test grandfathered user and loading their Tonal data (requires token decryption with the new key).
5. **Rotate all Category B API credentials** via provider dashboards. Update Convex env and Vercel env. Smoke test chat, password reset, OAuth connect after each.
6. **Deploy the Next.js frontend** with the new onboarding flow.
7. **Create a fresh brand-new test account** in prod. Walk through BYOK onboarding. Verify `/chat` is inaccessible without a valid key. This is the BYOK acceptance test.
8. **Remove the 50-user beta cap** (client + server). Deploy.
9. **Push the cleaned public repo to GitHub, still private.** Final review in the GitHub UI.
10. **Flip the public repo to public.**
11. **Deploy the in-app banner** to existing users (dismissible, one-time).
12. **Post to r/tonal.** Operator stays in the comments for the first 4 hours.
13. **Monitor Sentry, Convex logs, and GitHub issues for 48 hours.**

### Rollback plan

- Code deploys: revert the commit, redeploy. Standard.
- Encryption-key migration: requires the backup from step 1. Can't be undone by redeploy alone.
- BYOK bug affecting grandfathered users: flip `BYOK_DISABLED=true` in Convex env. Kill switch restores pre-launch behavior in 30 seconds.
- Admin impersonation regression: the removal is a code change; revert commit + redeploy.

### User notification

One-time, dismissible in-app banner on the dashboard:

> Tonal Coach is now open source. Your account is unchanged. [Read the code]

No email. No urgency. No migration prompt. If a user asks whether they should switch to BYOK, the honest answer is "you don't have to, but it's free and you'd control your own usage."

---

## Section 4: Documentation, Legal, Sponsorship

### License

MIT. Four lines, maximally permissive, widely understood.

Apache 2.0 was considered for the patent grant but rejected: this is a solo hobby project with no enterprise contributors, and the grant's value does not justify the extra ceremony.

### Tonal disclaimer

Legal-style boilerplate, placed in four locations:

1. **Top of README**, in a callout block, right under the title:

   > **Not affiliated with Tonal Systems, Inc.** Tonal Coach is an independent, unofficial tool that works with Tonal fitness machines. "Tonal" is a trademark of Tonal Systems, Inc., used here under nominative fair use. This project is not endorsed by, sponsored by, or associated with Tonal Systems, Inc. in any way.

2. **LICENSE file** trailing note (does not affect the MIT grant)
3. **Hosted app footer**: small text "Not affiliated with Tonal Systems, Inc."
4. **GitHub repo description**: "Unofficial AI coach for Tonal fitness machines"

Before shipping, verify the exact legal entity name via Tonal's privacy policy or terms page. Update the disclaimer to match.

### README rewrite

Current README is 307 lines and mostly correct as a dev setup guide. Changes:

- **Add**: 3-paragraph "What this is / Who it's for / How the OSS model works" section at the top
- **Add**: Tonal disclaimer callout block under the title
- **Remove**: all iOS sections (prerequisites, getting started, deployment)
- **Remove**: `ios/` row from the Project Structure tree
- **Remove**: any references to Conductor workspaces
- **Rewrite**: "Getting Started" becomes "Self-Host Setup" with the Gemini-key step inlined
- **Add**: "Project status" section with authentic language: "Active, maintained by one person. This is a personal project, not a startup. Issues triaged on a best-effort basis."
- **Add**: "Support the project" section linking to GitHub Sponsors and Buy Me a Coffee, framed as optional: "This project is free. Hosting and my time are not. If it's saved you work, consider chipping in. No pressure."
- **Add**: "License" section pointing to LICENSE
- **Add**: Two hero screenshots at the top (chat interface, dashboard). Stored in `public/readme/` or `assets/`

### SECURITY.md

Short file, approximately 8 lines:

> # Security
>
> If you've found a security issue, please do not open a public GitHub issue.
>
> Email [operator's security email] with details. I'll respond within 7 days on a best-effort basis. This is a personal project with no bounty program, but I take security seriously and will credit reporters who want credit.
>
> The project encrypts sensitive data at rest (Tonal OAuth tokens, Gemini API keys) using AES-256. See `convex/lib/encryption.ts` for the implementation.

### GitHub Sponsors and Buy Me a Coffee

Both, in parallel. No gating, no expectations.

1. **Start GitHub Sponsors verification now** (before launch day): it requires identity verification and can take several days to approve. Must be live before the repo goes public or the Sponsor button will be missing.
2. **Create a Buy Me a Coffee account** if one does not exist.
3. **Add `.github/FUNDING.yml`**:

   ```yaml
   github: [your-github-username]
   buy_me_a_coffee: your-bmac-username
   ```

4. **README "Support" section** links to both.

### Other docs changes

- `package.json`: remove `"private": true`, add `"license": "MIT"`, add `"repository"` and `"homepage"` fields
- `.env.example`: verify it is current and does not reference personal deployment names
- Skip: CONTRIBUTING.md, CODE_OF_CONDUCT.md, GitHub issue templates. These signal a formal contribution process the operator is not running.

---

## Section 5: Launch Sequence (Reddit + C&D Contingency)

### Pre-launch week

1. Finish all engineering work (BYOK spike through QA)
2. Finish all cleanup work (filter-repo, secrets rotated, README written, disclaimers in place, LICENSE + SECURITY.md + FUNDING.yml)
3. GitHub Sponsors identity verification started (may take several days)
4. **Create a grandfathered test account on production** with credentials you control. This account must be created before `BYOK_REQUIRED_AFTER` is set so it sits in the grandfathered cohort and can be used on launch day to smoke test house-key behavior without needing admin impersonation.
5. Draft the Reddit post body; sit on it for 48 hours before posting; re-read with fresh eyes
6. Decide which Reddit account to post from (real history, not a throwaway; Reddit auto-flags new accounts promoting their own projects)
7. Read r/tonal's rules; if self-promotion rules are ambiguous, modmail the mods before posting: "Hi mods, I built an unofficial open-source tool for Tonal users and want to share it. Is this a fit for the subreddit?"
8. Draft the C&D response template (see below); save it in a `tonal-correspondence/` folder on the local machine

### Launch day

In order:

1. **Morning**: final smoke test in prod. Grandfathered user chat works. New user BYOK onboarding works. All README links resolve.
2. **Flip the public repo to public.**
3. **Deploy the in-app banner** to existing users.
4. **Post to r/tonal.** Best time: weekday morning US Eastern, Tuesday through Thursday, 9 to 11am ET.
5. **Stay in the comments for the first 4 hours.** Respond to every question, thank every commenter, be humble, do not get defensive on criticism. An absent author kills the post.
6. **Monitor Sentry, Convex logs, and GitHub issues in parallel.** New signups hitting the BYOK flow are the most likely place for bugs to surface.
7. **Do not cross-post to other subreddits on day one.** Wait at least 24 hours.

### Reddit post framing

Good framings (lead with the reason, not the product):

- "I open-sourced my AI coach for Tonal: stopped paying for it, now you can self-host"
- "After 6 months of building an AI Tonal coach solo, I'm giving the code away"
- "Open-sourced my Tonal AI coaching project so users can audit the code and run it themselves"

Bad framings (read as self-promo):

- "I built an AI coach for Tonal, check it out!"
- "Tonal Coach: AI-powered workout programming"
- "Show Reddit: tonal-coach"

The word "solo" does real work. The reason (cost, trust, giving back) leads. The product description follows.

### Reddit post body structure

1. Opening: one sentence on what it is
2. Two to three sentences on why it was built and why it is being open-sourced (the real reasons: Gemini costs and user trust)
3. One paragraph on what it does (bullets fine)
4. One paragraph on how to run it (self-host path in one line)
5. One paragraph on what it is NOT (unofficial, not affiliated with Tonal, use at your own risk, plain language not legalese)
6. Repo link
7. "Happy to answer questions in the comments"

### C&D contingency plan

Decision pre-committed: **respond and try to open a dialogue.** Details:

1. **Response template** (drafted before launch):

   > Hi [name], thanks for reaching out. I built Tonal Coach as an independent project and recently open-sourced it. I'd love to find a path that works for Tonal. Are you open to a short call?

   Cold, short, professional, no concessions, no lawyering up, no escalation. Stored in `tonal-correspondence/response-template.md`.

2. **Lines in advance** (decided cold, not under stress):
   - Agreeing to pause the repo while talking: yes
   - Signing anything without a lawyer: no
   - Admitting liability in writing: no
   - Anything beyond "pause and talk" requires a lawyer first

3. **Keep the repo public during the first exchange**, but have the "archive and privatize" command ready in a terminal tab. If tone escalates from "hi" to "our legal team is drafting a complaint," flip private immediately and lawyer up.

4. **Preserve every communication.** Create `tonal-correspondence/` on day one. Save every email, every message, every Reddit comment from anyone claiming to be Tonal. Contemporaneous records are evidence if this ever becomes contentious.

5. **Budget $500 to $1000 for an IP attorney consultation** if escalation happens. Not retaining them in advance, but knowing the money is available.

### Post-launch first week

- Triage GitHub issues. Respond to everything, even if the answer is "not this week."
- Respond to the Reddit post as long as comments come in (usually 2 to 3 days of tail).
- Watch Sentry for BYOK-related errors in real user traffic.
- If a Tonal employee reaches out: respond professionally, same day, no drama, save correspondence.
- Do NOT push non-critical code changes to the public repo during the first week. Hotfixes only. The version users see should be the version that was tested.
- After 24 hours, if r/tonal post is well-received, cross-post to r/selfhosted.

---

## Pre-Publish Checklist (Consolidated)

Engineering:

- [ ] `@convex-dev/agent` per-request provider spike complete
- [ ] Schema fields added to `userProfiles` (`geminiApiKeyEncrypted`, `geminiApiKeyAddedAt`)
- [ ] Encryption/decryption helpers for user API keys
- [ ] BYOK settings page (save, test, remove)
- [ ] BYOK onboarding step (required for new users)
- [ ] Agent hot path refactored to per-request provider resolution
- [ ] Grandfathering gate by `_creationTime`
- [ ] `BYOK_DISABLED` kill switch env var
- [ ] Error sanitization layer for Google AI errors
- [ ] Five failure-mode UX components (invalid / quota / network / safety / model)
- [ ] 50-user beta cap removed (client + server)
- [ ] Admin impersonation removed from `getEffectiveUserId`
- [ ] Privileged-access audit complete; all non-essential admin capabilities removed
- [ ] Unit and integration tests green
- [ ] Manual QA on a fresh hosted test account

Security and secrets:

- [ ] Gitleaks audit of existing private repo history
- [ ] `TOKEN_ENCRYPTION_KEY` rotated via migration script
- [ ] `PROGRESS_PHOTOS_ENCRYPTION_KEY` rotated via migration script
- [ ] All Category B API credentials rotated (Google AI, Resend, Google OAuth, Sentry, PostHog, Convex deploy key)
- [ ] Convex prod database backup via `npx convex export` (stored outside repo)
- [ ] Sentry scrubbing rules updated to redact Gemini key format

Repo and cleanup:

- [ ] `git filter-repo` exclusion list drafted and reviewed
- [ ] `git filter-repo` run against fresh clone of private repo
- [ ] Gitleaks re-run against cleaned repo (must be clean)
- [ ] Manual review of every file and commit message in cleaned tree
- [ ] New private repo created on GitHub
- [ ] Final review in GitHub UI
- [ ] Existing private repo stripped to iOS only

Documentation and legal:

- [ ] LICENSE file (MIT)
- [ ] README rewritten (iOS removed, self-host setup, disclaimer, project status, support section)
- [ ] Tonal disclaimer in README, LICENSE, app footer, GitHub repo description
- [ ] Exact Tonal legal entity name verified from Tonal's own terms/privacy
- [ ] SECURITY.md added
- [ ] `.github/FUNDING.yml` added
- [ ] GitHub Sponsors identity verification complete
- [ ] Buy Me a Coffee account live
- [ ] `package.json` updated (remove `private`, add license, repository, homepage)
- [ ] `.env.example` verified current
- [ ] Two README screenshots captured and committed to `public/readme/` or `assets/`

Launch:

- [ ] Grandfathered test account created on production (before `BYOK_REQUIRED_AFTER` is set)
- [ ] Reddit post body drafted and sat on for 48 hours
- [ ] r/tonal rules read; mods contacted if rules ambiguous
- [ ] Reddit account selected (real history, not throwaway)
- [ ] C&D response template drafted and saved in `tonal-correspondence/`
- [ ] Launch-day smoke test plan written
- [ ] In-app banner component built and ready to deploy

---

## Risks

1. **`@convex-dev/agent` does not support per-request provider construction.** Mitigation: spike is the first engineering task. If blocked, fall back to a provider wrapper or a thin fork. Can also degrade to Approach A (no BYOK, close new signups) as last resort.
2. **Google AI error messages leak the plaintext key.** Mitigation: explicit sanitization layer with tests that prove it strips keys from error bodies.
3. **Trailing whitespace / newlines on pasted keys.** Mitigation: auto-trim on save. (This bug class bit a previous PostHog token integration; not repeating.)
4. **Encryption key rotation breaks all 50 users' Tonal connections.** Mitigation: transitional dual-key migration, test on a backup first, verify with a grandfathered user before rolling out.
5. **Tonal sends a cease-and-desist within 48 hours.** Mitigation: pre-drafted response template, pre-committed response strategy, correspondence folder ready, IP attorney budget identified.
6. **r/tonal removes the post as self-promo.** Mitigation: read rules first, modmail in advance if ambiguous. If post is removed, cross-post to r/selfhosted as backup.
7. **BYOK onboarding friction loses new users.** Acceptable: users unwilling to get a Google AI key are the users who would have cost the operator money. Self-host is still the free path.
8. **Admin impersonation removal blocks a future support need.** Mitigation: Convex dashboard read access covers most debug cases. If visual UI debugging is truly needed, can be rebuilt in a local dev deployment with copied data.
9. **Gitleaks misses a secret that ends up in the public repo.** Mitigation: the secret rotation happens regardless (safe route), so any leaked secret is already invalid by the time the public repo is live.
10. **Reddit traffic spikes overwhelm the Convex free-tier quotas.** Mitigation: monitor Convex dashboard during the first 4 hours; upgrade plan if spikes warrant. New users are BYOK so their Gemini usage does not drive operator cost, only Convex quota.

## Open Questions

1. **Exact legal entity name for Tonal** (verify from Tonal's privacy policy before drafting the disclaimer)
2. **Confirmation that `@convex-dev/agent` supports per-request provider construction** (spike output, early in implementation)
3. **Does r/tonal's self-promotion policy allow this post?** (modmail check)
4. **Are there other privileged admin capabilities beyond impersonation that need removal or gating?** (output of the privileged-access audit)

## Timeline

Not committed to a calendar date in this spec. The implementation plan will break the work into executable steps with their own sequencing. The spec scopes the work; the plan scopes the schedule.
