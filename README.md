# SSW.Rules

v2 of the Rules.

This is a Gatsby generated site pulling data from:
- [SSW Rules Repo](https://github.com/SSWConsulting/SSW.Rules.Content)


## Getting Started

### Required Tools
- Install nodejs via https://nodejs.org/en/ (required versions: ^8.10.0 or ^10.13.0 or >=11.10.1)
- Install yarn via https://classic.yarnpkg.com/en/

### Getting ready for development
- Clone the repo from https://github.com/SSWConsulting/SSW.Rules
- Run *yarn install* to install packages
- Create environment files (.env.development and .env.production) and ask a member of the SSW.Rules team (@pierssinclairssw, @bradystroud) for the values of the following keys:
```
GOOGLE_ANALYTICS=#{GOOGLE_ANALYTICS}
RECAPTCHA_KEY=#{RECAPTCHA_KEY}
CONTACT_API=#{CONTACT_API}
VERSION_DEPLOYED=#{VERSION_DEPLOYED}
APPINSIGHTS_INSTRUMENTATIONKEY=#{APPINSIGHTS_INSTRUMENTATIONKEY}
CONTENT_BRANCH=#{CONTENT_BRANCH}
AUTH0_CLIENT_ID=#{AUTH0_CLIENT_ID}
AUTH0_DOMAIN=#{AUTH0_DOMAIN}
AUTH0_REDIRECT_URI=#{AUTH0_REDIRECT_URI}
API_BASE_URL=#{API_BASE_URL}
```

### Development
1. Branch off main for your PBI
2. Run *yarn build* (.env.production is required for this step)
3. Do your work
4. Run the site in development mode by *yarn develop* (.env.development is required for this step)
5. Commit code and push
6. Raise a PR
7. Get it merged!

### Definition of Done

- Code Compiles
- Check the Acceptance Criteria.
- Code is squash-merged to main via a pull request that was approved by a 2nd developer.
- Another team member agrees it’s ready for Production.
- Pushed to Production.
- Use @Mention (**OR** Send email) to notify Product Owner/PBI stakeholder that PBI is done (be sure to include screenshots/done video as proof) 

> <As per rule: [Done - Do you go beyond 'Done' and follow a 'Definition of Done'](https://rules.ssw.com.au/done-do-you-go-beyond-done-and-follow-a-definition-of-done)?>

### Branches
- Branching strategy is based off [Release Flow](https://docs.microsoft.com/en-us/azure/devops/learn/devops-at-microsoft/release-flow) 
- **Main** is the main 'dev' branch
- **Release/xx** is the 'production' one (where xx is the Sprint number)
- Always create a new branch for your PBIs 
- Always delete your branch once your PR has been merged

### Builds
- Changes made to http://github.com/SSWConsulting/SSW.Rules.Content (i.e. rule changes) trigger builds that deploy:
  - **main** to the **staging** site: https://sydiisp01.sydney.ssw.com.au/rules/
  - latest **release/xx** to the **production** site: https://www.ssw.com.au/rules
  
- Branching off **main** to **release/xx**, or making changes to **release/xx** will build and deploy to the **production** site: https://www.ssw.com.au/rules


### Rules repository

> Rules repository lives here: https://github.com/SSWConsulting/SSW.Rules.Content

Merging changes to **main** on this repo will trigger:
- a build/release of the **main** branch in Staging (https://sydiis2016q01.sydney.ssw.com.au/rules/).
- a build/release of the **release** branch Production (https://www.ssw.com.au/rules)
