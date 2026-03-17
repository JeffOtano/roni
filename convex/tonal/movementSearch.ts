/**
 * Exercise search matching.
 *
 * Searches name, shortName, descriptionHow, and descriptionWhy fields
 * for natural synonym coverage. A small alias map handles spelling
 * variations that descriptions won't cover (pullup vs pull-up, etc.).
 */

/** Spelling/formatting variations only — not abbreviation↔full-name mappings. */
const ALIAS_GROUPS: string[][] = [
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

  // Alias expansion for spelling variations
  const termsToExpand = [q, ...queryWords];
  for (const term of termsToExpand) {
    const aliases = ALIAS_LOOKUP.get(term);
    if (aliases?.some((a) => fields.some((f) => f.includes(a)))) return true;
  }

  return false;
}
