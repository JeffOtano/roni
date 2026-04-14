# Changelog

All notable changes to this project are documented here. This file is maintained automatically by [release-please](https://github.com/googleapis/release-please) from Conventional Commits on `main`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0](https://github.com/JeffOtano/tonal-coach/compare/v0.1.1...v0.2.0) (2026-04-13)


### Features

* background data sync for initial Tonal history import ([#114](https://github.com/JeffOtano/tonal-coach/issues/114)) ([21e3170](https://github.com/JeffOtano/tonal-coach/commit/21e31702eac85cd987ce2fd63b3b6b6b0db10e3e))
* multi-provider support (Gemini, Claude, OpenAI, OpenRouter) ([#106](https://github.com/JeffOtano/tonal-coach/issues/106)) ([939fc22](https://github.com/JeffOtano/tonal-coach/commit/939fc22eac276131607b6c1d83df62887ef4e151))
* use quality-first provider defaults ([#110](https://github.com/JeffOtano/tonal-coach/issues/110)) ([cfb7991](https://github.com/JeffOtano/tonal-coach/commit/cfb799155a6186a378777e5b7d6a114587391ea4))
* visual confirmation banners for coach actions ([#113](https://github.com/JeffOtano/tonal-coach/issues/113)) ([4f78094](https://github.com/JeffOtano/tonal-coach/commit/4f78094fdc23a35d297939f8439835fc0cda58c1))


### Bug Fixes

* address 5 Sentry issues across AI, cache, and proxy layers ([#112](https://github.com/JeffOtano/tonal-coach/issues/112)) ([1e0bb71](https://github.com/JeffOtano/tonal-coach/commit/1e0bb71ee33a6765afcf7a6f8a8c9585550dc346))
* merge consecutive same-role messages for Gemini turn alternation ([#111](https://github.com/JeffOtano/tonal-coach/issues/111)) ([d19f0cf](https://github.com/JeffOtano/tonal-coach/commit/d19f0cf5d5937e62f3b3b322ed083023a8cf9720))

## [0.1.1](https://github.com/JeffOtano/tonal-coach/compare/v0.1.0...v0.1.1) (2026-04-12)

### Bug Fixes

- pre-warm chat cache keys during Tonal backfill ([#94](https://github.com/JeffOtano/tonal-coach/issues/94)) ([2395cc4](https://github.com/JeffOtano/tonal-coach/commit/2395cc4a17c902fddd55dbbd377e7fa379d89758))
- unblock coach freeze for users with large Tonal history ([#92](https://github.com/JeffOtano/tonal-coach/issues/92)) ([41b8ab6](https://github.com/JeffOtano/tonal-coach/commit/41b8ab6b61407ad164962f51717c3de382531739))

### Documentation

- add release version badge to README ([e341eb0](https://github.com/JeffOtano/tonal-coach/commit/e341eb01fe3c7bc01ac10093ff4ade0ec4c76da5))

## 0.1.0 (2026-04-11)

Initial public open-source release.
