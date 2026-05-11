# TinaCMS Configuration Documentation

## Overview

The `tina/config.tsx` file is the central configuration for TinaCMS, a headless CMS that powers the SSW.Rules website. This file defines authentication, media storage, content schemas, search indexing, and GitHub integration.

**TinaCMS Version:** 3.7.0

**Location:** `tina/config.tsx`

The configuration connects the SSW.Rules website to the [SSW.Rules.Content](https://github.com/SSWConsulting/SSW.Rules.Content) repository, which stores all rule content, categories, and media files.

## Configuration Sections

### Authentication & Connection

```typescript
{
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  branch: process.env.NEXT_PUBLIC_TINA_BRANCH ?? "main",
  localContentPath: process.env.LOCAL_CONTENT_RELATIVE_PATH ?? undefined
}
```

#### Required Environment Variables

| Variable | Purpose | Required | Default | Where to Obtain |
|----------|---------|----------|---------|-----------------|
| `NEXT_PUBLIC_TINA_CLIENT_ID` | Tina Cloud client ID | Yes | - | Tina Cloud Dashboard |
| `TINA_TOKEN` | Tina Cloud authentication token | Yes | - | Tina Cloud Dashboard |
| `NEXT_PUBLIC_TINA_BRANCH` | Git branch to use | No | "main" | Your branch name |
| `LOCAL_CONTENT_RELATIVE_PATH` | Path to content repository | No | undefined | e.g., `../../SSW.Rules.Content` |
| `TINA_SEARCH_TOKEN` | Search indexer token | Yes | - | Tina Cloud Dashboard |
| `NEXT_PUBLIC_GITHUB_ORG` | GitHub organization name | Yes | - | GitHub (e.g., "SSWConsulting") |
| `NEXT_PUBLIC_GITHUB_REPO` | GitHub repository name | Yes | - | GitHub (e.g., "SSW.Rules") |

#### Branch Configuration

The `branch` configuration supports TinaCMS editorial workflow, allowing content changes to be reviewed before being published. When using editorial workflow, branches are prefixed with `tina/`.

### Media Configuration

```typescript
media: {
  tina: {
    publicFolder: "public",
    mediaRoot: "uploads"
  }
}
```

- **Storage:** Uses Tina Cloud media store
- **Upload Directory:** `public/uploads/`
- **Cloudinary Integration:** Commented example available for alternative media storage

Images are stored in the public folder and served directly from the website.

### Build Configuration

```typescript
build: {
  publicFolder: "public",
  outputFolder: "admin",
  basePath: nextConfig.basePath?.replace(/^\//, "") || ""
}
```

- **Admin UI:** Built to `public/admin/`
- **Base Path:** Respects Next.js base path configuration for subdirectory deployments

### Search Configuration

```typescript
search: {
  tina: {
    indexerToken: searchToken,
    stopwordLanguages: ["eng"]
  },
  indexBatchSize: 100,
  maxSearchIndexFieldLength: 100
}
```

- **Indexer Token:** Required for search functionality
- **Stopword Languages:** English stopword filtering
- **Index Batch Size:** 100 items per batch
- **Max Field Length:** 100 characters for indexed fields

### Repository Provider

```typescript
repoProvider: {
  defaultBranchName: branch,
  historyUrl: ({ relativePath, branch }) => ({
    url: `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_ORG}/${process.env.NEXT_PUBLIC_GITHUB_REPO}/commits/${branch}/${relativePath}`
  })
}
```

Integrates with GitHub for version history, allowing users to view commit history directly from the TinaCMS admin interface.

## Schema Collections

The configuration defines four main collections:

### Rule Collection

**File:** `tina/collection/rule.tsx`

**Purpose:** Defines the schema for individual SSW rules (best practices)

**Path:** `public/uploads/rules/{uri}/rule.mdx`

**Key Fields:**

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `title` | string | Rule title (format: "Do you...?" with question mark) | Required |
| `uri` | string | URL slug (kebab-case, no spaces) | Required, no uppercase, no spaces |
| `categories` | object[] | Multi-select reference to categories | - |
| `sidebarVideo` | string | Video embed for sidebar | - |
| `authors` | object[] | List of contributors with name and URL | - |
| `related` | object[] | Related rules references | - |
| `redirects` | string[] | Alternate URLs that redirect | - |
| `guid` | string | Unique identifier (auto-generated, hidden) | - |
| `seoDescription` | string | SEO meta description | - |
| `body` | rich-text | Rich text content with MDX support | Must contain exactly one `endIntro` embed |
| `thumbnail` | image | Rule thumbnail image (min 175×175px) | - |
| `created` | datetime | Creation timestamp (hidden) | - |
| `createdBy` | string | Creator name (auto-populated) | - |
| `createdByEmail` | string | Creator email (auto-populated) | - |
| `lastUpdated` | datetime | Last update timestamp (hidden) | - |
| `lastUpdatedBy` | string | Last updater name (hidden) | - |
| `lastUpdatedByEmail` | string | Last updater email (hidden) | - |
| `isArchived` | boolean | Archive status | - |
| `archivedreason` | string | Archive reason (conditional visibility) | Required if `isArchived` is true |

**Special Features:**

- **Custom Filename Slugification:** Based on URI field
- **Custom Router:** Preview URLs use the URI slug
- **beforeSubmit Hook:** Updates category indexes via API
- **Validation:** Ensures exactly one `endIntro` embed component
- **ConditionalHiddenField:** Simplifies create mode by hiding non-essential fields

### Category Collection

**File:** `tina/collection/category.tsx`

**Purpose:** Defines the schema for category hierarchy (main → top → sub)

**Path:** `categories/`

**Templates:**

#### 1. Main Category (`index.mdx`)

Contains list of top categories.

**Fields:**
- `title` - Category title
- `index` - List of top category references

#### 2. Top Category (`{title}/index.mdx`)

Contains list of subcategories.

**Fields:**
- `title` - Category title
- `type` - Category type (hidden)
- `uri` - Category URI
- `index` - List of category references

#### 3. Category (`{title}.mdx`)

Contains list of rules and description.

**Fields:**
- `title` - Category title
- `uri` - Category URI
- `guid` - Unique identifier (auto-generated, hidden)
- `consulting` - Consulting link
- `experts` - Experts link
- `seoDescription` - SEO meta description
- `redirects` - Alternate URLs
- `index` - List of rule references (for sorting only)
- `body` - Category description (rich-text)
- `created`, `createdBy`, `createdByEmail` - Creation tracking
- `lastUpdated`, `lastUpdatedBy`, `lastUpdatedByEmail` - Update tracking

**Special Features:**

- **Three-level hierarchy support:** Main → Top → Sub
- **Custom filename slugification:** Per template
- **Category index:** For rule sorting on category pages
- **RuleSelector:** For rule references

### Homepage Collection

**File:** `tina/collection/homepage.ts`

**Purpose:** Global homepage configuration

**Format:** JSON

**Path:** `homepage/index.json`

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `tagline` | string | Main tagline |
| `aboutSsw` | object | About SSW section (title, body) |
| `needHelp` | object | Need Help section (title, description, buttonText, jotFormId) |
| `helpImprove` | object | Help Improve section (title, quote, person info) |
| `whyRules` | object | Why Rules section (title, body) |
| `joinConversation` | object | Social media integration (hashtag, platformUrl) |
| `quickLinks` | object | Quick links list |

**UI Restrictions:**
```typescript
ui: {
  allowedActions: {
    create: false,
    delete: false
  }
}
```

### Global Collection

**File:** `tina/collection/global.ts`

**Purpose:** Site-wide configuration (header, footer, theme)

**Format:** JSON

**Path:** `global/index.json`

**Fields:**

#### Header

| Field | Type | Description |
|-------|------|-------------|
| `icon` | object | Icon picker with color and style |
| `name` | string | Site name |
| `color` | string | Color scheme (default/primary) |
| `nav` | object[] | Navigation links list |

#### Footer

| Field | Type | Description |
|-------|------|-------------|
| `social` | object[] | Social links list with icons |

#### Theme

| Field | Type | Description |
|-------|------|-------------|
| `color` | string | Primary color picker |
| `font` | string | Font family (system/nunito/lato) |
| `darkMode` | string | Dark mode setting (system/light/dark) |

**UI:** `global: true` (singleton pattern)

## Custom Fields

### CategoryMultiSelector

**File:** `tina/fields/CategoryMultiSelector.tsx`

**Purpose:** Multi-select dropdown for categories with search/filter functionality

**Features:**
- Search and filter categories
- Refresh button for revalidation
- Handles editorial workflow branch changes
- Hidden in create mode
- Displays selected categories as removable chips

**Usage:**
```typescript
{
  type: "object",
  name: "categories",
  label: "Categories",
  list: true,
  ui: {
    component: CategoryMultiSelectorInput
  }
}
```

### RuleSelector

**File:** `tina/fields/RuleSelector.tsx`

**Purpose:** Single-select dropdown for rules

**Features:**
- Search by URI or title
- Shows last 20 rules by default
- Shows all matches when searching
- Displays last updated date
- Minimum search length: 2 characters

**Usage:**
```typescript
{
  type: "reference",
  name: "rule",
  collections: ["rule"],
  ui: {
    component: RuleSelector
  }
}
```

### IconPicker

**File:** `tina/fields/icon.tsx`

**Purpose:** Icon selection from predefined set

**Features:**
- Icon selection from predefined set
- Color picker integration
- Style options (circle/float)
- Search/filter functionality

**Usage:**
```typescript
{
  type: "object",
  name: "icon",
  fields: [
    {
      type: "string",
      name: "name",
      ui: {
        component: IconPickerInput
      }
    },
    {
      type: "string",
      name: "color",
      ui: {
        component: ColorPickerInput
      }
    },
    {
      type: "string",
      name: "style",
      options: ["circle", "float"]
    }
  ]
}
```

### ColorPicker

**File:** `tina/fields/color.tsx`

**Purpose:** Color selection from predefined palette

**Options:** blue, teal, green, yellow, orange, red, pink, purple, white

**Usage:**
```typescript
{
  type: "string",
  name: "color",
  ui: {
    component: ColorPickerInput
  }
}
```

### ConditionalHiddenField

**File:** `tina/fields/ConditionalHiddenField.tsx`

**Purpose:** Conditionally hides fields based on various conditions

**Hide Conditions:**
- CRUD type (create mode)
- Field type
- Custom `hideCondition` function
- Watched field changes

**Features:**
- Supports textarea rendering
- Hides both field and label
- Custom condition evaluation with form values

**Usage:**
```typescript
{
  type: "string",
  name: "archivedreason",
  ui: {
    component: ConditionalHiddenField,
    hideCondition: (values) => values?.isArchived !== true,
    watchFields: ["isArchived"],
    textarea: true,
    rows: 3
  }
}
```

### ReadonlyUriInput

**File:** `tina/fields/ReadonlyUriInput.tsx`

**Purpose:** Read-only URI input field

**Usage:**
```typescript
{
  type: "string",
  name: "uri",
  ui: {
    component: wrapFieldsWithMeta((props) => <ReadonlyUriInput {...props} />)
  }
}
```

### UserInfoField

**File:** `tina/fields/UserInfoField.tsx`

**Purpose:** Auto-populates user info from authentication

**Features:**
- Fetches logged-in user info
- Updates form field value after initialization
- Hides label and description on create mode

**Usage:**
```typescript
{
  type: "string",
  name: "createdBy",
  ui: {
    component: UserInfoField
  }
}
```

## Shared Fields

### History Fields

**File:** `tina/collection/shared/historyFields.ts`

**Purpose:** History tracking for documents

**Fields:**
- `lastUpdated` - Timestamp (hidden)
- `lastUpdatedBy` - User name (hidden)
- `lastUpdatedByEmail` - User email (hidden)
- `isArchived` - Archive flag
- `archivedreason` - Archive reason (conditional visibility)

**beforeSubmit Hook:**
- Updates category indexes via API
- Fetches current user info
- Sets timestamps on create/update
- Handles editorial workflow branch changes

### Created Info Fields

**File:** `tina/collection/shared/createdInfoFields.ts`

**Purpose:** Creation tracking for documents

**Fields:**
- `created` - Creation timestamp (hidden)
- `createdBy` - Creator name (auto-populated)
- `createdByEmail` - Creator email (auto-populated)

### Toolbar Fields

**File:** `tina/collection/shared/toolbarFields.ts`

**Purpose:** Defines available rich-text toolbar options

**Options:** embed, heading, link, quote, ul, ol, bold, italic, highlight, code, codeBlock, mermaid, table

## Embed Templates

**Location:** `components/embeds/`

Available MDX embed components:

| Component | Purpose |
|-----------|---------|
| `endIntro` | Separates intro from body content |
| `emailEmbed` | Email address embed |
| `imageEmbed` | Image embed with caption |
| `boxEmbed` | Callout/box embed |
| `youtubeEmbed` | YouTube video embed |

**Usage in Rich Text:**
```typescript
{
  type: "rich-text",
  name: "body",
  templates: embedTemplates,
  toolbarOverride: toolbarFields
}
```

## Development Workflow

### Modifying the Config

1. Edit `tina/config.tsx` or collection files
2. Run `pnpm dev` to test changes locally
3. For collection changes, update `tina-lock.json` in the content repo

### Testing Changes Locally

1. Ensure `.env` file is configured with all required variables
2. Run `pnpm dev` to start the development server
3. Access TinaCMS admin at `/admin`

### Common Issues

**Category Index Not Updating:**
- Check that the `/api/update-category` endpoint is accessible
- Verify branch resolution in editorial workflow
- Check bearer token authentication

**Search Not Working:**
- Verify `TINA_SEARCH_TOKEN` is set
- Check search indexer configuration
- Ensure `indexBatchSize` is appropriate for your content volume

**Media Uploads Failing:**
- Verify Tina Cloud media store configuration
- Check `public/uploads/` directory permissions
- Ensure media is within size limits

### Editorial Workflow Integration

The configuration supports TinaCMS editorial workflow for content review:

1. Content changes are saved to a `tina/` prefixed branch
2. Changes can be reviewed before merging to main
3. Category indexes are updated when branches are created
4. History URLs work across all branches

## Environment Variables Reference

### Required Variables

```bash
# TinaCMS Authentication
NEXT_PUBLIC_TINA_CLIENT_ID=your_client_id
TINA_TOKEN=your_token
TINA_SEARCH_TOKEN=your_search_token

# Branch Configuration
NEXT_PUBLIC_TINA_BRANCH=main

# Content Repository
LOCAL_CONTENT_RELATIVE_PATH=../../SSW.Rules.Content

# GitHub Integration
NEXT_PUBLIC_GITHUB_ORG=SSWConsulting
NEXT_PUBLIC_GITHUB_REPO=SSW.Rules
```

### Optional Variables

```bash
# Base Path (for subdirectory deployments)
NEXT_PUBLIC_BASE_PATH=/rules
```

## Integration Points

### API Routes

- `/api/update-category` - Updates category indexes when rules are modified
- `/api/categories` - Fetches all categories for the selector
- `/api/rules` - Fetches all rules for the selector
- `/api/branch` - Gets current branch information
- `/api/revalidate-tag` - Revalidates cached content

### Category Index Update Mechanism

The `historyBeforeSubmit` hook in `historyFields.ts` handles category index updates:

1. Normalizes categories array
2. Determines form type (create/update)
3. Resolves current branch (editorial workflow aware)
4. Calls `/api/update-category` with category changes
5. Displays success/error alerts to user

### Search Indexing Process

Search is configured via the `search` section:

1. Content is indexed in batches of 100 items
2. English stopwords are filtered
3. Field length is limited to 100 characters
4. Indexer token authenticates the search service

## Best Practices

### Field Naming Conventions

- Use camelCase for field names
- Prefix hidden fields with underscore if needed
- Use descriptive names for reference fields

### Validation Patterns

- Always validate required fields
- Use custom validation for complex rules
- Provide clear error messages

### Custom Field Development

- Follow existing patterns in `tina/fields/`
- Use `wrapFieldsWithMeta` for consistent styling
- Handle loading and error states
- Support both create and edit modes

### Performance Considerations

- Limit initial results in selectors (e.g., 20 rules)
- Use search filtering for large datasets
- Cache API responses where appropriate
- Batch updates to reduce API calls

## Related Resources

- [TinaCMS Documentation](https://tina.io/docs/)
- [TinaCMS Editorial Workflow](https://tina.io/docs/tina-cloud/editorial-workflow)
- [SSW.Rules.Content Repository](https://github.com/SSWConsulting/SSW.Rules.Content)
- [SSW.Rules README](../README.md)