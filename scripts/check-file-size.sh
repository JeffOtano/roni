#!/bin/bash
# Check staged files against the documented soft and hard size caps.
# Used by lint-staged in pre-commit hook.

SOFT_MAX_LINES=300
HARD_MAX_LINES=400
EXIT_CODE=0

for file in "$@"; do
  # Skip generated files (e.g., convex/_generated/), reference material, and schema registry
  if [[ "$file" == *"_generated"* ]] || [[ "$file" == *"docs/reference"* ]] || [[ "$file" == *"convex/schema.ts" ]]; then
    continue
  fi
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file" | tr -d ' ')
    if [ "$lines" -gt "$HARD_MAX_LINES" ]; then
      echo "ERROR: $file has $lines lines (hard max $HARD_MAX_LINES). Split by responsibility."
      EXIT_CODE=1
    elif [ "$lines" -gt "$SOFT_MAX_LINES" ]; then
      echo "WARNING: $file has $lines lines (soft max $SOFT_MAX_LINES). Consider splitting by responsibility."
    fi
  fi
done

exit $EXIT_CODE
