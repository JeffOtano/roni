import type { BlockInput } from "./transforms";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that all movementIds exist in the catalog.
 * Catalog items must have at least an `id` field.
 */
export function validateMovementIds(
  movementIds: string[],
  catalog: Array<{ id: string }>,
): ValidationResult {
  const catalogIds = new Set(catalog.map((m) => m.id));
  const errors: string[] = [];

  for (const id of movementIds) {
    if (!catalogIds.has(id)) {
      errors.push(`Unknown movementId: ${id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract all movementIds from a block array and validate them.
 */
export function validateWorkoutBlocks(
  blocks: BlockInput[],
  catalog: Array<{ id: string }>,
): ValidationResult {
  const movementIds = blocks.flatMap((b) => b.exercises.map((e) => e.movementId));
  return validateMovementIds(movementIds, catalog);
}
