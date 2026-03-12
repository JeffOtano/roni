#!/bin/bash
# Check that staged files don't exceed 300 lines.
# Used by lint-staged in pre-commit hook.

MAX_LINES=300
EXIT_CODE=0

for file in "$@"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file" | tr -d ' ')
    if [ "$lines" -gt "$MAX_LINES" ]; then
      echo "WARNING: $file has $lines lines (max $MAX_LINES). Consider splitting by responsibility."
      EXIT_CODE=1
    fi
  fi
done

exit $EXIT_CODE
