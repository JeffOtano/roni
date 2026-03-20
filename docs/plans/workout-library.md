# Workout Library - Implementation Plan

## Context

Build a public workout library at `/workouts` with ~500 programmatically generated Tonal workouts. Each workout gets an SEO-optimized page. Serves as both a content/SEO engine and a conversion funnel to the AI coach.

The flywheel: generate great workouts -> index on Google -> Tonal owners discover tonal.coach -> sign up for personalized coaching.

## Data Model

### New table: `libraryWorkouts`

Separate from `workoutPlans` (user-scoped, mutable). Library workouts are immutable, public, denormalized.

```typescript
libraryWorkouts: defineTable({
  slug: v.string(),
  title: v.string(),
  description: v.string(),

  // Taxonomy (all filterable)
  splitType: v.union(
    v.literal("ppl"),
    v.literal("upper_lower"),
    v.literal("full_body"),
    v.literal("chest"),
    v.literal("back"),
    v.literal("shoulders"),
    v.literal("arms"),
    v.literal("legs"),
    v.literal("core"),
  ),
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
  ),
  goal: v.union(
    v.literal("build_muscle"),
    v.literal("fat_loss"),
    v.literal("strength"),
    v.literal("endurance"),
    v.literal("athletic"),
    v.literal("general_fitness"),
  ),
  durationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  level: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
  equipmentConfig: v.union(
    v.literal("handles_only"),
    v.literal("handles_bar"),
    v.literal("full_accessories"),
    v.literal("bodyweight_only"),
  ),

  // Workout content (denormalized)
  blocks: blockInputValidator,
  movementDetails: v.array(
    v.object({
      movementId: v.string(),
      name: v.string(),
      shortName: v.string(),
      muscleGroups: v.array(v.string()),
      sets: v.number(),
      reps: v.optional(v.number()),
      duration: v.optional(v.number()),
      isWarmup: v.boolean(),
      isCooldown: v.boolean(),
      thumbnailMediaUrl: v.optional(v.string()),
      accessory: v.optional(v.string()),
    }),
  ),

  // Derived metadata
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
  .index("by_splitType", ["splitType"])
  .index("by_sessionType", ["sessionType"])
  .index("by_level", ["level"])
  .index("by_durationMinutes", ["durationMinutes"])
  .index("by_equipmentConfig", ["equipmentConfig"])
  .index("by_generationVersion", ["generationVersion"]);
```

### Public queries: `convex/libraryWorkouts.ts`

- `getBySlug(slug)` - single workout page
- `list({ goal?, splitType?, sessionType?, level?, durationMinutes?, equipmentConfig?, cursor? })` - paginated filtered list
- `getSlugs()` - all slugs for sitemap/static generation
- `getRelated(slug, limit)` - related workouts for "you might also like"

## Workout Generation

### Combination Matrix

| Dimension    | Values                                                                        | Count |
| ------------ | ----------------------------------------------------------------------------- | ----- |
| Session type | push, pull, legs, upper, lower, full_body, chest, back, shoulders, arms, core | 11    |
| Goal         | build_muscle, fat_loss, strength, endurance, athletic, general_fitness        | 6     |
| Duration     | 30, 45, 60                                                                    | 3     |
| Level        | beginner, intermediate, advanced                                              | 3     |
| Equipment    | handles_only, handles_bar, full_accessories, bodyweight_only                  | 4     |

Full product = 2,376. After pruning invalid combos: ~450-550 workouts.

### Pruning Rules

- `bodyweight_only` only valid for full_body, core, legs
- `endurance` goal not valid for 60min
- `strength` goal not valid for beginner level
- Skip combos that produce < 3 exercises

### Goal-Based Rep/Set Schemes

| Goal            | Sets | Reps | Notes                  |
| --------------- | ---- | ---- | ---------------------- |
| strength        | 4    | 5    | Heavy, low rep         |
| build_muscle    | 3    | 10   | Hypertrophy standard   |
| fat_loss        | 3    | 12   | Superset-heavy         |
| endurance       | 3    | 15   | Higher rep, lower rest |
| athletic        | 3    | 8    | Power focus            |
| general_fitness | 3    | 10   | Balanced               |

### Exercise Variation Strategy

Pass previously selected movement IDs as `recentWeeksMovementIds` to `selectExercises` when generating workouts for the same session type. This naturally rotates exercises across goals without randomization.

### Title/Slug Templates

- **Title:** `{SessionType} {Goal} Workout - {Duration}min {Level}`
- **Slug:** `{sessionType}-{goal}-{duration}min-{level}-{equipment}`
- **Meta title:** `{Title} | Free Tonal Workout | tonal.coach`

### Execution

Batch by session type (11 batches of ~50 workouts). Each batch is a separate Convex action to stay under the 10-min timeout. `generationVersion` field enables clean replacement on regeneration.

## Frontend Pages

### Route Structure

```
src/app/workouts/
  layout.tsx                    # Public layout (SiteNav + SiteFooter)
  page.tsx                      # Browse with filters
  [slug]/
    page.tsx                    # Individual workout (SSG + ISR)
    opengraph-image.tsx         # Dynamic OG image
  _components/
    WorkoutFilters.tsx          # Filter pills (client component)
    WorkoutLibraryCard.tsx      # Card for browse grid
    WorkoutBlockDisplay.tsx     # Renders blocks with exercises
    WorkoutCtaBanner.tsx        # CTA section
    RelatedWorkouts.tsx         # Related workout cards
    WorkoutJsonLd.tsx           # ExercisePlan structured data
```

### Route Conflict Resolution

Move existing `/workouts/[activityId]` (authenticated workout history) to `/activity/[activityId]`. This frees `/workouts` for the public library.

### Browse Page (`/workouts`)

Static page shell with client-side filtering via URL search params. Filters: goal, session type, duration, level, equipment. Paginated grid of workout cards.

### Detail Page (`/workouts/[slug]`)

Statically generated (SSG) with ISR revalidation every hour. Includes:

- Breadcrumb navigation
- Quick stats bar (exercise count, total sets, target muscles, equipment)
- Workout blocks rendered with superset grouping
- Exercise details with thumbnails and muscle groups
- CTA banner: "Want this personalized? The AI coach adapts to YOUR data."
- Related workouts section
- JSON-LD ExercisePlan schema

### CTA Strategy

Every workout page funnels to signup:

> "This is a template workout. When you connect your Tonal, the AI coach:
>
> - Adjusts weights based on your actual strength scores
> - Swaps exercises around injuries
> - Progresses reps/weight week over week
> - Schedules workouts around your calendar"

## SEO Strategy

- Each workout page has unique meta title, description, canonical URL
- JSON-LD ExercisePlan structured data
- Dynamic OG images with workout title, duration, level
- Sitemap includes all ~500 workout URLs (split into sitemap index)
- Remove `/workouts` from robots.txt disallow list
- Internal linking: related workouts, category cross-links
- Landing page gets "Browse 500+ Free Tonal Workouts" section
- SiteNav and SiteFooter link to `/workouts`

## Build Sequence

### Phase 1: Data Model + Generation (Convex-only)

**New files:**

- `convex/libraryWorkouts.ts` - queries + mutations
- `convex/coach/libraryGeneration.ts` - generation action
- `convex/coach/libraryGeneration.test.ts` - unit tests
- `convex/coach/goalConfig.ts` - rep/set schemes, equipment mappings

**Modified files:**

- `convex/schema.ts` - add libraryWorkouts table
- `convex/coach/weekProgrammingHelpers.ts` - extend SESSION_TYPE_MUSCLES for individual muscle groups (chest, back, shoulders, arms, core)

### Phase 2: Frontend Pages

**New files:**

- `src/app/workouts/layout.tsx`
- `src/app/workouts/page.tsx`
- `src/app/workouts/[slug]/page.tsx`
- `src/app/workouts/[slug]/opengraph-image.tsx`
- 6 component files in `_components/`

**Modified files:**

- `src/app/(app)/workouts/` -> rename to `src/app/(app)/activity/`
- `src/app/robots.ts` - update disallow list
- `src/app/sitemap.ts` - add workout URLs
- `src/app/page.tsx` - add browse section
- SiteNav + SiteFooter - add links
- Update any internal links from `/workouts/` to `/activity/`

### Phase 3: SEO Polish

- Dedicated workout sitemap
- "Send to Tonal" button for logged-in users
- Intro SEO content on browse page
- Category landing pages (stretch goal)

## Open Questions

1. Rename `/workouts/[activityId]` to `/activity/[activityId]`, or nest library under `/workout-library`?
2. Should "rope" be its own equipment config or stay part of full_accessories?
3. "Send to Tonal" for logged-in users - Phase 2 or Phase 3?
4. Generation trigger - manual admin action, monthly cron, or both?
