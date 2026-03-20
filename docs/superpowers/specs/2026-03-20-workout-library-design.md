# Workout Library - Design Spec

## Overview

Build a public workout library at `/workouts` with ~800-1,000 programmatically generated Tonal workouts. Each workout gets an SEO-optimized static page. Serves dual purpose as content/SEO engine and conversion funnel to the AI coach.

**Flywheel:** Generate high-quality workouts covering all athlete types -> index on Google -> Tonal owners discover tonal.coach via search -> sign up for personalized AI coaching.

**Scope:** Individual standalone workouts only. Weekly programming, periodization, and progressive overload are the AI coach's value prop, not the library's.

## Design Decisions

| Decision            | Choice                                                                    | Rationale                                                             |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Primary goal        | SEO + community value equally; SEO wins tiebreakers on public pages       | Both matter, but public pages optimize for crawlers                   |
| Route structure     | `/workouts` = public library, `/activity` = authenticated workout history | SEO value of `/workouts` is highest; clean URL                        |
| Descriptions        | LLM-generated at generation time, stored as static text                   | One-time cost, unique content per page                                |
| Equipment filtering | 4 generation configs, actual equipment list derived from movement data    | Simple generation buckets, precise display                            |
| Auth features       | None on V1 library pages. Public funnel + CTA only                        | Simplifies scope; auth features are future enhancement                |
| Denormalization     | Hybrid: movement IDs as source of truth, display fields snapshotted       | Clean regeneration path via generationVersion                         |
| Architecture        | Static-first (SSG + ISR)                                                  | Content changes rarely, identical for all visitors, best TTFB for SEO |
| Browse filtering    | Client-side, full list loaded at build time                               | ~800 items is small enough; no server round-trips on filter changes   |

## Data Model

### New table: `libraryWorkouts`

Separate from `workoutPlans` (user-scoped, mutable). Library workouts are immutable, public, denormalized for display but reference movement IDs for clean regeneration.

```typescript
libraryWorkouts: defineTable({
  // Identity
  slug: v.string(),
  title: v.string(),
  description: v.string(), // LLM-generated, 2-3 sentences

  // Taxonomy (all filterable)
  sessionType: v.union(
    v.literal("push"),
    v.literal("pull"),
    v.literal("legs"),
    v.literal("upper"),
    v.literal("lower"),
    v.literal("full_body"),
    v.literal("chest"),
    v.literal("back"),
    v.literal("shoulders"),
    v.literal("arms"),
    v.literal("core"),
    v.literal("glutes_hamstrings"),
    v.literal("chest_back"),
    v.literal("mobility"),
    v.literal("recovery"),
  ),
  goal: v.union(
    v.literal("build_muscle"),
    v.literal("fat_loss"),
    v.literal("strength"),
    v.literal("endurance"),
    v.literal("athletic"),
    v.literal("general_fitness"),
    v.literal("power"),
    v.literal("functional"),
    v.literal("mobility_flexibility"),
    v.literal("sport_complement"),
  ),
  durationMinutes: v.union(v.literal(20), v.literal(30), v.literal(45), v.literal(60)),
  level: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
  equipmentConfig: v.union(
    v.literal("handles_only"),
    v.literal("handles_bar"),
    v.literal("full_accessories"),
    v.literal("bodyweight_only"),
  ),

  // Workout content (denormalized snapshot)
  blocks: blockInputValidator,
  movementDetails: v.array(
    v.object({
      movementId: v.string(), // Source of truth
      name: v.string(), // Snapshotted at generation
      shortName: v.string(),
      muscleGroups: v.array(v.string()),
      sets: v.number(),
      reps: v.optional(v.number()),
      duration: v.optional(v.number()),
      phase: v.union(
        // Determined during generation
        v.literal("warmup"),
        v.literal("main"),
        v.literal("cooldown"),
      ),
      thumbnailMediaUrl: v.optional(v.string()),
      accessory: v.optional(v.string()),
    }),
  ),

  // Derived metadata (computed at generation)
  targetMuscleGroups: v.array(v.string()),
  exerciseCount: v.number(),
  totalSets: v.number(),
  equipmentNeeded: v.array(v.string()),

  // SEO
  metaTitle: v.string(),
  metaDescription: v.string(),

  // Versioning
  generationVersion: v.number(),
  createdAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_goal", ["goal"])
  .index("by_sessionType", ["sessionType"])
  .index("by_level", ["level"])
  .index("by_durationMinutes", ["durationMinutes"])
  .index("by_equipmentConfig", ["equipmentConfig"])
  .index("by_generationVersion", ["generationVersion"]);
```

### Public queries: `convex/libraryWorkouts.ts`

- `getBySlug(slug)` - single workout for detail page (SSG)
- `listAll()` - all workouts for browse page (client-side filtering)
- `getSlugs()` - all slugs for `generateStaticParams` + sitemap
- `getRelated(slug, limit)` - same sessionType or goal, different workout

## Taxonomy

### Session Types (15)

| Session Type      | Muscle Groups                           | Notes                                          |
| ----------------- | --------------------------------------- | ---------------------------------------------- |
| push              | Chest, Triceps, Shoulders               | Standard PPL                                   |
| pull              | Back, Biceps                            | Standard PPL                                   |
| legs              | Quads, Glutes, Hamstrings, Calves       | Standard PPL                                   |
| upper             | Chest, Back, Shoulders, Triceps, Biceps | Upper/Lower split                              |
| lower             | Quads, Glutes, Hamstrings, Calves       | Upper/Lower split                              |
| full_body         | All major groups                        | Full body session                              |
| chest             | Chest, Triceps                          | Isolation focus                                |
| back              | Back, Biceps                            | Isolation focus                                |
| shoulders         | Shoulders, Triceps                      | Isolation focus                                |
| arms              | Biceps, Triceps                         | Isolation focus                                |
| core              | Core, Obliques                          | Isolation focus                                |
| glutes_hamstrings | Glutes, Hamstrings                      | **NEW** - Posterior chain (high search volume) |
| chest_back        | Chest, Back                             | **NEW** - Antagonist supersets                 |
| mobility          | (trainingType filter)                   | **NEW** - Uses Yoga/Mobility catalog movements |
| recovery          | (trainingType filter)                   | **NEW** - Uses Recovery catalog movements      |

### Goals (10)

| Goal                 | Sets | Reps | Notes                                                                 |
| -------------------- | ---- | ---- | --------------------------------------------------------------------- |
| strength             | 4    | 5    | Heavy compounds, long rest                                            |
| build_muscle         | 3    | 10   | Hypertrophy standard                                                  |
| fat_loss             | 3    | 12   | Superset-heavy, short rest                                            |
| endurance            | 3    | 15   | Higher rep, lower rest                                                |
| athletic             | 3    | 8    | Balanced compounds                                                    |
| general_fitness      | 3    | 10   | Accessible, moderate intensity                                        |
| power                | 4    | 3    | **NEW** - Explosive, max effort (MMA, basketball, golf)               |
| functional           | 3    | 12   | **NEW** - Compound-focused, movement patterns (seniors, active aging) |
| mobility_flexibility | 2    | -    | **NEW** - Duration-based (30-45s holds), low intensity                |
| sport_complement     | 3    | 8    | **NEW** - Injury-prevention, unilateral preferred (runners, cyclists) |

### Durations

20min (~4 exercises), 30min (~6 exercises), 45min (~8 exercises), 60min (~10 exercises)

### Levels

beginner, intermediate, advanced

### Equipment Configs

| Config           | Generation Behavior                                                                |
| ---------------- | ---------------------------------------------------------------------------------- |
| handles_only     | Exclude "Smart Bar", "Rope", "Roller", "Weight Bar" from `onMachineInfo.accessory` |
| handles_bar      | Exclude "Rope", "Roller" from `onMachineInfo.accessory`                            |
| full_accessories | No exclusions                                                                      |
| bodyweight_only  | Pre-filter catalog to `inFreeLift: true` only                                      |

Each workout page displays the actual equipment list derived from movement `onMachineInfo.accessory` values (e.g., "Smart Handles, Smart Bar").

A new helper function is required to map config names to exclusion arrays:

```typescript
export function getExcludedAccessoriesForConfig(
  config: "handles_only" | "handles_bar" | "full_accessories" | "bodyweight_only",
): string[] {
  switch (config) {
    case "handles_only":
      return ["Smart Bar", "Rope", "Roller", "Weight Bar"];
    case "handles_bar":
      return ["Rope", "Roller"];
    case "full_accessories":
      return [];
    case "bodyweight_only":
      return []; // handled by inFreeLift pre-filter
  }
}
```

### Pruning Rules

- `bodyweight_only` only valid for: full_body, core, legs, glutes_hamstrings, mobility, recovery
- `endurance` goal not valid for 60min
- `strength` and `power` goals not valid for beginner
- `power` goal not valid for 20min
- `mobility` and `recovery` sessions only valid with `mobility_flexibility` or `functional` goals
- `sport_complement` goal only valid with: full_body, upper, lower, legs, glutes_hamstrings, core
- `mobility_flexibility` goal only valid with: full_body, mobility, recovery, core
- 20min not valid for full_body + strength
- Skip any combo producing < 3 exercises from the catalog. For `bodyweight_only` combos specifically: if `inFreeLift: true` filtering produces < 3 exercises, skip the combo entirely (do not relax the constraint). This may reduce the total count but maintains accuracy of the equipment label.

**Estimated output: ~800-1,000 workouts after pruning.** The `bodyweight_only` constraint may prune aggressively for some session types, which is acceptable - it's better to have fewer accurate workouts than mislabeled ones.

## Generation Engine

### Pipeline

1. **Enumerate valid combinations** - Cross-product of all dimensions, prune invalid combos
2. **Select exercises** - Call existing `selectExercises()` with target muscle groups, level, equipment constraints
3. **Build blocks** - Call existing `blocksFromMovementIds()` to organize into supersets, sort by accessory
4. **Apply rep/set scheme** - Based on goal (see table above)
5. **Snapshot movement details** - Denormalize name, muscle groups, thumbnail, accessory from catalog
6. **Generate descriptions** - LLM call per workout (batched), stored as static text
7. **Write to Convex** - Upsert by slug, bump `generationVersion`

### New muscle group mappings

Extend `SESSION_TYPE_MUSCLES` in `weekProgrammingHelpers.ts`:

```typescript
glutes_hamstrings: ["Glutes", "Hamstrings"],
chest_back: ["Chest", "Back"],
mobility: [],   // uses trainingType filter instead
recovery: [],   // uses trainingType filter instead
```

`mobility` and `recovery` bypass muscle group targeting. They filter the catalog by `trainingTypes`:

- `mobility` sessions: filter for movements with trainingType in `["Mobility", "Yoga"]`
- `recovery` sessions: filter for movements with trainingType in `["Recovery", "Yoga"]`

Since `selectExercises()` does not support trainingType filtering, the generation engine must pre-filter the catalog before passing it to `selectExercises()`. For mobility/recovery sessions: filter the full catalog to only movements whose `trainingTypes` array intersects the target types, then pass the filtered catalog to `selectExercises()` with an empty `targetMuscleGroups` (skip muscle group matching). This avoids modifying the existing selection function.

### Exercise variation

Process combos grouped by session type. Pass previously selected movement IDs from earlier combos as `recentWeeksMovementIds` to `selectExercises()`. The existing deprioritization logic naturally rotates exercises across workouts of the same session type.

### LLM descriptions

Separate pass after all workouts are generated. Batch 10-20 descriptions per LLM call using structured output. Each description is 2-3 sentences covering: what the workout targets, who it's for, and what to expect. Stored as static text in the `description` field.

### Execution

- Batch by session type (~15 batches of ~50-70 workouts). Each batch is a separate Convex action to stay under the 10-minute timeout.
- LLM descriptions run as a separate action pass after generation.
- **Regeneration:** Bump `generationVersion`, run full generation, delete old version rows. Zero-downtime swap.
- **Trigger:** Manual admin action initially. Monthly cron as future enhancement.

## Frontend Architecture

### Route structure

```
src/app/workouts/
  layout.tsx                     # Public layout (SiteNav + SiteFooter)
  page.tsx                       # Browse page - SSG shell + client filtering
  [slug]/
    page.tsx                     # Detail page - SSG + ISR (1hr revalidation)
    opengraph-image.tsx          # Dynamic OG image via Satori
  _components/
    WorkoutFilters.tsx           # Filter pills (client component)
    WorkoutLibraryCard.tsx       # Card for browse grid
    WorkoutBlockDisplay.tsx      # Renders blocks with exercises
    WorkoutCtaBanner.tsx         # CTA section
    RelatedWorkouts.tsx          # Related workout cards
    WorkoutJsonLd.tsx            # ExercisePlan structured data
```

### Route conflict resolution

Move `src/app/(app)/workouts/` to `src/app/(app)/activity/`. Update all internal links from `/workouts/` to `/activity/`.

### Browse page (`/workouts`)

SSG shell with all ~800 workouts loaded as JSON at build time. Client-side filtering via URL search params (`/workouts?goal=build_muscle&session=push&duration=45`). Shareable, bookmarkable filter states.

Filter dimensions displayed as pill rows:

- Row 1: Goals (Build Muscle, Fat Loss, Strength, Power, Functional, ...)
- Row 2: Session types (Push, Pull, Legs, Upper, Full Body, Glutes, ...)
- Row 3: Duration (20min, 30min, 45min, 60min) + Level (Beginner, Intermediate, Advanced)

Results displayed as card grid with: tags, title, LLM description, duration/level/exercise count.

### Detail page (`/workouts/[slug]`)

Statically generated via `generateStaticParams()` with ISR revalidation every hour.

Page structure:

- Breadcrumb navigation (Workouts / Push / Build Muscle / 45min Intermediate) - links back to filtered browse
- Quick stats bar (exercise count, total sets, duration, muscle groups, equipment needed)
- Workout blocks with superset grouping, exercise thumbnails, muscle groups, sets x reps
- CTA banner: "Want this personalized for you?" with value prop bullets
- Related workouts section (3 cards, same session type or goal)
- JSON-LD ExercisePlan structured data

### CTA strategy

Every detail page has a conversion banner:

> "This is a template workout. Connect your Tonal and the AI coach adjusts weights to your strength scores, swaps exercises around injuries, and progresses you week over week."

Button: "Start Free with AI Coach" -> signup flow.

## SEO Strategy

| Element          | Implementation                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Meta title       | "{Title} \| Free Tonal Workout" (< 60 chars)                                                                         |
| Meta description | LLM-generated, unique per workout (~155 chars)                                                                       |
| Canonical URL    | https://tonal.coach/workouts/[slug]                                                                                  |
| OG image         | Dynamic via Satori - title, duration, level, target muscles                                                          |
| Structured data  | JSON-LD ExercisePlan schema per workout page                                                                         |
| Sitemap          | All ~800 workout URLs. Priority 0.8. Weekly changefreq.                                                              |
| robots.ts        | Remove /workouts from disallow list                                                                                  |
| Internal linking | Breadcrumbs -> filtered browse. Related workouts -> detail pages. Landing page -> browse. Nav + footer -> /workouts. |

### Title/slug templates

- **Slug:** `{sessionType}-{goal}-{duration}min-{level}-{equipment}`
- **Title:** `{SessionType} {GoalLabel} Workout - {Duration}min {Level}`
- **Meta title:** `{Title} | Free Tonal Workout`

Goal label mapping: build_muscle -> "Hypertrophy", fat_loss -> "Fat Loss", strength -> "Strength", endurance -> "Endurance", athletic -> "Athletic", general_fitness -> "General Fitness", power -> "Power", functional -> "Functional", mobility_flexibility -> "Mobility", sport_complement -> "Sport Complement"

### Landing page integration

- New section on homepage: "Browse 800+ Free Tonal Workouts" with 6 featured workout cards
- SiteNav: Add "Workouts" link
- SiteFooter: Add "Workout Library" link

### Files modified for SEO

- `src/app/robots.ts` - Remove /workouts from disallow list
- `src/app/sitemap.ts` - Add all workout slugs via `getSlugs()` query
- `src/app/page.tsx` - Add "Browse Workouts" section
- SiteNav / SiteFooter - Add /workouts links
- All internal `/workouts/` references updated to `/activity/`

## Future Enhancements (post-V1)

- **"Share to Tonal" button** - Investigate Tonal's deep-link/share API endpoint. Allow visitors to send a library workout directly to their Tonal. Highest-priority post-V1 feature.
- **"Use this workout" for logged-in users** - Copy library workout into user's plan as AI coach starting template.
- **Category landing pages** - `/workouts/push`, `/workouts/build-muscle` with intro content.
- **Monthly regeneration cron** - Automated regeneration to pick up new movements from the catalog.
- **Search** - Full-text search across workout titles and descriptions.
