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

timestamp() {
  date "+%H:%M:%S"
}

echo ""
echo "============================================"
echo "  Tonal Coach - Library Generation Script"
echo "============================================"
echo "  Started at: $(timestamp)"
echo "  Deployment: ${PROD_FLAG:-dev}"
echo "  Service account: ${SERVICE_ACCOUNT:0:12}..."
echo "  Push only: $PUSH_ONLY"
echo "============================================"
echo ""

# ---- GENERATION PHASE ----
if [ "$PUSH_ONLY" = false ]; then
  echo "[$(timestamp)] PHASE 1: GENERATING WORKOUTS"
  echo "  Batch size: $BATCH_SIZE workouts per LLM call"
  echo "  Session types: ${#SESSION_TYPES[@]}"
  echo ""

  TOTAL_CREATED=0
  TOTAL_SKIPPED=0
  TOTAL_EXISTING=0

  for st in "${SESSION_TYPES[@]}"; do
    echo "[$(timestamp)] --- Session type: $st ---"
    offset=0
    st_created=0
    st_skipped=0
    st_existing=0
    while true; do
      result=$(run_convex coach/libraryGenerationActions:generateBatch "{\"sessionTypes\": [\"$st\"], \"generationVersion\": $GENERATION_VERSION, \"offset\": $offset, \"limit\": $BATCH_SIZE}" 2>&1)

      created=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['created'])" 2>/dev/null || echo "?")
      skipped=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['skipped'])" 2>/dev/null || echo "?")
      existing=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['existing'])" 2>/dev/null || echo "?")
      has_more=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['hasMore'])" 2>/dev/null || echo "false")

      if [ "$created" = "?" ]; then
        echo "  [$(timestamp)] OFFSET $offset: ERROR - could not parse response"
        echo "    Raw: $(echo "$result" | head -1)"
      else
        echo "  [$(timestamp)] offset=$offset: +$created created, $skipped skipped, $existing already exist"
        st_created=$((st_created + created))
        st_skipped=$((st_skipped + skipped))
        st_existing=$((st_existing + existing))
      fi

      if [ "$has_more" != "True" ] && [ "$has_more" != "true" ]; then
        break
      fi
      offset=$((offset + BATCH_SIZE))
    done
    TOTAL_CREATED=$((TOTAL_CREATED + st_created))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + st_skipped))
    TOTAL_EXISTING=$((TOTAL_EXISTING + st_existing))
    echo "[$(timestamp)] $st complete: $st_created new, $st_skipped skipped, $st_existing existing"
    echo ""
  done

  echo "============================================"
  echo "[$(timestamp)] GENERATION COMPLETE"
  echo "  Total created: $TOTAL_CREATED"
  echo "  Total skipped: $TOTAL_SKIPPED"
  echo "  Total existing: $TOTAL_EXISTING"
  echo "============================================"
  echo ""
fi

# ---- PUSH PHASE ----
echo "[$(timestamp)] PHASE 2: PUSHING TO TONAL + GETTING SHARE LINKS"
echo "  Each workout: create on Tonal (if needed) -> share -> store deep link URL"
echo "  Rate limit: 1.5s between workouts, 3s retry on share failure"
echo ""

CURSOR="null"
TOTAL_PUSHED=0
TOTAL_FAILED=0
BATCH_NUM=0
START_TIME=$(date +%s)

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))
  raw_result=$(run_convex coach/libraryTonalPush:pushToTonalBatch "{\"serviceAccountUserId\": \"$SERVICE_ACCOUNT\", \"cursor\": $CURSOR}" 2>&1)
  # Strip Convex log lines to get clean JSON
  result=$(echo "$raw_result" | grep -v '^\[CONVEX' | grep -v '^$')

  pushed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['pushed'])" 2>/dev/null || echo "?")
  failed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['failed'])" 2>/dev/null || echo "?")
  is_done=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['isDone'])" 2>/dev/null || echo "true")
  next_cursor=$(echo "$result" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['nextCursor']))" 2>/dev/null || echo "null")

  if [ "$pushed" = "?" ]; then
    echo "  [$(timestamp)] BATCH $BATCH_NUM: ERROR - could not parse response"
    echo "    Raw: $(echo "$raw_result" | head -3)"
    if [ "$next_cursor" = "null" ]; then
      echo "  [$(timestamp)] No cursor to continue with. Stopping."
      break
    fi
  else
    TOTAL_PUSHED=$((TOTAL_PUSHED + pushed))
    TOTAL_FAILED=$((TOTAL_FAILED + failed))

    ELAPSED=$(( $(date +%s) - START_TIME ))
    RATE=""
    if [ $ELAPSED -gt 0 ] && [ $TOTAL_PUSHED -gt 0 ]; then
      RATE=" ($(echo "scale=1; $TOTAL_PUSHED * 60 / $ELAPSED" | bc)/min)"
    fi

    echo "  [$(timestamp)] BATCH $BATCH_NUM: +$pushed pushed, $failed failed | Total: $TOTAL_PUSHED pushed, $TOTAL_FAILED failed$RATE"
  fi

  if [ "$is_done" = "True" ] || [ "$is_done" = "true" ]; then
    echo ""
    echo "  [$(timestamp)] Reached end of table - all workouts processed"
    break
  fi

  CURSOR="$next_cursor"
  sleep 3
done

ELAPSED=$(( $(date +%s) - START_TIME ))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo "============================================"
echo "[$(timestamp)] PUSH COMPLETE"
echo "  Total pushed: $TOTAL_PUSHED"
echo "  Total failed: $TOTAL_FAILED"
echo "  Duration: ${MINUTES}m ${SECONDS}s"
echo "  Batches: $BATCH_NUM"
echo "============================================"
echo ""
echo "[$(timestamp)] All done!"
