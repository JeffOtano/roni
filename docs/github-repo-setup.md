# GitHub Repo Setup

This repo already versions the contributor-facing files and automation:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `SUPPORT.md`
- `.github/CODEOWNERS`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- `.github/workflows/*.yml`
- `.github/dependabot.yml`
- `.github/release-drafter.yml`

What still has to be configured in GitHub is the repository settings and the `main` branch rules.

## One-time maintainer setup

### 1. Apply the repo defaults

Run:

```bash
./scripts/configure-github-repo.sh
```

That script:

- enables squash-only merges
- enables automatic branch deletion after merge
- keeps the OSS labels used by issue templates and Release Drafter in sync
- applies baseline classic protection to `main`

### 2. Create a `main` branch ruleset

GitHub does not store branch protection in git. Configure this in:

`Settings -> Rules -> Rulesets -> New branch ruleset`

The setup script protects `main` with the classic branch protection API so the branch is not left open, but the ruleset should be treated as the final GitHub-side source of truth.

Use these settings:

- Ruleset name: `Protect main`
- Enforcement status: `Active`
- Target branches: `main`
- Bypass list: repository admins only

Enable these rules:

- Restrict deletions
- Block force pushes
- Require a pull request before merging
- Require approvals: `1`
- Dismiss stale pull request approvals when new commits are pushed
- Require review from Code Owners
- Require conversation resolution before merging
- Require branches to be up to date before merging
- Require linear history

### 3. Require status checks

After the first green pull request run, add the checks that appear in the GitHub UI. For this repo, the expected checks are:

- `CI / Lint & Format`
- `CI / Type Check`
- `CI / Test`
- `CI / Build`
- `CI / Security Audit`
- `CI / E2E Smoke`
- `Dependency Review / dependency-review`
- `CodeQL / Analyze`

GitHub sometimes shows slightly different check names, so select the exact names from a completed PR rather than typing them from memory.

### 4. Verify merge settings

In `Settings -> General`, use:

- Default branch: `main`
- Allow squash merging: enabled
- Allow merge commits: disabled
- Allow rebase merging: disabled
- Automatically delete head branches: enabled

### 5. Verify security automation

In `Security -> Code security and analysis`, enable or verify:

- Dependabot alerts
- Dependabot security updates
- Secret scanning, if available for the repo plan

`CodeQL` and dependency review are already checked in as GitHub Actions workflows.

## Labels used by automation

These labels should exist because templates and Release Drafter depend on them:

- `bug`
- `enhancement`
- `feature`
- `docs`
- `chore`
- `refactor`
- `test`
- `major`
- `breaking`

The setup script keeps these labels in sync.
