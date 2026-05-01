# Changelog

All notable changes to this project are documented here. This file is maintained automatically by [release-please](https://github.com/googleapis/release-please) from Conventional Commits on `main`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.8.0](https://github.com/JeffOtano/roni/compare/v0.7.0...v0.8.0) (2026-05-01)


### Features

* **coach-tools:** add rebuild_day tool for full-block authoring inside the week plan ([#307](https://github.com/JeffOtano/roni/issues/307)) ([394d11d](https://github.com/JeffOtano/roni/commit/394d11d5ecd066027f2cac5a9420eb0b759be707))
* **coach-tools:** add set_warmup_block tool for multi-exercise warmups ([#306](https://github.com/JeffOtano/roni/issues/306)) ([cd64aa6](https://github.com/JeffOtano/roni/commit/cd64aa6ceb8297f12651b0417f28776d3749f99b))
* **coach-tools:** expose warmUp flag on add_exercise tool ([#302](https://github.com/JeffOtano/roni/issues/302)) ([14a2b65](https://github.com/JeffOtano/roni/commit/14a2b6587ac0b89f6697bf0a96900f6d391aa485))
* **coach-tools:** tighten descriptions to disambiguate workout-info tools ([#311](https://github.com/JeffOtano/roni/issues/311)) ([102af06](https://github.com/JeffOtano/roni/commit/102af066fa7d62cac8d1d55fd630bf3406e104b1))
* **coach-tools:** tighten search_exercises (name-strict mode + trainingType allowlist) ([#303](https://github.com/JeffOtano/roni/issues/303)) ([ba368bf](https://github.com/JeffOtano/roni/commit/ba368bf4070a9be5f35e92ca77b23709b8e6f710))
* **coach:** surface degenerate exercise selection from program_week ([#305](https://github.com/JeffOtano/roni/issues/305)) ([2054788](https://github.com/JeffOtano/roni/commit/20547881e52d451ba079534c4f1b8a03ceb8e147))
* **tonal:** real push verification — diff stored workout against intent ([#308](https://github.com/JeffOtano/roni/issues/308)) ([1757768](https://github.com/JeffOtano/roni/commit/1757768727ea8e68189df978b48637e14d4a8f26))


### Bug Fixes

* **backend:** guard action loops against timeout and fix Zod schema ([#301](https://github.com/JeffOtano/roni/issues/301)) ([851f6dc](https://github.com/JeffOtano/roni/commit/851f6dc31f29f4ad23a24d3096d48bf2fff0ad7f))
* **coach:** guard add_exercise against silent block drop and surface post-write counts ([#304](https://github.com/JeffOtano/roni/issues/304)) ([341bbe2](https://github.com/JeffOtano/roni/commit/341bbe2f86c60a623319c1d473c534773d2c68ef))
* **coach:** increase Tonal push gap from 2s to 5s ([#309](https://github.com/JeffOtano/roni/issues/309)) ([42f7142](https://github.com/JeffOtano/roni/commit/42f714205d93a82e86a5a149e7f6f90bd3ed3ffd))
* **coachState:** widen aiRun.snapshotSource validator to unblock prod deploy ([#298](https://github.com/JeffOtano/roni/issues/298)) ([3b87ecd](https://github.com/JeffOtano/roni/commit/3b87ecd41e2abea322b9355f2e4e6297b080cad0))
* resolve three production Sentry issues (TONALCOACH-17, 1C, 3V) ([#315](https://github.com/JeffOtano/roni/issues/315)) ([0d5cb07](https://github.com/JeffOtano/roni/commit/0d5cb07096c598a64685fe14e464553a9b296557))
* sync sentryBeforeSend filter list with posthogBeforeSend ([#317](https://github.com/JeffOtano/roni/issues/317)) ([5afd27d](https://github.com/JeffOtano/roni/commit/5afd27d760a92d2e5d7c771c7727103b76580907))
* **tonal:** reject empty estimate payloads + return structured error to LLM ([#310](https://github.com/JeffOtano/roni/issues/310)) ([da34cb5](https://github.com/JeffOtano/roni/commit/da34cb55a645133ee37eadf035635c626361f99d))
* **workoutDetail:** split into internal+public actions to fix LLM tool auth ([#313](https://github.com/JeffOtano/roni/issues/313)) ([96677ce](https://github.com/JeffOtano/roni/commit/96677ce45f8d11d27600d76a591da001148b2e2b))


### Refactoring

* **coachState:** collapse 10-runQuery fan-out into single internalQuery ([#295](https://github.com/JeffOtano/roni/issues/295)) ([0ca0696](https://github.com/JeffOtano/roni/commit/0ca069649faa17418de1f1c7f3c4afc563ef26fa))
* **coachState:** re-narrow aiRun.snapshotSource to live_rebuild ([#299](https://github.com/JeffOtano/roni/issues/299)) ([52990fd](https://github.com/JeffOtano/roni/commit/52990fd0c69dc75ac3a5877d3205b9cbf584d39b))

## [0.7.0](https://github.com/JeffOtano/roni/compare/v0.6.0...v0.7.0) (2026-04-28)


### Features

* gracefully disable Garmin when deployment is not configured ([7cd202d](https://github.com/JeffOtano/roni/commit/7cd202de23e5d567ff96061b379c77dea2ae4612))


### Bug Fixes

* batch resolve 2 PostHog production errors (g1 history ordering + g2 quota retry) ([#289](https://github.com/JeffOtano/roni/issues/289)) ([a59594e](https://github.com/JeffOtano/roni/commit/a59594e961cd469923bd7521af9890f7cd3cf377))
* batch resolve top PostHog production errors ([#291](https://github.com/JeffOtano/roni/issues/291)) ([c84c760](https://github.com/JeffOtano/roni/commit/c84c76065cd27d703754e8fe9e743ac9f8b48e70))
* resolve 5 Sentry production errors (TONALCOACH-3P/1H/3M/12/17) ([#288](https://github.com/JeffOtano/roni/issues/288)) ([3af0285](https://github.com/JeffOtano/roni/commit/3af0285bc376e43b0114750085d70a900f34f372))


### Performance Improvements

* cut Convex bill via memoization, longer TTLs, circuit breaker removal ([#294](https://github.com/JeffOtano/roni/issues/294)) ([9bed92b](https://github.com/JeffOtano/roni/commit/9bed92b2f6bbc4f821b8046c2858df06f2791f8d))
* halve refresh-tonal-cache cadence to cut Convex billing ([#293](https://github.com/JeffOtano/roni/issues/293)) ([2fb2271](https://github.com/JeffOtano/roni/commit/2fb227110780aa88873496abb499ab408c860bb7))

## [0.6.0](https://github.com/JeffOtano/roni/compare/v0.5.0...v0.6.0) (2026-04-26)


### Features

* **ai:** add aiRun telemetry table for per-turn observability ([#249](https://github.com/JeffOtano/roni/issues/249)) ([f61df11](https://github.com/JeffOtano/roni/commit/f61df11e238dec0d5e7cbd57e0eefec3566b699f))
* **ai:** attribute transient provider outages to the upstream, not Roni ([#254](https://github.com/JeffOtano/roni/issues/254)) ([fde6ec9](https://github.com/JeffOtano/roni/commit/fde6ec966bf80051f6f450c4af0cec77b65fbc09))
* **ai:** internalQuery to measure cache hit rate by provider ([#262](https://github.com/JeffOtano/roni/issues/262)) ([5ad9d14](https://github.com/JeffOtano/roni/commit/5ad9d14d0004d93800d661664fe5e95c481df18f))
* **ai:** migrate AI observability from PostHog to Phoenix Cloud ([#251](https://github.com/JeffOtano/roni/issues/251)) ([946053c](https://github.com/JeffOtano/roni/commit/946053c5193639bfa8d5d84f8f2df1d8acae892b))
* **ai:** wire PostHog LLM Analytics via Vercel AI SDK telemetry ([#246](https://github.com/JeffOtano/roni/issues/246)) ([749930d](https://github.com/JeffOtano/roni/commit/749930d39712898cfbd3dc481f3c00a2546e6458))
* **evals:** gate nightly experiment on evaluator scores ([#266](https://github.com/JeffOtano/roni/issues/266)) ([5863b65](https://github.com/JeffOtano/roni/commit/5863b657f8b10c0bc9e571334bf8e45a1395b660))
* **garmin:** harden integration and dashboard UX ([#273](https://github.com/JeffOtano/roni/issues/273)) ([8ec425d](https://github.com/JeffOtano/roni/commit/8ec425de386e1206f876063f42226dac84e3887c))
* **nav:** drop /prs from nav, elevate Dashboard PR tile as the destination ([#247](https://github.com/JeffOtano/roni/issues/247)) ([2b7f1a0](https://github.com/JeffOtano/roni/commit/2b7f1a0b554c81de79054f5c21b5a06171b64267))


### Bug Fixes

* **ai:** place training snapshot in system prefix (Gemini rejects mid-conversation system messages) ([#259](https://github.com/JeffOtano/roni/issues/259)) ([f052d0d](https://github.com/JeffOtano/roni/commit/f052d0db5dad8c1d409b3f6fbbdd3c885851c621))
* **dashboard:** workout date shows 'yesterday' instead of 'today' for same-day workouts ([#250](https://github.com/JeffOtano/roni/issues/250)) ([f7c5d40](https://github.com/JeffOtano/roni/commit/f7c5d40e65ff3c54edfe3a93c584382b50467f44))
* **tonal:** accept optional prescribedReps on workout set activity ([#248](https://github.com/JeffOtano/roni/issues/248)) ([6946df7](https://github.com/JeffOtano/roni/commit/6946df7b0fa7f8a4d616f32e0c6ea4bc29774b75))
* triage 7 Sentry issues (~1500 events, 30+ users) ([#244](https://github.com/JeffOtano/roni/issues/244)) ([3190a77](https://github.com/JeffOtano/roni/commit/3190a777969096631d564a0f46235da82f61e32e))
* workout program names in history ([#263](https://github.com/JeffOtano/roni/issues/263)) ([be6c55d](https://github.com/JeffOtano/roni/commit/be6c55df46c9713e4a294753c79136ed1edaec55))


### Performance Improvements

* **ai:** move training snapshot out of the cached system prefix ([#256](https://github.com/JeffOtano/roni/issues/256)) ([f235549](https://github.com/JeffOtano/roni/commit/f2355499339aeb76d70eb9e06e500de52761607b))
* **ai:** provider-aware snapshot placement + last-assistant cache marker for claude ([#261](https://github.com/JeffOtano/roni/issues/261)) ([a39d051](https://github.com/JeffOtano/roni/commit/a39d051e74382cc2aea540ce7624f5ca929701bc))
* **ai:** remove exercise catalog from snapshot ([#264](https://github.com/JeffOtano/roni/issues/264)) ([f3448b6](https://github.com/JeffOtano/roni/commit/f3448b68a40f229a4e5742110840c139dda98ed3))
* **ai:** stack 3 anthropic cache breakpoints across tools, system, history ([#260](https://github.com/JeffOtano/roni/issues/260)) ([82ffe31](https://github.com/JeffOtano/roni/commit/82ffe31269563c067fb2c6c69961ea0febfdc64a))
* bound telemetry table growth and shrink tool previews ([#271](https://github.com/JeffOtano/roni/issues/271)) ([1505644](https://github.com/JeffOtano/roni/commit/1505644cf76f4b9e19c7ae1bf4c79b11cd2f1e62))
* drop redundant by_userId indexes covered by compounds ([#270](https://github.com/JeffOtano/roni/issues/270)) ([84de302](https://github.com/JeffOtano/roni/commit/84de302ab3a54178aedcf7eff26c3bf62469289f))
* project Tonal proxy cache payloads to fields readers use ([#269](https://github.com/JeffOtano/roni/issues/269)) ([237bf5d](https://github.com/JeffOtano/roni/commit/237bf5d0aa9e9d832fcf0edf125ad992d47f9fd6))
* reduce Convex background sync churn ([#267](https://github.com/JeffOtano/roni/issues/267)) ([6975b93](https://github.com/JeffOtano/roni/commit/6975b933d52c8297f2d8c7c2b8dbb0c349c7c303))
* split high-churn user activity state out of userProfiles ([#272](https://github.com/JeffOtano/roni/issues/272)) ([e2ccb73](https://github.com/JeffOtano/roni/commit/e2ccb738ad7c8fdd139c9da694007ef1412c4636))
* tier background sync cadence by recent app activity ([#268](https://github.com/JeffOtano/roni/issues/268)) ([81fd9fa](https://github.com/JeffOtano/roni/commit/81fd9fa3933572f6088ef99671f0c3839e645baf))


### Documentation

* **privacy:** disclose garmin integration for partner review ([#257](https://github.com/JeffOtano/roni/issues/257)) ([8db8e35](https://github.com/JeffOtano/roni/commit/8db8e357ae2341c13df15d8eb09c9063899e218c))

## [0.5.0](https://github.com/JeffOtano/roni/compare/v0.4.0...v0.5.0) (2026-04-20)


### Features

* add npm run setup interactive contributor bootstrap ([#177](https://github.com/JeffOtano/roni/issues/177)) ([8bf7d30](https://github.com/JeffOtano/roni/commit/8bf7d30e2389f2a0cd27e6640ca1c986431f5603))
* PR tracking with materialized personal records (aggregate) ([#226](https://github.com/JeffOtano/roni/issues/226)) ([4c4919a](https://github.com/JeffOtano/roni/commit/4c4919aa8abfb5d5b22586392f3cffddc8aace20))


### Bug Fixes

* **auth:** return existingUserId on update path ([#228](https://github.com/JeffOtano/roni/issues/228)) ([7ed9b41](https://github.com/JeffOtano/roni/commit/7ed9b41619e475a2d69b5004b48335641b4c5190))
* close retry-push race that could revert a successful push ([#184](https://github.com/JeffOtano/roni/issues/184)) ([d256a89](https://github.com/JeffOtano/roni/commit/d256a8949ef376fcf45c7023c6812c4c72092cbc))
* evict oversized cache reads and guard oversized writes in tonal proxy ([#221](https://github.com/JeffOtano/roni/issues/221)) ([39a2ec9](https://github.com/JeffOtano/roni/commit/39a2ec92b95be29ede75880efb0b493eed646350))
* paginate dev-tools cache and shrink tonalCache delete batch ([#178](https://github.com/JeffOtano/roni/issues/178)) ([3f59b7a](https://github.com/JeffOtano/roni/commit/3f59b7ab55fab704a36e8c3fe99da62d3a037c4c))
* recover scheduled chat failures ([#217](https://github.com/JeffOtano/roni/issues/217)) ([9d75ae6](https://github.com/JeffOtano/roni/commit/9d75ae63d984508c44f225cb68e0b4b741649608))
* **reset-password:** stop form remounting on every keystroke ([#227](https://github.com/JeffOtano/roni/issues/227)) ([d0b2017](https://github.com/JeffOtano/roni/commit/d0b2017b5b10fe75d58d02cb33ded10b2b670f11))
* route workflow PostHog capture through action step ([#220](https://github.com/JeffOtano/roni/issues/220)) ([c8454f5](https://github.com/JeffOtano/roni/commit/c8454f5f8313c92955666a2f2dde843093d02680))
* suppress Sentry noise from control-flow sentinels and Tonal credential errors ([#219](https://github.com/JeffOtano/roni/issues/219)) ([8213c43](https://github.com/JeffOtano/roni/commit/8213c433af382330750dd9040a20619743d15890))
* surface BYOK errors and clean up orphaned pending messages ([#181](https://github.com/JeffOtano/roni/issues/181)) ([a2ce13f](https://github.com/JeffOtano/roni/commit/a2ce13f5d98687383208b3f43ef5b0cc07314182))
* use hasOwnProperty.call for ES2021 compat in chatHelpers ([#218](https://github.com/JeffOtano/roni/issues/218)) ([b52bd66](https://github.com/JeffOtano/roni/commit/b52bd66dda99a8620bb3db0eeb92b14650b2272a))


### Performance Improvements

* **ai:** enable Anthropic prompt caching for static instructions + tools ([#186](https://github.com/JeffOtano/roni/issues/186)) ([9da3862](https://github.com/JeffOtano/roni/commit/9da3862eba0c205ab5c6f562e03f435a10d96cb5))
* batch sync RPCs, index workoutPlans queries, guard backfill loop ([#185](https://github.com/JeffOtano/roni/issues/185)) ([9ab234e](https://github.com/JeffOtano/roni/commit/9ab234e799ecd476a8d2ae5e7bf9caf0989aa3ba))


### Refactoring

* harden cron and admin reads against the 16 MiB limit ([#179](https://github.com/JeffOtano/roni/issues/179)) ([523bd5d](https://github.com/JeffOtano/roni/commit/523bd5d3b34e8484a375920ed48365f074b1dfec))
* rebrand from Tonal Coach / tonal.coach to Roni / roni.coach ([#156](https://github.com/JeffOtano/roni/issues/156)) ([55cb87a](https://github.com/JeffOtano/roni/commit/55cb87af83769823c07b135d374ecb327284e20f))
* simplify Tonal push + rename doTonalCreateWorkout ([#183](https://github.com/JeffOtano/roni/issues/183)) ([b38710e](https://github.com/JeffOtano/roni/commit/b38710e7f85412301c36a6957b6d3d36c977e173))
* **tonal:** tighten cache size budget and project workout meta payloads ([#224](https://github.com/JeffOtano/roni/issues/224)) ([0f19349](https://github.com/JeffOtano/roni/commit/0f19349f56baaee172801281c4b58f92724edd22))

## [0.4.0](https://github.com/JeffOtano/tonal-coach/compare/v0.3.0...v0.4.0) (2026-04-16)

### Features

- add hidden dev tools page for Tonal API inspection ([#175](https://github.com/JeffOtano/tonal-coach/issues/175)) ([5d8dc72](https://github.com/JeffOtano/tonal-coach/commit/5d8dc7276891cf55f2c8c4a7221d08a453b78f2f))
- added check in step to onboarding ([#168](https://github.com/JeffOtano/tonal-coach/issues/168)) ([3044532](https://github.com/JeffOtano/tonal-coach/commit/30445329c1a7d91189209b639ce9fd9a99964c53))
- background data sync + bug fixes ([#118](https://github.com/JeffOtano/tonal-coach/issues/118), [#119](https://github.com/JeffOtano/tonal-coach/issues/119), [#120](https://github.com/JeffOtano/tonal-coach/issues/120)) ([#121](https://github.com/JeffOtano/tonal-coach/issues/121)) ([9e18ea3](https://github.com/JeffOtano/tonal-coach/commit/9e18ea3a6a7f79a61305a1879ca820bd323c6a57))

### Bug Fixes

- batch account deletion to stay under 4096 read limit ([#154](https://github.com/JeffOtano/tonal-coach/issues/154)) ([3b9903b](https://github.com/JeffOtano/tonal-coach/commit/3b9903b0363743f023dab8fddda3127ab058eed7))
- cache lightweight Activity[] instead of raw WorkoutActivityDetail[] ([86bf09e](https://github.com/JeffOtano/tonal-coach/commit/86bf09e675a027eaac986a5af6ffa253f85df6c0))
- classify depleted Gemini credits as BYOK quota error ([#125](https://github.com/JeffOtano/tonal-coach/issues/125)) ([9ecd59a](https://github.com/JeffOtano/tonal-coach/commit/9ecd59aee3cd03c7b29a442e3c4ba68265aefeea))
- complete backfill after enrichment failures ([#160](https://github.com/JeffOtano/tonal-coach/issues/160)) ([747e298](https://github.com/JeffOtano/tonal-coach/commit/747e2988915cc85198b2dcc2c5ff1e0634242f52))
- compute avgWeightLbs from per-set avgWeight, not totalVolume ([#171](https://github.com/JeffOtano/tonal-coach/issues/171)) ([c670d6c](https://github.com/JeffOtano/tonal-coach/commit/c670d6c6ea6641dd3da53d3b0569a66a4c3c09ca))
- dashboard reads from sync tables instead of Tonal API proxy ([#123](https://github.com/JeffOtano/tonal-coach/issues/123)) ([ab568db](https://github.com/JeffOtano/tonal-coach/commit/ab568db1484ee32395f338380a1bd19bd0ccd54c))
- disable cron jobs in dev via DISABLE_CRONS env var ([#149](https://github.com/JeffOtano/tonal-coach/issues/149)) ([de37af0](https://github.com/JeffOtano/tonal-coach/commit/de37af06d8bf59b4b44bb6bb7aeb46549fb61474))
- double avgWeight for StraightBar exercises ([#134](https://github.com/JeffOtano/tonal-coach/issues/134)) ([#161](https://github.com/JeffOtano/tonal-coach/issues/161)) ([054e6d9](https://github.com/JeffOtano/tonal-coach/commit/054e6d92401440f82627e9a2022e1e9f02b62757))
- eliminate OCC contention on systemHealth table ([#152](https://github.com/JeffOtano/tonal-coach/issues/152)) ([9251bb0](https://github.com/JeffOtano/tonal-coach/commit/9251bb0edbf11e6fed2b7aa2bad0b280b1e55eed))
- filter ghost workout entries from recent workouts list ([#150](https://github.com/JeffOtano/tonal-coach/issues/150)) ([2b26645](https://github.com/JeffOtano/tonal-coach/commit/2b266454c1baac28327bc5da0d2b758fa8553556)), closes [#148](https://github.com/JeffOtano/tonal-coach/issues/148)
- improve tonalCache cleanup with index and daily cadence ([#165](https://github.com/JeffOtano/tonal-coach/issues/165)) ([fa2c2bf](https://github.com/JeffOtano/tonal-coach/commit/fa2c2bf49a2d20f3cb94d7e1a184024499b905aa)), closes [#164](https://github.com/JeffOtano/tonal-coach/issues/164)
- let 401 errors propagate to withTokenRetry for token refresh ([#162](https://github.com/JeffOtano/tonal-coach/issues/162)) ([0de3c1a](https://github.com/JeffOtano/tonal-coach/commit/0de3c1ae598c616cd9bb77cf5b6e94993087ae03))
- native-button errors ([#155](https://github.com/JeffOtano/tonal-coach/issues/155)) ([8ce62f2](https://github.com/JeffOtano/tonal-coach/commit/8ce62f2a5327a08f86206e73b3c9268e66729e32))
- page-by-page backfill to avoid 64MB OOM ([#153](https://github.com/JeffOtano/tonal-coach/issues/153)) ([1989582](https://github.com/JeffOtano/tonal-coach/commit/1989582a2eab9fdffbc43058ebc6ae892762fee8))
- pre-save user message to prevent triple Gemini API calls on retry ([#141](https://github.com/JeffOtano/tonal-coach/issues/141)) ([d375d9d](https://github.com/JeffOtano/tonal-coach/commit/d375d9d167609ea65d7438ce74c36f898da129d6))
- prompts for AI display workout plan errors ([#166](https://github.com/JeffOtano/tonal-coach/issues/166)) ([d4b179e](https://github.com/JeffOtano/tonal-coach/commit/d4b179e7c265a80b0bfb5dd686b5a30942d16b0d))
- reduce cache cleanup batch size to avoid 16MB read limit ([#167](https://github.com/JeffOtano/tonal-coach/issues/167)) ([7fdccb8](https://github.com/JeffOtano/tonal-coach/commit/7fdccb8085d7a2eff76b350762680d3a72076600))
- replace .filter() with index ranges and fix query patterns ([#174](https://github.com/JeffOtano/tonal-coach/issues/174)) ([1657372](https://github.com/JeffOtano/tonal-coach/commit/16573729ed02bf3041b2bb1393f6e27fc7849c04))
- retry on 429 rate limit and Gemini high demand errors ([#124](https://github.com/JeffOtano/tonal-coach/issues/124)) ([90247e9](https://github.com/JeffOtano/tonal-coach/commit/90247e96fd182683a3851259e69d279a0afa3fc6))
- security hardening ([#157](https://github.com/JeffOtano/tonal-coach/issues/157)) ([bfff2e5](https://github.com/JeffOtano/tonal-coach/commit/bfff2e5f24655d23ecf62b6b50d33b6224486f7a))
- strip orphaned tool calls from thread history ([#158](https://github.com/JeffOtano/tonal-coach/issues/158)) ([bba47bb](https://github.com/JeffOtano/tonal-coach/commit/bba47bb5667ee5dedf27efd8932e2e3045acd30b))
- surface failed async messages in chat UI ([#139](https://github.com/JeffOtano/tonal-coach/issues/139)) ([a28f04b](https://github.com/JeffOtano/tonal-coach/commit/a28f04b8a51d24356549546ab318c6ad755e9e89))
- switch workout history to /workout-activities endpoint ([#128](https://github.com/JeffOtano/tonal-coach/issues/128)) ([5c75ed3](https://github.com/JeffOtano/tonal-coach/commit/5c75ed356f52e313ccc908e2cdbc208b26224baf))
- timezone and validations ([#159](https://github.com/JeffOtano/tonal-coach/issues/159)) ([cf01caa](https://github.com/JeffOtano/tonal-coach/commit/cf01caaf5058d8f5ca22f7e92c45053db0183fc7))
- track tonal_connected event during onboarding flow ([502d295](https://github.com/JeffOtano/tonal-coach/commit/502d295af228ca373dee2a68a550cf3ec84b3d73))
- turn-aware context windowing for Gemini message ordering ([#169](https://github.com/JeffOtano/tonal-coach/issues/169)) ([06068b2](https://github.com/JeffOtano/tonal-coach/commit/06068b2c2cd3e705b2df43bc22d32a6d5fe9d531))
- use Chat Completions API for OpenRouter (not Responses API) ([7f603d5](https://github.com/JeffOtano/tonal-coach/commit/7f603d5a440e73fa5e1317186f86b16b5bf19cde))
- use recent-only fetch for incremental sync ([#142](https://github.com/JeffOtano/tonal-coach/issues/142)) ([e6bf53c](https://github.com/JeffOtano/tonal-coach/commit/e6bf53cb2a8a9cf3a2f3d4c67bf28810c2844aa3))
- workout sync for large histories + per-set weight display ([#130](https://github.com/JeffOtano/tonal-coach/issues/130)) ([04d4de9](https://github.com/JeffOtano/tonal-coach/commit/04d4de90b5441b6264dfe157f329d30c40498863))

## [0.3.0](https://github.com/JeffOtano/tonal-coach/compare/v0.2.0...v0.3.0) (2026-04-14)

### Features

- full workout history data export (CSV + JSON) ([#116](https://github.com/JeffOtano/tonal-coach/issues/116)) ([8ec5a91](https://github.com/JeffOtano/tonal-coach/commit/8ec5a91cbc692f998f27a2d923b0e6d25d36cfc9))

## [0.2.0](https://github.com/JeffOtano/tonal-coach/compare/v0.1.1...v0.2.0) (2026-04-13)

### Features

- background data sync for initial Tonal history import ([#114](https://github.com/JeffOtano/tonal-coach/issues/114)) ([21e3170](https://github.com/JeffOtano/tonal-coach/commit/21e31702eac85cd987ce2fd63b3b6b6b0db10e3e))
- multi-provider support (Gemini, Claude, OpenAI, OpenRouter) ([#106](https://github.com/JeffOtano/tonal-coach/issues/106)) ([939fc22](https://github.com/JeffOtano/tonal-coach/commit/939fc22eac276131607b6c1d83df62887ef4e151))
- use quality-first provider defaults ([#110](https://github.com/JeffOtano/tonal-coach/issues/110)) ([cfb7991](https://github.com/JeffOtano/tonal-coach/commit/cfb799155a6186a378777e5b7d6a114587391ea4))
- visual confirmation banners for coach actions ([#113](https://github.com/JeffOtano/tonal-coach/issues/113)) ([4f78094](https://github.com/JeffOtano/tonal-coach/commit/4f78094fdc23a35d297939f8439835fc0cda58c1))

### Bug Fixes

- address 5 Sentry issues across AI, cache, and proxy layers ([#112](https://github.com/JeffOtano/tonal-coach/issues/112)) ([1e0bb71](https://github.com/JeffOtano/tonal-coach/commit/1e0bb71ee33a6765afcf7a6f8a8c9585550dc346))
- merge consecutive same-role messages for Gemini turn alternation ([#111](https://github.com/JeffOtano/tonal-coach/issues/111)) ([d19f0cf](https://github.com/JeffOtano/tonal-coach/commit/d19f0cf5d5937e62f3b3b322ed083023a8cf9720))

## [0.1.1](https://github.com/JeffOtano/tonal-coach/compare/v0.1.0...v0.1.1) (2026-04-12)

### Bug Fixes

- pre-warm chat cache keys during Tonal backfill ([#94](https://github.com/JeffOtano/tonal-coach/issues/94)) ([2395cc4](https://github.com/JeffOtano/tonal-coach/commit/2395cc4a17c902fddd55dbbd377e7fa379d89758))
- unblock coach freeze for users with large Tonal history ([#92](https://github.com/JeffOtano/tonal-coach/issues/92)) ([41b8ab6](https://github.com/JeffOtano/tonal-coach/commit/41b8ab6b61407ad164962f51717c3de382531739))

### Documentation

- add release version badge to README ([e341eb0](https://github.com/JeffOtano/tonal-coach/commit/e341eb01fe3c7bc01ac10093ff4ade0ec4c76da5))

## 0.1.0 (2026-04-11)

Initial public open-source release.
