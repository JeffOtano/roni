/**
 * Exercise search matching.
 *
 * Searches name, shortName, descriptionHow, and descriptionWhy fields
 * for natural synonym coverage. A small alias map handles spelling
 * variations that descriptions won't cover (pullup vs pull-up, etc.).
 */

/** Spelling variations and common abbreviation ↔ full-name mappings. */
const ALIAS_GROUPS: string[][] = [
  // Spelling / abbreviation variations
  ["pullup", "pull-up", "pull up"],
  ["pushup", "push-up", "push up"],
  ["lat pulldown", "lat pull-down", "lat pull down"],
  ["tricep", "triceps"],
  ["bicep", "biceps"],
  ["fly", "flye"],
  ["ohp", "overhead press"],
  ["sldl", "stiff leg deadlift", "stiff-leg deadlift"],
  ["db", "dumbbell"],
  ["bb", "barbell"],
  ["lat raise", "lateral raise"],
  ["side raise", "lateral raise"],

  // Common gym names → Tonal-specific names
  ["face pull", "standing face pull"],
  ["rear delt fly", "reverse fly"],
  ["rear delt raise", "reverse fly"],
  ["bent over fly", "reverse fly"],
  ["bent over raise", "reverse fly"],
  ["lying tricep extension", "skull crusher"],
  ["french press", "overhead triceps extension"],
  ["cable crunch", "seated cable crunch"],
  ["cable curl", "biceps curl"],
  ["chest fly", "bench chest fly", "middle chest fly", "incline chest fly", "decline chest fly"],
  ["cable fly", "bench chest fly"],
  ["hip thrust", "barbell hip thrust", "resisted glute bridge"],
  ["glute bridge", "resisted glute bridge", "elevated glute bridge", "barbell lying glute bridge"],
  ["deadlift", "neutral grip deadlift", "barbell deadlift", "suitcase deadlift"],
  ["rdl", "romanian deadlift", "barbell rdl", "single leg rdl"],
  ["squat", "goblet squat", "barbell front squat", "racked squat", "bodyweight squat"],
  ["lunge", "goblet reverse lunge", "racked reverse lunge", "resisted alternating lunge"],
  ["row", "bent over row", "seated row", "standing single arm row"],
  ["press", "bench press", "standing chest press", "standing overhead press"],
  ["curl", "biceps curl", "hammer curl", "barbell biceps curl"],
  [
    "extension",
    "triceps extension",
    "overhead triceps extension",
    "reverse grip triceps extension",
  ],
  ["pulldown", "neutral lat pulldown", "seated lat pulldown", "straight arm pulldown"],
  ["shoulder press", "standing overhead press", "seated overhead press"],
  ["military press", "standing barbell overhead press"],
  ["sumo deadlift", "barbell sumo deadlift"],
  ["calf raise", "resisted calf raise", "bent knee calf raise"],
  ["leg extension", "standing leg extension"],
  ["hamstring curl", "prone bench hamstring curl", "standing single leg hamstring curl"],
  ["leg curl", "prone bench hamstring curl"],
  ["hip abduction", "standing hip abduction"],
  ["donkey kick", "standing donkey kick", "quadruped donkey kick"],
  ["plank", "pillar bridge", "incline pillar bridge"],
  ["crunch", "pullover crunch", "seated cable crunch"],
  ["kickback", "triceps kickback", "standing diagonal glute kickback"],
];

/** Map from any alias to all alternatives in its group. */
const ALIAS_LOOKUP: Map<string, string[]> = buildAliasLookup();

function buildAliasLookup(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const group of ALIAS_GROUPS) {
    for (const term of group) {
      const others = group.filter((t) => t !== term);
      const existing = map.get(term);
      map.set(term, existing ? [...existing, ...others] : others);
    }
  }
  return map;
}

interface SearchableMovement {
  name: string;
  shortName: string;
  descriptionHow?: string;
  descriptionWhy?: string;
}

/** Returns true if the movement matches the search query. */
export function matchesNameSearch(movement: SearchableMovement, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const fields = [
    movement.name.toLowerCase(),
    movement.shortName.toLowerCase(),
    movement.descriptionHow?.toLowerCase() ?? "",
    movement.descriptionWhy?.toLowerCase() ?? "",
  ];

  // Direct substring match on any field
  if (fields.some((f) => f.includes(q))) return true;

  // Word-level: any word (>= 3 chars) from query appears in any field
  const queryWords = q.split(/[\s\-]+/).filter((w) => w.length >= 3);
  if (queryWords.some((w) => fields.some((f) => f.includes(w)))) return true;

  // Alias expansion: check full query, individual words, and multi-word subphrases
  const termsToExpand = [q, ...queryWords, ...buildSubphrases(queryWords)];
  for (const term of termsToExpand) {
    const aliases = ALIAS_LOOKUP.get(term);
    if (aliases?.some((a) => fields.some((f) => f.includes(a)))) return true;
  }

  return false;
}

/**
 * Builds contiguous multi-word subphrases (2+ words) from query words.
 * E.g. ["rear", "delt", "fly"] → ["rear delt", "delt fly", "rear delt fly"]
 */
function buildSubphrases(words: string[]): string[] {
  if (words.length < 2) return [];
  const phrases: string[] = [];
  for (let len = 2; len <= words.length; len++) {
    for (let start = 0; start <= words.length - len; start++) {
      phrases.push(words.slice(start, start + len).join(" "));
    }
  }
  return phrases;
}
