# -----------------------------------------
# Base image
# -----------------------------------------
    FROM node:20-alpine AS base

    # -----------------------------------------
    # Install dependencies
    # -----------------------------------------
    FROM base AS deps
    RUN apk add --no-cache libc6-compat git-lfs
    WORKDIR /app
    
    COPY package*.json ./
    COPY yarn.lock* ./
    
    # Always perform a clean install
    RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile --cache-folder /tmp/yarn-cache; \
        elif [ -f package-lock.json ]; then npm ci --force --cache /tmp/npm-cache; \
        else npm install --force --cache /tmp/npm-cache; fi
    
    # -----------------------------------------
    # Build stage
    # -----------------------------------------
    FROM base AS builder
    WORKDIR /app
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    
    RUN git lfs pull || true
    
    # Build info arguments 
    ARG BUILD_TIMESTAMP
    ARG VERSION_DEPLOYED
    ARG DEPLOYMENT_URL
    ARG BUILD_DATE
    ARG COMMIT_HASH
    
    # Public and secret build arguments
    ARG TINA_TOKEN
    ARG TINA_SEARCH_TOKEN
    ARG TINA_WEBHOOK_SECRET
    ARG NEXT_PUBLIC_TINA_CLIENT_ID
    ARG NEXT_PUBLIC_TINA_BRANCH
    ARG NEXT_PUBLIC_ALGOLIA_APP_ID
    ARG NEXT_PUBLIC_ALGOLIA_ADMIN_KEY
    ARG NEXT_PUBLIC_ALGOLIA_INDEX_NAME
    ARG NEXT_PUBLIC_ALGOLIA_API_KEY
    ARG NEXT_PUBLIC_API_BASE_URL
    ARG NEXT_PUBLIC_GITHUB_ORG
    ARG NEXT_PUBLIC_GITHUB_REPO
    ARG NEXT_PUBLIC_GISCUS_REPO_NAME
    ARG NEXT_PUBLIC_GISCUS_REPO_ID
    ARG NEXT_PUBLIC_GISCUS_CATEGORY_ID
    ARG NEXT_PUBLIC_GISCUS_THEME_URL
    ARG NEXT_PUBLIC_BASE_PATH
    
    # Build info environment variables (kept as before)
    ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP \
        VERSION_DEPLOYED=$VERSION_DEPLOYED \
        DEPLOYMENT_URL=$DEPLOYMENT_URL \
        BUILD_DATE=$BUILD_DATE \
        COMMIT_HASH=$COMMIT_HASH \
        TINA_TOKEN=$TINA_TOKEN \
        TINA_SEARCH_TOKEN=$TINA_SEARCH_TOKEN \
        TINA_WEBHOOK_SECRET=$TINA_WEBHOOK_SECRET \
        NEXT_PUBLIC_TINA_CLIENT_ID=$NEXT_PUBLIC_TINA_CLIENT_ID \
        NEXT_PUBLIC_TINA_BRANCH=$NEXT_PUBLIC_TINA_BRANCH \
        NEXT_PUBLIC_ALGOLIA_APP_ID=$NEXT_PUBLIC_ALGOLIA_APP_ID \
        NEXT_PUBLIC_ALGOLIA_ADMIN_KEY=$NEXT_PUBLIC_ALGOLIA_ADMIN_KEY \
        NEXT_PUBLIC_ALGOLIA_INDEX_NAME=$NEXT_PUBLIC_ALGOLIA_INDEX_NAME \
        NEXT_PUBLIC_ALGOLIA_API_KEY=$NEXT_PUBLIC_ALGOLIA_API_KEY \
        NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
        NEXT_PUBLIC_GITHUB_ORG=$NEXT_PUBLIC_GITHUB_ORG \
        NEXT_PUBLIC_GITHUB_REPO=$NEXT_PUBLIC_GITHUB_REPO \
        NEXT_PUBLIC_GISCUS_REPO_NAME=$NEXT_PUBLIC_GISCUS_REPO_NAME \
        NEXT_PUBLIC_GISCUS_REPO_ID=$NEXT_PUBLIC_GISCUS_REPO_ID \
        NEXT_PUBLIC_GISCUS_CATEGORY_ID=$NEXT_PUBLIC_GISCUS_CATEGORY_ID \
        NEXT_PUBLIC_GISCUS_THEME_URL=$NEXT_PUBLIC_GISCUS_THEME_URL \
        NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
        NEXT_TELEMETRY_DISABLED=1
    
    # Build the Next.js application
    RUN if [ -f yarn.lock ]; then yarn build; else npm run build; fi
    
    # -----------------------------------------
    # Reduce Next.js output size
    # -----------------------------------------
    RUN rm -rf .next/cache && \
        find .next -type f -name "*.map" -delete && \
        find .next -type f -name "*.nft.json" -size +5M -delete || true
    
    # -----------------------------------------
    # Size verification (debugging disk exhaustion)
    # -----------------------------------------
    RUN echo "----- Next.js build size overview -----" && \
        du -sh .next || true && \
        du -sh .next/standalone || true && \
        du -sh .next/static || true && \
        echo "----------------------------------------"
    
    # -----------------------------------------
    # Runner stage
    # -----------------------------------------
    FROM base AS runner
    WORKDIR /app
    
    ENV NODE_ENV=production \
        NEXT_TELEMETRY_DISABLED=1 \
        PORT=3000 \
        HOSTNAME="0.0.0.0"
    
    # Build info for runtime 
    ARG BUILD_TIMESTAMP
    ARG VERSION_DEPLOYED
    ARG DEPLOYMENT_URL
    ARG BUILD_DATE
    ARG COMMIT_HASH
    
    ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP \
        VERSION_DEPLOYED=$VERSION_DEPLOYED \
        DEPLOYMENT_URL=$DEPLOYMENT_URL \
        BUILD_DATE=$BUILD_DATE \
        COMMIT_HASH=$COMMIT_HASH
    
    RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001
    USER nextjs
    
    # Copy runtime files only
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    
    EXPOSE 3000
    CMD ["node", "server.js"]
    