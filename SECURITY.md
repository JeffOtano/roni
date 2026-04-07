# Security

If you've found a security issue, please do not open a public GitHub issue.

Email the maintainer at [REPLACE_WITH_SECURITY_EMAIL] with the details. You'll get a response within 7 days on a best-effort basis. This is a personal project with no bug bounty program, but security reports are taken seriously and reporters who want credit will be credited.

The project encrypts sensitive data at rest (Tonal OAuth tokens, Google Calendar OAuth tokens, and bring-your-own-key Gemini API keys) using AES-256-GCM via the Web Crypto API. See `convex/tonal/encryption.ts` for the implementation.

For context on the trust model behind the open-source release, see `docs/superpowers/specs/2026-04-07-open-source-release-design.md` in this repository.
