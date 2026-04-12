# Releasing

This repository uses [release-please](https://github.com/googleapis/release-please) to automate versioning, tagging, and release notes from [Conventional Commits](https://www.conventionalcommits.org/) on `main`.

## How a release happens

1. Contributors (and the maintainer) land Conventional Commits on `main` via pull request. Commitlint blocks non-conforming subjects.
2. The `release-please` workflow runs on every push to `main`. It reads commits since the last tag and decides whether a release is warranted:
   - `feat:` commits bump the minor version (e.g., `0.1.0` -> `0.2.0`)
   - `fix:` commits bump the patch version (e.g., `0.1.0` -> `0.1.1`)
   - `BREAKING CHANGE` footers also bump the minor version while the project is pre-1.0
   - `docs:` / `chore:` / `refactor:` / `test:` / `ci:` / `build:` commits alone do not trigger a release
3. When a release is warranted, release-please opens (or updates) a pull request titled `chore(main): release X.Y.Z`. This PR:
   - Bumps `version` in `package.json`
   - Regenerates `CHANGELOG.md` with categorized sections
   - Updates `.release-please-manifest.json`
4. The maintainer reviews and merges the release PR.
5. On merge, release-please creates the annotated `vX.Y.Z` tag and publishes a GitHub Release with notes sourced from the changelog.

## Configuration

- [`release-please-config.json`](./release-please-config.json) - release-type, section names, pre-major bump behavior
- [`.release-please-manifest.json`](./.release-please-manifest.json) - current released version per package
- [`.github/workflows/release-please.yml`](./.github/workflows/release-please.yml) - workflow that runs on push to `main`

## Pre-1.0 versioning

While the project is pre-1.0, `bump-minor-pre-major` is set so that breaking changes bump the minor version instead of jumping to `1.0.0`. The jump to `1.0.0` will be intentional and coordinated.

## Manual intervention

If you need to override what release-please wants to do, you have two options:

- **Amend the release PR.** You can hand-edit `CHANGELOG.md`, version numbers, or notes on the open release PR before merging. release-please will pick up your edits.
- **Use a `Release-As` commit footer.** Include `Release-As: 1.0.0` in a commit message to force the next release to a specific version. See the [release-please docs](https://github.com/googleapis/release-please#how-can-i-manage-a-breaking-change-release-to-1x) for details.

## Notes

- The release PR still requires one approving review to merge because of branch protection. Approve and merge it yourself.
- If a release contains security fixes, coordinate disclosure timing with [SECURITY.md](SECURITY.md) before merging the release PR.
