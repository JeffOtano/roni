// User profile from GET /v6/users/{userId}
export interface TonalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  heightInches: number;
  weightPounds: number;
  auth0Id: string;
  dateOfBirth: string;
  username: string;
  workoutsPerWeek: number;
  workoutDurationMin: number;
  workoutDurationMax: number;
  tonalStatus: string;
  accountType: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

// Movement from GET /v6/movements
export interface Movement {
  id: string;
  name: string;
  shortName: string;
  muscleGroups: string[];
  inFreeLift: boolean;
  onMachine: boolean;
  countReps: boolean;
  isTwoSided: boolean;
  isBilateral: boolean;
  isAlternating: boolean;
  descriptionHow: string;
  descriptionWhy: string;
  thumbnailMediaUrl?: string;
  skillLevel: number;
  publishState: string;
  sortOrder: number;
  onMachineInfo?: {
    accessory: string;
    resistanceType: string;
    spotterDisabled: boolean;
    eccentricDisabled: boolean;
    chainsDisabled: boolean;
    burnoutDisabled: boolean;
  };
  trainingTypes?: string[];
  // Additional fields from raw Tonal API
  baseOfSupport?: string;
  bodyRegion?: string;
  bodyRegionDisplay?: string;
  compatibilityStatus?: { lockedReason: string | null; status: string };
  createdAt?: string;
  updatedAt?: string;
  eliteImageAssetId?: string;
  family?: string;
  familyDisplay?: string;
  featureGroupIds?: string[] | null;
  hiddenInMovePicker?: boolean;
  hideReps?: boolean;
  imageAssetId?: string;
  isGeneric?: boolean;
  offMachineAccessories?: unknown;
  offMachineAccessory?: unknown;
  pushPull?: string;
  relatedGenericMovementIDs?: string[];
  secondsPerRep?: number;
  thumbnailMediaId?: string;
}

// Strength score from GET /v6/users/{userId}/strength-scores/current
export interface StrengthScore {
  id: string;
  userId: string;
  strengthBodyRegion: string;
  bodyRegionDisplay: string;
  score: number;
  current: boolean;
}

// Strength distribution from GET /v6/users/{userId}/strength-scores/distribution
export interface StrengthDistribution {
  userId: string;
  overallScore: number;
  percentile: number;
  distributionPoints: Array<{ score: number; yValue: number }>;
}

// Muscle readiness from GET /v6/users/{userId}/muscle-readiness/current
export interface MuscleReadiness {
  Chest: number;
  Shoulders: number;
  Back: number;
  Triceps: number;
  Biceps: number;
  Abs: number;
  Obliques: number;
  Quads: number;
  Glutes: number;
  Hamstrings: number;
  Calves: number;
}

// External activity from GET /v6/users/{userId}/external-activities
export interface ExternalActivity {
  id: string;
  userId: string;
  workoutType: string;
  beginTime: string;
  endTime: string;
  timezone: string;
  activeDuration: number;
  totalDuration: number;
  distance: number;
  activeCalories: number;
  totalCalories: number;
  averageHeartRate: number;
  source: string;
  externalId: string;
  deviceId: string;
}

// Activity (workout history) from GET /v6/users/{userId}/activities
export interface Activity {
  activityId: string;
  userId: string;
  activityTime: string;
  activityType: string;
  workoutPreview: {
    activityId: string;
    workoutId: string;
    workoutTitle: string;
    programName: string;
    coachName: string;
    level: string;
    targetArea: string;
    isGuidedWorkout: boolean;
    workoutType: string;
    beginTime: string;
    totalDuration: number;
    totalVolume: number;
    totalWork: number;
    totalAchievements: number;
    activityType: string;
    source?: string;
    externalWorkoutType?: string;
  };
}

// Workout activity detail from GET /v6/users/{userId}/workout-activities/{activityId}
export interface WorkoutActivityDetail {
  id: string;
  userId: string;
  workoutId: string;
  workoutType: string;
  timezone: string;
  beginTime: string;
  endTime: string;
  totalDuration: number;
  activeDuration: number;
  restDuration: number;
  totalMovements: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalConcentricWork: number;
  percentCompleted: number;
  workoutSetActivity?: SetActivity[];
}

export interface SetActivity {
  id: string;
  movementId: string;
  prescribedReps: number;
  repetition: number;
  repetitionTotal: number;
  blockNumber: number;
  spotter: boolean;
  eccentric: boolean;
  chains: boolean;
  flex: boolean;
  warmUp: boolean;
  beginTime: string;
  sideNumber: number;
  weightPercentage?: number;
}

// Custom workout from GET /v6/user-workouts
export interface UserWorkout {
  id: string;
  createdAt: string;
  title: string;
  shortDescription: string;
  description: string;
  duration: number;
  level: string;
  targetArea: string;
  tags: string[];
  bodyRegions: string[];
  type: string;
  userId: string;
  style: string;
  trainingType: string;
  movementIds: string[];
  accessories: string[];
  playbackType: string;
  isImported: boolean;
}

// Set input for POST /v6/user-workouts and /v6/user-workouts/estimate
export interface WorkoutSetInput {
  movementId: string;
  blockStart?: boolean;
  prescribedReps?: number;
  prescribedDuration?: number;
  repetition?: number;
  repetitionTotal?: number;
  blockNumber: number;
  burnout?: boolean;
  spotter?: boolean;
  eccentric?: boolean;
  chains?: boolean;
  flex?: boolean;
  warmUp?: boolean;
  dropSet?: boolean;
  weightPercentage?: number;
  setGroup?: number;
  round?: number;
  description?: string;
  prescribedResistanceLevel?: number;
}

// Request body for POST /v6/user-workouts
export interface CreateWorkoutInput {
  title: string;
  sets: WorkoutSetInput[];
  createdSource?: string;
}

// Response from POST /v6/user-workouts/estimate
export interface WorkoutEstimate {
  duration: number;
}

// Training type from GET /v6/training-types
export interface TrainingType {
  id: string;
  name: string;
  description: string;
}

// Workout detail from GET /v6/workouts/{workoutId}
export interface TonalWorkoutDetail {
  id: string;
  sets: Array<{ movementId: string }>;
}

// Tile from GET /v6/explore/workouts
export interface TonalExploreTile {
  workoutId: string;
  trainingTypeIds: string[];
  publishedAt?: string;
}

// Group from GET /v6/explore/workouts
export interface TonalExploreGroup {
  title: string;
  total: number;
  tiles: TonalExploreTile[];
}

// Strength score history from GET /v6/users/{userId}/strength-scores/history
export interface StrengthScoreHistoryEntry {
  id: string;
  userId: string;
  workoutActivityId: string;
  upper: number;
  lower: number;
  core: number;
  overall: number;
  activityTime: string;
}

// Formatted workout summary from GET /v6/formatted/users/{userId}/workout-summaries/{summaryId}
export interface FormattedWorkoutSummary {
  movementSets: FormattedMovementSet[];
  [key: string]: unknown;
}

export interface FormattedMovementSet {
  movementId: string;
  totalVolume: number;
  totalOnMachineVolume: number;
  totalWork: number;
  sets: unknown[];
}
