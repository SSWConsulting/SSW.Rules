# People Index System

This document describes the build-time People index system used to manage author information in the Rules site.

## Overview

The Rules site stores author references as **slugs** (e.g., `bob-northwind`) rather than full profile objects. At build time, a People index is generated from the SSW.People.Profiles GitHub repository, and at render time, slugs are resolved to full profile data (name, image, profile URL).

## Architecture

```
┌─────────────────────────────────┐
│  SSW.People.Profiles Repo       │
│  (GitHub - Source of Truth)     │
└───────────────┬─────────────────┘
                │
                ▼  (Build Time)
┌─────────────────────────────────┐
│  generate-people-index.js       │
│  - Fetches markdown files       │
│  - Parses frontmatter           │
│  - Generates people-index.json  │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  people-index.json              │
│  {                              │
│    "bob-northwind": {           │
│      "slug": "bob-northwind",   │
│      "name": "Bob Northwind",   │
│      "imageUrl": "...",         │
│      "profileUrl": "..."        │
│    }                            │
│  }                              │
└───────────────┬─────────────────┘
                │
                ▼  (Runtime)
┌─────────────────────────────────┐
│  Rule MDX Files                 │
│  ---                            │
│  authors:                       │
│    - bob-northwind              │
│    - jane-smith                 │
│  ---                            │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  AuthorsCard Component          │
│  - Resolves slugs via index     │
│  - Displays names & images      │
└─────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `scripts/generate-people-index.js` | Fetches People data from GitHub and generates the index |
| `scripts/migrate-authors-to-slugs.js` | One-time migration script for existing author data |
| `people-index.json` | Generated People index (gitignored) |
| `app/api/people/route.ts` | API endpoint serving People data |
| `lib/people/index.ts` | Server-side resolution utilities |
| `lib/people/usePeople.ts` | Client-side React hooks |
| `tina/fields/PeopleSelector.tsx` | TinaCMS custom field for selecting authors |
| `components/AuthorsCard.tsx` | Component for displaying authors |

## Scripts

### Generate People Index

```bash
npm run generate:people
```

Fetches People markdown files from `SSWConsulting/SSW.People.Profiles` and generates `people-index.json`.

**Environment Variables:**
- `GITHUB_TOKEN` - GitHub personal access token (optional, increases rate limit)
- `PEOPLE_REPO` - Override the repo (default: `SSWConsulting/SSW.People.Profiles`)

### Migrate Authors

```bash
# Dry run (preview changes)
npm run migrate:authors:dry-run

# Apply migration
npm run migrate:authors
```

Migrates existing rule files from the legacy author format (objects with title/url) to the new slug-based format.

**Environment Variables:**
- `LOCAL_CONTENT_RELATIVE_PATH` - Path to the content repository

## TinaCMS Integration

The `PeopleSelector` component provides a searchable dropdown for selecting authors:

1. Fetches the People list from `/api/people`
2. Displays a searchable list with names, roles, and avatars
3. Saves only the slug to the MDX frontmatter

## Data Format

### New Format (Slug-based)

```yaml
authors:
  - bob-northwind
  - jane-smith
```

### Legacy Format (Object-based)

```yaml
authors:
  - title: Bob Northwind
    url: https://ssw.com.au/people/bob-northwind
  - title: Jane Smith
    url: https://ssw.com.au/people/jane-smith
```

The `AuthorsCard` component automatically detects and supports both formats for backwards compatibility during migration.

## External Contributors

For contributors not in the SSW.People.Profiles repository:

1. **GitHub users**: Use the format `gh-username` (e.g., `gh-octocat`)
2. **Others**: Add them to the People repository or use the legacy format

## Build Process

The People index is generated as part of the build:

```json
{
  "build": "npm run generate:people && tinacms build && next build"
}
```

This ensures the index is always up-to-date with the latest People data.

## Troubleshooting

### "people-index.json not found"

Run `npm run generate:people` to generate the index.

### Rate limiting from GitHub API

Set the `GITHUB_TOKEN` environment variable with a GitHub personal access token.

### Author not found in index

1. Check if the person exists in the SSW.People.Profiles repository
2. Verify the slug matches the folder name (case-insensitive)
3. For external contributors, use the `gh-username` format or legacy format
