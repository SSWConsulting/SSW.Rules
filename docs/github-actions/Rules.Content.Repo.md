**TODO**: This is the temporary file for stroing docs for GitHub Actions on SSW.Rules.Content. Once the Tina migration is finished, the content should be put on the [wiki](https://github.com/SSWConsulting/SSW.Rules.Content/wiki) of the SSW.Rules.Content repo.

---
# Check Folder Name 

This GitHub Action automatically checks whether the folder name of a rule matches its `uri` (as defined in `rule.mdx`). If there's a mismatch, it renames the folder and updates the `redirects` field in `rule.mdx` to avoid broken links.    


## When It Runs

This workflow runs **on pull requests** that modify any `rule.mdx` file.
It gets triggered when:

- A PR is **opened**
    
- A PR is **updated (synchronized)**  


## What It Does

1. **Checks out the pull request code**  
    Ensures it’s working with the latest PR branch and all changes
    
2. **Checks for modified `rule.mdx` files**  
    Uses `git diff` to determine whether any `rule.mdx` file has changed compared to `origin/main`.
    
3. **Runs folder renaming logic**  
    If a modified `rule.mdx` is found, it runs a shell script (`.workflow/rename-folders.sh`) that:
    
    - Reads the `uri:` field from each changed `rule.mdx`
    - Compares it to the folder name
        
    - Renames the folder if there's a mismatch
        
    - Updates the `redirects:` field in `rule.mdx` to include the old folder name, so previous URLs still work
        
4. **Commits and pushes the changes**  
    If any folders were renamed, it automatically commits and pushes the changes back to the PR branch with the message:  
    `"Rename folder to match URI"`

---

# Validate Frontmatter

This GitHub Action validates the **YAML frontmatter** in markdown (`.mdx`) files whenever a pull request is opened or updated. It checks for required fields, formatting issues, and schema violations to ensure content consistency across rules and categories.  
  
### When It Runs

- On **pull requests to `main`**
    
- **Manually**, via the **"Run workflow"** button in the Actions tab  
  
  
### What It Does

#### 1. **Checks out the PR branch**

- Pulls the full Git history (`fetch-depth: 0`)
    
- Uses the PR branch as the ref to analyze changes
    

#### 2. **Sets up Node.js**

- Required for running the validation script
    

#### 3. **Gets changed files**

- Uses `git diff` against `origin/main` to collect the list of changed files
    
- Stores the list as a comma-separated string (`env.changed`)
    

#### 4. **Runs the frontmatter validator script**
#### 5. **Adds a summary (if validation fails)**

- Displays errors in the **GitHub Actions summary view** so contributors can easily review what's wrong
#### 6. **Leaves a comment on the PR (if from same repo)**

- If the validation fails and the PR **is not from a fork**, it will comment directly on the pull request with a list of the issues.


---

# Validate MDX


This GitHub Action automatically lints and auto-fixes Markdown files in pull requests. It helps enforce consistent formatting and style using markdownlint, while also leaving helpful comments on the PR if issues remain.
  
### When It Runs

- **On pull requests to `main`**, but only if `.mdx` files are changed
    
- **Manually**, using the **"Run workflow"** button in the Actions tab
    
  
### What It Does

#### 1. **Checks out the PR branch**
#### 2. **Detects changed MDX files**
#### 3. **Installs `eslint` and `eslint-plugin-mdx`**
#### 4. **Automatically fixes common issues**
#### 5. **Lints the MDX files again (if not from a fork)**
#### 6. **Comments on the PR (if issues found and PR is not from a fork)**

    
- Generates a detailed markdown table with:
    
    - File name
        
    - Line number
        
    - Problem description
        
    - ESLint rule name


---

# Check For Duplicate Image Names

"Check For Duplicate Image Names" is designed to fix the rendering issue that occurred with Gatsby. If two images share the same name but are used in different rules, one of the rules will display the incorrect image.


Therefore, this action has been set up to run weekly or manually in order to:
- Check for duplicate image names in `Rules.Content`
- Rename them if any are found
- Update the image path in the relevant `rule.mdx`
- Create a pull request if changes are made


## Running the action
1. Go to **SSWConsulting | SSW.Rules.Content | Actions | Check For Duplicate Image Names**
2. Press **Run workflow | Run workflow** ensuring the branch is set to "main"
![image](https://github.com/SSWConsulting/SSW.Rules.Content/assets/127192800/6dabc393-c360-47c6-96e9-c07400820654)
3. Wait for the task to finish
4. Once it's finished, this is what will happen:
    - If there are changes made, a pull request called "Auto Rename Duplicate Images" will be created
![image](https://github.com/SSWConsulting/SSW.Rules.Content/assets/127192800/c9557020-23fd-43e4-b2ad-2b319d88bd58)
**Figure: Example PR on https://github.com/SSWConsulting/SSW.Rules.Content/pull/8125**

    - If there are no changes, no pull request will be created and the action exits silently

