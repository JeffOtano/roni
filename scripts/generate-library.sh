#!/bin/bash
# Generate all library workouts and push to Tonal.
# Usage: ./scripts/generate-library.sh [--prod] [--push-only]
#
# Options:
#   --prod       Run against production Convex deployment
#   --push-only  Skip generation, just push unpushed workouts to Tonal

set -uo pipefail

PROD_FLAG=""
PUSH_ONLY=false
SERVICE_ACCOUNT_PROD="k57dnc1ebymcx2f8ntdpgyvmvx83bt9s"
SERVICE_ACCOUNT_DEV="k57178c4hvaewjjh8a5kwtpjkx83axa1"
SERVICE_ACCOUNT="$SERVICE_ACCOUNT_DEV"
GENERATION_VERSION=1
BATCH_SIZE=5

for arg in "$@"; do
  case $arg in
    --prod)
      PROD_FLAG="--prod"
      SERVICE_ACCOUNT="$SERVICE_ACCOUNT_PROD"
      ;;
    --push-only)
      PUSH_ONLY=true
      ;;
  esac
done

SESSION_TYPES=(push pull legs upper lower full_body chest back shoulders arms core glutes_hamstrings chest_back mobility recovery)

run_convex() {
  npx convex run $PROD_FLAG --no-push "$@"
}

if [ "$PUSH_ONLY" = false ]; then
  echo "=== Generating library workouts ==="
  echo "Deployment: ${PROD_FLAG:-dev}"
  echo "Batch size: $BATCH_SIZE"
  echo ""

  for st in "${SESSION_TYPES[@]}"; do
    echo "--- Session type: $st ---"
    offset=0
    while true; do
      result=$(run_convex coach/libraryGenerationActions:generateBatch "{\"sessionTypes\": [\"$st\"], \"generationVersion\": $GENERATION_VERSION, \"offset\": $offset, \"limit\": $BATCH_SIZE}" 2>&1)

      created=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['created'])" 2>/dev/null || echo "?")
      skipped=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['skipped'])" 2>/dev/null || echo "?")
      existing=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['existing'])" 2>/dev/null || echo "?")
      has_more=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['hasMore'])" 2>/dev/null || echo "false")

      echo "  offset=$offset: created=$created skipped=$skipped existing=$existing"

      if [ "$created" = "?" ]; then
        echo "  ERROR: $result"
      fi

      if [ "$has_more" != "True" ] && [ "$has_more" != "true" ]; then
        break
      fi
      offset=$((offset + BATCH_SIZE))
    done
    echo ""
  done

  echo "=== Generation complete ==="
  echo ""
fi

echo "=== Pushing to Tonal ==="
echo "Service account: $SERVICE_ACCOUNT"

while true; do
  result=$(run_convex coach/libraryGenerationActions:pushToTonalBatch "{\"serviceAccountUserId\": \"$SERVICE_ACCOUNT\"}" 2>&1)

  pushed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['pushed'])" 2>/dev/null || echo "0")
  failed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['failed'])" 2>/dev/null || echo "0")

  echo "  pushed=$pushed failed=$failed"

  if [ "$pushed" = "0" ]; then
    break
  fi

  echo "  waiting 5s before next batch..."
  sleep 5
done

echo "=== Done ==="
