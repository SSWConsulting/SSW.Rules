#!/bin/sh
# Fetches the rules from SSW.Rules.Content and indexes the new and changed ones. Runs as the Container Apps job.
set -eu

CONTENT_BRANCH="${RULES_CONTENT_BRANCH:-main}"
git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$CONTENT_BRANCH" \
  https://github.com/SSWConsulting/SSW.Rules.Content.git /tmp/content
git -C /tmp/content sparse-checkout set public/uploads/rules
echo "Indexing SSW.Rules.Content $CONTENT_BRANCH at $(git -C /tmp/content rev-parse --short HEAD)"

LOCAL_CONTENT_RELATIVE_PATH=/tmp/content exec node /app/scripts/rules-chat/index-rules.mjs "$@"
