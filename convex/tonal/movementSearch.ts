/**
 * Fuzzy exercise search matching.
 *
 * Handles abbreviations (RDL ↔ Romanian Deadlift), multi-word queries,
 * and searches both name and shortName fields.
 */

/** Equivalence groups: any term in a group should match any other. */
const ALIAS_GROUPS: string[][] = [
  ["rdl", "romanian deadlift"],
  ["ohp", "overhead press"],
  ["sldl", "stiff leg deadlift", "straight leg deadlift"],
  ["pullup", "pull-up", "pull up"],
  ["pushup", "push-up", "push up"],
  ["lat pulldown", "lat pull-down", "lat pull down"],
  ["tricep", "triceps"],
  ["bicep", "biceps"],
  ["fly", "flye"],
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

function containsSubstring(haystack: string, needle: string): boolean {
  return haystack.includes(needle);
}

/** Returns true if the movement matches the search query. */
export function matchesNameSearch(
  movement: { name: string; shortName: string },
  query: string,
): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const name = movement.name.toLowerCase();
  const shortName = movement.shortName.toLowerCase();

  // Direct substring match on name or shortName
  if (containsSubstring(name, q) || containsSubstring(shortName, q)) return true;

  // Word-level: any word (>= 3 chars) from query appears in name/shortName
  const queryWords = q.split(/[\s\-]+/).filter((w) => w.length >= 3);
  if (queryWords.some((w) => containsSubstring(name, w) || containsSubstring(shortName, w))) {
    return true;
  }

  // Alias expansion: check full query and individual words against alias groups
  const termsToExpand = [q, ...queryWords];
  for (const term of termsToExpand) {
    const aliases = ALIAS_LOOKUP.get(term);
    if (aliases?.some((a) => containsSubstring(name, a) || containsSubstring(shortName, a))) {
      return true;
    }
  }

  return false;
}
