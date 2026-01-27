# SSW.Rules

[![Gitmoji](https://img.shields.io/badge/gitmoji-%20😜%20😍-FFDD67.svg?style=flat-square)](https://gitmoji.dev) [![Scheduled CodeAuditor test](https://github.com/SSWConsulting/SSW.Rules/actions/workflows/codeauditor-test.yml/badge.svg?event=schedule)](https://github.com/SSWConsulting/SSW.Rules/actions/workflows/codeauditor-test.yml)

This is a Next.js + TinaCMS website pulling data from: 

* [SSW Rules Content Repo 📜](https://github.com/SSWConsulting/SSW.Rules.Content)

## Architecture Diagram

![architecture diagram](./docs/architecture-diagram-ssw-rules.drawio.png)


## Getting Started

### Required Tools
- Node.js (version defined in [.nvmrc](.nvmrc)) – recommended to use nvm
- [corepack](https://github.com/nodejs/corepack) (run corepack enable to manage correct pnpm version)
- [pnpm](https://pnpm.io/installation) package manager
- [python](https://www.python.org/downloads/)


### F5 experience

1. Clone this repo
2. Clone [SSW.Rules.Content](https://github.com/SSWConsulting/SSW.Rules.content)

3. Place both repos in the same parent directory e.g.
```
📁 SSW-dev/
├── 📁 SSW.Rules.Content/
└── 📁 SSW.Rules/ <--- This repo
```

4. Create a `.env` file based off `.env.example` in the root of this repo - get the values from Keeper (SSW.Rules Environment Variables)

5. Run `pnpm install` to install packages

6. Install `pyyaml` python package: `py -3 -m pip install pyyaml`

7. Run `pnpm prepare:content` to generate required mapping JSON files (they are gitignored)

8. Run `pnpm dev` to start the development server


### Syncing and Updating Content

To test changes to MDX rules:

1. Go to your branch in [SSW.Rules.Content](https://github.com/SSWConsulting/SSW.Rules.content)

2. Modify the rule MDX as needed

3. If there are any changes to categories, re-run `pnpm prepare:content`

4. Run `pnpm dev` in this project to start SSW.Rules locally

5. Navigate to http://localhost:3000/rules/ to see your changes

> Note: `pnpm dev` does not track changes in SSW.Rules.Content, therefore, you will need to re-run the command after you make changes

### Branches

- Always create a new branch for your PBIs 
- Always delete your branch once your PR has been merged
- To create a new **content branch** (in `SSW.Rules.Content`), follow the setup steps in the [Wiki](https://github.com/SSWConsulting/SSW.Rules.Content/wiki/How-to-Recreate-the-tina-main-Branch-(If-Deleted))
  
## Builds & Deployment

### Content Changes (SSW.Rules.Content)

Changes made in **SSW.Rules.Content** (e.g. rule MDX, categories, images) will **go live after the PR is merged**.

🎥 Watch the video: [TinaCMS for GitHub - The SSW Rules Migration | Jake Bayliss | SSW Consulting](https://www.youtube.com/watch?v=lqqduKKhH_o)

---

### Code Changes (SSW.Rules)

Code changes made to **SSW.Rules** are deployed as follows:

- **main** deploys to **staging**: https://ssw-rules-tina-staging-c5bwbjc4a8d2g8gm.australiaeast-01.azurewebsites.net/rules
- To deploy to **production**:
  - Create a `release/xx` branch from the current `main` commit you want to ship
  - Manually run the production deployment workflow in [GitHub Actions](https://github.com/SSWConsulting/SSW.Rules/actions/workflows/build-and-deploy.yml)
  - **production**: https://www.ssw.com.au/rules


---

### Python Scripts

#### In this Repository (Website)

- **`build-rule-category-map.py`**  
  Generates two JSON files:
  - `rule-to-categories.json` (maps rules to categories)  
  - `category-uri-title-map.json` (maps category URIs to titles)  
  - `orphaned_rules.json` (maps category URIs to titles)  
  Reads rule data from the `SSW.Rules.Content` repo and runs during the build process (via GitHub Actions) or manually from `scripts/tina-migration`.

- **`prepare-content.js`**  
  A Node.js script that runs `build-rule-category-map.py` and moves the JSON files to the correct location for use by the website.  
  Uses the `LOCAL_CONTENT_RELATIVE_PATH` environment variable to locate the content repo.

#### In the Content Repository

- **`build-rule-category-map.py`**  
  Similar logic to the version in PoC. It processes the `categories/` folder and `.mdx` files to create the same JSON maps.

- **`convert-rule-md-to-mdx.py`**  
  Converts `.md` rule files to MDX format compatible with TinaCMS.  
  Replaces custom markdown patterns (e.g., `Figure`, `good/bad/ok` boxes) with structured MDX components like `<asideEmbed>` and escapes special characters for valid formatting.

- **`modify-sub-categories-frontmatter.py`**  
  Updates frontmatter in sub-category files (excluding `index.md`) to ensure consistency.

- **`modify-top-categories-frontmatter.py`**  
  Targets `index.md` files in sub-category folders and updates frontmatter to match the expected format.

- **`modify-main-category-frontmatter`**  
  Updates `index.md` file at the root of the categories folder.

---

### 📁 Public Content Folder

**All rule content (including .mdx files and images) live into the public/ folder.**

🎥 [The 3 options for storing markdown in GitHub for TinaCMS](https://www.youtube.com/watch?v=JX90jbgAvRw&t=7s)

```
public/
└── uploads/
    └── rules/
        ├── rule-a/
        │   ├── rule.mdx
        │   └── img.png
        └── rule-b/
            ├── rule.mdx
            └── img.png
```

---

### 📝 Adding Editorial Workflow
We've integrated TinaCMS with an editorial workflow to support content editing in a more structured way. If you're unfamiliar with how editorial workflows work in Tina, please refer to the official documentation:

👉 [TinaCMS Editorial Workflow Documentation](https://tina.io/docs/tina-cloud/editorial-workflow)

This workflow allows for content changes to be reviewed before being published, improving collaboration and content quality.


### 🔖 Bookmarks (via SSW.Rules.Functions)

The Bookmark feature uses the **[SSW.Rules.Functions](https://github.com/SSWConsulting/SSW.Rules.Functions)** API.

**Local debugging setup**
1. Clone the `SSW.Rules.Functions` repository.
2. In the repo root, create a `local.settings.json` file and copy the values from Keeper (environment variables for the Functions app).
3. Start the Functions app in **dev** mode.

**Local endpoint**
- By default, the API is available at: `http://localhost:7248`.
- Bookmark data is persisted to the **staging** database.

- Install nodejs version specified in `.nvmrc` (Ideally use `nvm` to use the right version)
- Ensure corepack is enabled - `corepack enable` (this allows auto-install of the correct `yarn` version)

### Getting ready for development
- Clone the repo from https://github.com/SSWConsulting/SSW.Rules
- Run `yarn install` to install packages
- Create environment files `.env.development` based off `.env.template` - get the values from Keeper (SSW.Rules Environment Variables)
- For GitHub App authentication, set the following environment variables:
  - `GH_APP_ID`: Your GitHub App ID
  - `GH_APP_PRIVATE_KEY`: Your GitHub App private key (PEM format, can be base64 encoded)
  - `GITHUB_APP_INSTALLATION_ID`: (Optional) The installation ID. If not provided, the first installation will be used.
  
  See [GitHub App authentication documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation) for more details.
