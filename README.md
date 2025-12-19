<<<<<<< HEAD
# SSW.Rules.Tina.Nextjs.POC

[![Gitmoji](https://img.shields.io/badge/gitmoji-%20😜%20😍-FFDD67.svg?style=flat-square)](https://gitmoji.dev) [![Scheduled CodeAuditor test](https://github.com/SSWConsulting/SSW.Rules.Tina.Nextjs.POC/actions/workflows/codeauditor-test.yml/badge.svg?event=schedule)](https://github.com/SSWConsulting/SSW.Rules.Tina.Nextjs.POC/actions/workflows/codeauditor-test.yml)

A POC that will validate the compatibility between Rules and Tina – using Next.js.  

The site pulls data from [SSW Rules Content Repo 📜](https://github.com/SSWConsulting/SSW.Rules.Content)
## Architecture Diagram

![architecture diagram](./docs/architecture-diagram-ssw-rules.drawio.png)

=======
# SSW.Rules

[![Gitmoji](https://img.shields.io/badge/gitmoji-%20😜%20😍-FFDD67.svg?style=flat-square)](https://gitmoji.dev) [![Scheduled CodeAuditor test](https://github.com/SSWConsulting/SSW.Rules/actions/workflows/codeauditor-test.yml/badge.svg?event=schedule)](https://github.com/SSWConsulting/SSW.Rules/actions/workflows/codeauditor-test.yml)

This is a Gatsby generated site pulling data from:
- [SSW Rules Content Repo 📜](https://github.com/SSWConsulting/SSW.Rules.Content)
>>>>>>> old-gatsby/main

## Getting Started

### Required Tools
<<<<<<< HEAD
- Node.js (version defined in .nvmrc) – recommended to use nvm
- [corepack](https://github.com/nodejs/corepack) (run corepack enable to manage correct pnpm version)
- [pnpm](https://pnpm.io/installation) package manager


### F5 experience

1. Clone this repo

2. Clone [SSW.Rules.Content](https://github.com/SSWConsulting/SSW.Rules.content) and switch to the `tina-migration-dev-content` branch

3. Place both repos in the same parent directory e.g.
```
📁 SSW.Rules/
├── 📁 SSW.Rules.Content/
└── 📁 SSW.Rules.Tina.Nextjs.POC/
```

4. Create a `.env` file based off `.env.example` in the root of this repo - get the values from Keeper (SSW.Rules.PoC Environment Variables)

5. Run `pnpm install` to install packages

6. Run `pnpm dev` to start the development server


### Syncing and Updating Content
To test changes to MDX rules:

1. Go to the `tina-migration-dev-content` branch of SSW.Rules.Content

2. Modify the rule MDX as needed

3. Run `pnpm dev` in this project to see the changes reflected locally

### Branches
- Always create a new branch for your PBIs 
- Always delete your branch once your PR has been merged
- To create a new **content branch** (in `SSW.Rules.Content`), follow the setup steps in the [Wiki](https://github.com/SSWConsulting/SSW.Rules.Content/wiki/How-to-Recreate-the-tina-main-Branch-(If-Deleted))
  

## Builds & Deployment

### SSW.Rules.Tina.Nextjs.POC
- Changes made to [SSW.Rules.Tina.Nextjs.POC]() trigger builds that deploy to Azure

### SSW.Rules.Content
- Changes made to [SSW.Rules.Content](http://github.com/SSWConsulting/SSW.Rules.Content) (i.e. rule changes) trigger builds that deploy:
  - **main** to the **staging** - https://ssw-rules-tina-staging-c5bwbjc4a8d2g8gm.australiaeast-01.azurewebsites.net/
  - latest **release/xx** to the **production** site - https://www.ssw.com.au/rules-beta/





## POC Progress Checklist

- [x] Content editing UI working with Tina
- [x] Deployment pipeline for PoC website
- [x] Migration scripts for rule content (Markdown → MDX)
- [x] Rule-to-category JSON generation
- [x] Category URI-title mapping
- [x] Automated content processing via GitHub Actions
- [x] Media content management
- [x] Basic component creation (e.g. Email, YouTube)
- [x] Algolia search integration
- [x] Editorial workflow enabled
- [x] Vercel deployment setup
- [x] Azure deployment setup
- [x] Full deployment with all rules
- [x] Migration script all rules md to mdx
- [ ] Preview deployment on Azure


---

### Python Scripts

#### In the PoC Repository

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

**We moved all rule content (including .mdx files and images) into the public/ folder. Check this PBI for more details: [Media - Implement Media Management Option C](https://github.com/SSWConsulting/SSW.Rules/issues/1775)**

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
🎥 [The 3 options for storing markdown in GitHub for TinaCMS](https://www.youtube.com/watch?v=JX90jbgAvRw&t=7s)
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

=======
- Install nodejs version specified in `.nvmrc` (Ideally use `nvm` to use the right version)
- Ensure corepack is enabled - `corepack enable` (this allows auto-install of the correct `yarn` version)

### Getting ready for development
- Clone the repo from https://github.com/SSWConsulting/SSW.Rules
- Run `yarn install` to install packages
- Create environment files `.env.development` based off `.env.template` - get the values from Keeper (SSW.Rules Environment Variables)
- For `GITHUB_API_PAT`, create a [PAT on GitHub](https://docs.github.com/en/enterprise-server@3.4/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- Set `CONTENT_BRANCH` to `small-content` (it's a smaller version of the main content branch which will build much quicker 🙂)

> **Notes:**  
> * If you don't work at SSW or can't get on to the SSW.Rules team you can just add values to GITHUB_API_PAT and CONTENT_BRANCH  
> * Sometimes you might want to use `main` or create your own branch if you are testing something.

### Development
1. Branch off main for your PBI
2. Install the recommended extensions if using VS Code
3. Do your work
4. Run the site in development mode by `yarn dev` (.env.development is required for this step) it takes a while to build all the rules    
   If you have issues, run `yarn clean` then `yarn dev`
5. Commit code and push
6. Raise a PR
7. Get it merged!

![recommended extensions notification](_docs/img/vs-code-recommended-extensions.png)
**Figure: VS Code recommended extensions notification**

### Definition of Done

- Code Compiles
- Check the Acceptance Criteria.
- Code is squash-merged to main via a pull request that was approved by a 2nd developer.
- Another team member agrees it’s ready for Production.
- Pushed to Production.
- Use @Mention (**OR** Send email) to notify Product Owner/PBI stakeholder that PBI is done (be sure to include screenshots/done video as proof) 

As per rule: [Done - Do you go beyond 'Done' and follow a 'Definition of Done'?](https://www.ssw.com.au/rules/done-do-you-go-beyond-done-and-follow-a-definition-of-done)

### Branches
- Branching strategy is based off [Release Flow](https://docs.microsoft.com/en-us/azure/devops/learn/devops-at-microsoft/release-flow) 
- `main` is the main 'dev' branch
- `release/xx` is the 'production' one (where xx is the Sprint number)
- Always create a new branch for your PBIs 
- Always delete your branch once your PR has been merged

### Builds
- Changes made to http://github.com/SSWConsulting/SSW.Rules.Content (i.e. rule changes) trigger builds that deploy:
  - **main** to the **staging** - check the [latest staging workflow](https://github.com/SSWConsulting/SSW.Rules/deployments/staging) for the url
  - latest **release/xx** to the **production** site - [ssw.com.au/rules](https://www.ssw.com.au/rules)
  
- Branching off **main** to **release/xx**, or making changes to **release/xx** will build and deploy to the **production** site: https://www.ssw.com.au/rules

### GitHub Actions Documentation

📘 Documentation for how GitHub Actions are used in this project is available in the [Wiki](https://github.com/SSWConsulting/SSW.Rules/wiki).

### Rules repository

> Rules repository lives here: https://github.com/SSWConsulting/SSW.Rules.Content

Merging changes to **main** on this repo will trigger:
- a build/release of the **main** branch in Staging - check the [latest staging workflow](https://github.com/SSWConsulting/SSW.Rules/deployments/staging) for the url
- a build/release of the **release** branch Production - [ssw.com.au/rules](https://www.ssw.com.au/rules)

### Example Rule
- An example rule is provided in the repo under `http://localhost:{{ PORT NUMBER }}/rule/`
- This example rules shows all the different components that can be used e.g. headings, lists, boxes, etc.

![image](https://github.com/user-attachments/assets/537ff78a-7e3c-4080-9038-e8ab0c90cab8)
**Figure: Sample of the Example Rule**

### Updating and Syncing a Rule from Rules.Content

Sometimes you might have to update a rule markdown file to test your latest feature, such as changing the background color of a greybox.

To update specific markdown components, follow these steps:

1. Access the `small-content` branch:
   - Visit [SSW.Rules.Content](https://github.com/SSWConsulting/SSW.Rules.Content)
   - Switch to the `small-content` branch
2. Edit the Rule:
   - Locate the rule you want to modify in the `small-content` branch
3. Test Your Changes Locally:
   - Open your local instance of SSW.Rules, usually in VS Code
   - Build the project using the following commands: `yarn clean` and then `yarn dev`
   - Open your local instance in your browser and navigate to the edited rule to see your changes

### Gatsby Build Timeout

The Gatsby build step in GitHub Actions has a 30-minute timeout to prevent it from running indefinitely. This is due to intermittent issues with external dependencies.

For more details on the Gatsby build issue, refer to the [Gatsby issue](https://github.com/gatsbyjs/gatsby/issues/38989).
>>>>>>> old-gatsby/main
