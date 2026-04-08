# Security

## Supported versions

Security fixes are provided on a best-effort basis for:

| Version            | Supported |
| ------------------ | --------- |
| `main`             | Yes       |
| older tags / forks | No        |

## Reporting a vulnerability

If you've found a security issue, do not open a public GitHub issue.

Email the maintainer at `jeff.tonalcoach@gmail.com` with:

- a clear description of the issue
- reproduction steps or a proof of concept
- impact assessment
- any suggested remediation

You'll get an initial response within 7 days on a best-effort basis. There is no bug bounty program, but reports are taken seriously and reporters who want credit will be credited unless they request otherwise.

## Scope and expectations

- Public disclosure should wait until a fix or mitigation is available.
- Self-hosted deployments are responsible for their own infrastructure security, secret management, and access control.
- Third-party platforms such as Tonal, Google AI Studio, Convex, Resend, and Vercel have their own security boundaries and incident processes.

## Data handling

The project encrypts sensitive data at rest (Tonal OAuth tokens and bring-your-own-key Gemini API keys) using AES-256-GCM via the Web Crypto API. See `convex/tonal/encryption.ts` for the implementation.

For context on the open-source data-handling model, see [docs/trust-model.md](docs/trust-model.md).
