# SSW.Rules - AI Agent Guide

## Project Overview

**SSW.Rules** is a best-practices knowledge base for software development. It uses a **two-repository architecture**:

| Repository | Purpose |
|------------|---------|
| **SSW.Rules** (this repo) | Next.js frontend application |
| **SSW.Rules.Content** | MDX content (rules & categories) - sibling directory |

**TinaCMS** serves as the headless CMS, providing a GraphQL API to query content.


## Quick Start

```bash
# Install dependencies
pnpm install

# Prepare content (generates JSON mappings from Content repo)
pnpm prepare:content

# Start development server
pnpm dev

# Production build
pnpm build
```

**Environment**: Copy `.env.example` to `.env.local` and set `LOCAL_CONTENT_RELATIVE_PATH=../../SSW.Rules.Content`

## Tech Stack

- **Next.js 15** with App Router and React Server Components
- **React 19** with TypeScript
- **TinaCMS** for content management (GraphQL API)
- **Tailwind CSS** for styling
- **pnpm** as package manager

## Code Style - DO/DON'T

### Components

- ✅ DO use Server Components by default (no directive needed)
- ✅ DO add `"use client"` only when using hooks, browser APIs, or interactivity
- ✅ DO use path aliases: `import { cn } from "@/lib/utils"`
- ✅ DO use `cn()` for conditional class names (combines clsx + tailwind-merge)
- ❌ DON'T use ESLint/Prettier - use Biome (`pnpm lint`)

### Styling

- ✅ DO use Tailwind utility classes
- ✅ DO use SSW theme colors: `ssw-red`, `ssw-gray`, `ssw-black`
- ❌ DON'T use inline styles

### Data Fetching

- ✅ DO use TinaCMS client: `import { client } from "@/tina/__generated__/client"`
- ✅ DO use `unstable_cache` with tags for server-side caching
- ❌ DON'T fetch data in Client Components - pass it from Server Components

## Key Patterns

### Dynamic Routing

`app/[filename]/` handles both rules and categories:
1. Check if filename matches a category in `category-uri-title-map.json`
2. If not, query as a rule via TinaCMS
3. Render `ServerCategoryPage` or `ServerRulePage`

### TinaCMS Queries

```typescript
// Fetch a rule
const { data } = await client.queries.ruleData({
  relativePath: "keep-urls-clean/rule.mdx",
});

// Fetch latest rules
const { data } = await client.queries.latestRulesQuery({
  size: 10,
  sortOption: "lastUpdated",
});
```

### Adding a New MDX Component

1. Create component in `components/embeds/`
2. Export from `components/embeds/index.tsx`
3. Add to `embedTemplates` in TinaCMS schema
4. Add to `getMarkdownComponentMapping()` for rendering