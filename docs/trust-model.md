# Trust Model

Roni is open source so users can inspect how credentials, workout data,
and AI keys are handled before deciding to use the hosted product or self-host
their own copy.

## What the app stores

- Tonal OAuth access and refresh tokens
- Tonal profile, workout history, strength scores, and related training data
- Optional bring-your-own-key Gemini API key
- User-provided onboarding answers, goals, injuries, and coach feedback
- Per-turn AI telemetry rows (`aiRun`, `aiToolCalls`) with tool sequences, token counts, finish reasons, and bounded tool-argument / tool-result previews

## What the app does not store

- Tonal account passwords
- Google AI Studio account passwords
- Infrastructure credentials for services you self-host outside this repository

## What the app sends to third parties

When the operator configures `PHOENIX_API_KEY`, the AI coach streams full OpenTelemetry traces to Arize Phoenix Cloud for each user turn. Each trace includes:

- The user's chat message and any attached-image metadata
- The assembled system prompt, including a training snapshot (workout history summary, strength scores, goals, injuries)
- The full message history sent to the model
- Tool calls, their arguments, and their results
- The assistant's response text
- Model id, provider, token counts, latency, retry/fallback state

Secrets are scrubbed before leaving the backend: decrypted Tonal tokens, Gemini API keys (house key or BYOK), auth headers, and similar credentials never reach Phoenix. See `convex/ai/byokErrors.ts` and `convex/ai/resilience.ts` for the sanitization boundaries.

Phoenix Cloud is optional. Self-hosters who omit `PHOENIX_API_KEY` get a no-op tracer and no external telemetry export. Hosted users depend on the operator's Phoenix configuration — see the hosted-deployment assumptions below.

PostHog, when enabled, receives product-analytics events only (page views, event counts, response-time aggregates). It no longer receives raw AI content.

## Sensitive data protections

- Tonal OAuth tokens and BYOK Gemini API keys are encrypted at rest
- The app uses AES-256-GCM via the Web Crypto API for application-layer
  encryption before storage
- Self-hosters control their own Convex, Vercel, and email-provider accounts

## Hosted deployment trust assumptions

If you use the hosted deployment, you are trusting the operator to:

- deploy code that matches the public repository
- manage production infrastructure and environment variables responsibly
- respond to security issues in good faith

Open source reduces but does not eliminate operator trust. Hosted users still
depend on the operator's deployed configuration and infrastructure hygiene.

## Self-hosted deployment trust assumptions

If you self-host, you remove most operator trust and instead trust:

- your own infrastructure configuration
- the upstream dependencies used by the project
- Tonal, Google AI Studio, Convex, Vercel, Resend, and any other third-party
  providers you choose to use

## Practical guidance

- Review [SECURITY.md](../SECURITY.md) before reporting vulnerabilities
- Read [README.md](../README.md) before self-hosting
- Rotate secrets immediately if you suspect compromise
- Treat `.env.local`, Convex secrets, and deployment keys as production secrets
