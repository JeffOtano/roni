#!/usr/bin/env bash

set -euo pipefail

repo_arg="${1:-}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

infer_repo() {
  local remote_url

  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$remote_url" ]]; then
    echo "Could not infer the GitHub repo from origin. Pass owner/repo explicitly." >&2
    exit 1
  fi

  case "$remote_url" in
    git@github.com:*)
      remote_url="${remote_url#git@github.com:}"
      remote_url="${remote_url%.git}"
      ;;
    https://github.com/*)
      remote_url="${remote_url#https://github.com/}"
      remote_url="${remote_url%.git}"
      ;;
    git+https://github.com/*)
      remote_url="${remote_url#git+https://github.com/}"
      remote_url="${remote_url%.git}"
      ;;
    *)
      echo "Unsupported Git remote format: $remote_url" >&2
      exit 1
      ;;
  esac

  echo "$remote_url"
}

sync_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  gh label create "$name" \
    --repo "$repo" \
    --color "$color" \
    --description "$description" \
    --force >/dev/null
}

protect_main_branch() {
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/$repo/branches/main/protection" \
    --input - >/dev/null <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
}

require_command gh
require_command git

gh auth status >/dev/null

repo="${repo_arg:-$(infer_repo)}"

echo "Configuring GitHub repository settings for $repo"

gh repo edit "$repo" \
  --default-branch main \
  --enable-squash-merge \
  --disable-merge-commit \
  --disable-rebase-merge \
  --delete-branch-on-merge

sync_label "bug" "d73a4a" "Something is broken"
sync_label "enhancement" "a2eeef" "Improvement to an existing capability"
sync_label "feature" "1d76db" "Net-new user-facing capability"
sync_label "docs" "0075ca" "Documentation changes"
sync_label "chore" "c5def5" "Maintenance work with no product behavior change"
sync_label "refactor" "bfdadc" "Code restructuring without behavior change"
sync_label "test" "5319e7" "Test coverage or test infrastructure"
sync_label "major" "b60205" "Major release or breaking scope"
sync_label "breaking" "b60205" "Introduces a breaking change"

protect_main_branch

cat <<EOF
Repository defaults, labels, and baseline classic protection for main are configured.

Next steps in the GitHub UI:
1. Go to Settings -> Rules -> Rulesets and confirm the main ruleset matches docs/github-repo-setup.md.
2. Add required status checks from a completed green pull request run.
3. Verify Security -> Code security and analysis settings are enabled.
EOF
