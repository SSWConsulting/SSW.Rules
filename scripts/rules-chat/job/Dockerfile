# The Rules Chat index job: the index scripts and their three dependencies, not the site.
# Build from scripts/rules-chat:  docker build -f job/Dockerfile -t rules-chat-index scripts/rules-chat
FROM node:22-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY job/package.json job/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY *.mjs ./scripts/rules-chat/
COPY job/run.sh ./run.sh

USER node
ENTRYPOINT ["/app/run.sh"]
