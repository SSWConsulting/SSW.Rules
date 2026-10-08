# The Rules Chat index job: the index script and its three dependencies, not the site.
# Build from scripts/rules-chat:  docker build -f job/Dockerfile -t rules-chat-index scripts/rules-chat
FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY job/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY index-rules.mjs sql.mjs ./scripts/rules-chat/
COPY job/run.sh ./run.sh

USER node
ENTRYPOINT ["/app/run.sh"]
