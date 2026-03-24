# Schedule View - Design Spec

## Overview

Add weekly schedule view to the iOS app, replacing the "Coming Soon" placeholder on the Schedule tab. Shows the user's 7-day training plan with workout details, exercise lists, and completion status. Single Convex action call returns all data.

## Goals

- Users see their weekly training plan with session types and workout details
- Each day shows status (programmed, completed, missed, rest)
- Tapping a training day shows full exercise list
- No backend changes - calls existing `schedule:getScheduleData` action

## Architecture

### Single API Call

`schedule:getScheduleData` returns the full week with everything resolved:

- 7 days (Mon-Sun) with session type, derived status, workout title
- Exercise names and sets/reps for each day
- No additional queries needed

### Data Flow

```
ScheduleView
  .task -> action("schedule:getScheduleData")
  -> ScheduleData { weekStartDate, days[7] }
  -> Render day cards
  -> Tap training day -> push DayDetailView with ScheduleDay
```

## Components

### Swift Files to Create

| File                             | Purpose                                |
| -------------------------------- | -------------------------------------- |
| `Schedule/ScheduleModels.swift`  | Decodable types for schedule data      |
| `Schedule/ScheduleView.swift`    | Main week view with day cards          |
| `Schedule/ScheduleDayCard.swift` | Individual day card (training or rest) |
| `Schedule/DayDetailView.swift`   | Full exercise list for a single day    |

### Swift Files to Modify

| File                    | Change                                             |
| ----------------------- | -------------------------------------------------- |
| `App/ContentView.swift` | Replace Schedule tab placeholder with ScheduleView |

## Screen Designs

### ScheduleView

- NavigationStack with "Schedule" title
- Week date range subtitle: "Mar 24 - Mar 30"
- ScrollView with VStack of ScheduleDayCards
- Training days: full card with session info
- Rest days: minimal compact row
- Pull-to-refresh reloads data
- Loading: skeleton cards
- Error: retry message

### ScheduleDayCard (training day)

- Left color bar using Theme.Colors.sessionTypeColor(sessionType)
- Day name + date (e.g., "Monday, Mar 24")
- Session type badge (colored capsule)
- Status badge: completed (green checkmark), programmed (teal clock), missed (amber warning)
- Workout title (semibold)
- Exercise preview: first 3 exercise names, "+N more" if truncated
- Duration pill: "30 min"
- Tappable -> navigates to DayDetailView

### ScheduleDayCard (rest day)

- Minimal row: day name + "Rest Day" in muted text
- No tap action
- Subtle divider styling

### DayDetailView

- Day name + full date header
- Session type + status badges (same as card)
- Workout title (large)
- Stat cards row: duration, exercise count
- Full exercise list in VStack:
  - Each row: exercise name + "3 x 10" sets/reps (or "3 x 30s" for duration)
  - Numbered list (1, 2, 3...)
- "Open in Tonal" button if tonalWorkoutId present and status is programmed

## Data Types

```swift
struct ScheduleData: Decodable {
    let weekStartDate: String
    let days: [ScheduleDay]
}

struct ScheduleDay: Decodable, Identifiable {
    let dayIndex: Int
    let dayName: String
    let date: String
    let sessionType: String
    let derivedStatus: String
    let workoutTitle: String?
    let exercises: [ScheduleExercise]?
    let estimatedDuration: Int?
    let tonalWorkoutId: String?
    var id: Int { dayIndex }
    var isRest: Bool { derivedStatus == "rest" }
    var isTraining: Bool { !isRest }
}

struct ScheduleExercise: Decodable, Identifiable {
    let name: String
    let sets: Int
    let reps: Int?
    let duration: Int?
    var id: String { name }
}
```

## Status Visual Design

| Status     | Icon                          | Color                     | Label       |
| ---------- | ----------------------------- | ------------------------- | ----------- |
| completed  | checkmark.circle.fill         | Theme.Colors.success      | "Completed" |
| programmed | clock.fill                    | Theme.Colors.primary      | "Scheduled" |
| missed     | exclamationmark.triangle.fill | Theme.Colors.warning      | "Missed"    |
| failed     | xmark.circle.fill             | Theme.Colors.error        | "Failed"    |
| rest       | moon.fill                     | Theme.Colors.textTertiary | "Rest Day"  |

## Testing

- Schedule tab shows current week's plan
- Training days show session type, title, exercises
- Rest days show minimal row
- Tap training day -> DayDetailView with full exercise list
- Pull-to-refresh reloads
- Completed workouts show green checkmark
- Works without Tonal connected (shows empty/no plan state)
