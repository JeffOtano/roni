# Trust Model

Tonal Coach is open source so users can inspect how credentials, workout data,
and AI keys are handled before deciding to use the hosted product or self-host
their own copy.

## What the app stores

- Tonal OAuth access and refresh tokens
- Tonal profile, workout history, strength scores, and related training data
- Optional bring-your-own-key Gemini API key
- User-provided onboarding answers, goals, injuries, and coach feedback

## What the app does not store

- Tonal account passwords
- Google AI Studio account passwords
- Infrastructure credentials for services you self-host outside this repository

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
