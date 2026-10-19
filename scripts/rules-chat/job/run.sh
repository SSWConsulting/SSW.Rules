#!/bin/sh
# Fetches the rules from SSW.Rules.Content and indexes the new and changed ones. Runs as the Container Apps job.
set -eu

# Any run that doesn't finish cleanly logs the marker the failure alert in infra/modules/rulesChatIndexJob.bicep searches
# for: a failed clone, a crash or failed import, running out of memory, or being stopped at the time limit.
trap 'echo "RULES_CHAT_INDEX_FAILED" >&2' EXIT
trap 'if [ -n "${INDEX_PID:-}" ]; then kill -TERM "$INDEX_PID" 2>/dev/null || true; fi; exit 143' TERM INT

CONTENT_BRANCH="${RULES_CONTENT_BRANCH:-main}"
git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$CONTENT_BRANCH" \
  https://github.com/SSWConsulting/SSW.Rules.Content.git /tmp/content
git -C /tmp/content sparse-checkout set public/uploads/rules
echo "Indexing SSW.Rules.Content $CONTENT_BRANCH at $(git -C /tmp/content rev-parse --short HEAD)"

# In the background, so a stop signal reaches the trap above instead of waiting for node to exit.
LOCAL_CONTENT_RELATIVE_PATH=/tmp/content node /app/scripts/rules-chat/index-rules.mjs "$@" &
INDEX_PID=$!
wait "$INDEX_PID"
trap - EXIT
