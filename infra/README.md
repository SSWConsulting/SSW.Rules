# Infrastructure

`main.bicep` describes every Azure resource the site runs on. `deploy.ps1` deploys it, and the `deploy-infrastructure.yml` workflow runs `deploy.ps1` before every staging, production and PR deployment.

```bash
# Preview a deployment without changing anything
./infra/deploy.ps1 -Environment staging -ResourceGroup <resource group> -RulesChatSqlAdminClientId <pipeline client ID> -WhatIf
```

## The Rulekeeper (Rules Chat)

The Rulekeeper needs three more resources in each environment, deployed with everything else:

| Resource | Name | Purpose |
|---|---|---|
| User-assigned managed identity | `id-sswrules-chat-{env}` | The identity the site, its slots and PR slots use to reach the database and the models |
| Azure SQL server and database | `sql-sswrules-chat-{env}`, database `RulesChat` | The rules' vector index and per-user usage counts |
| Microsoft Foundry resource | `aif-sswrules-chat-{env}` | `gpt-6-luna` for answers and `text-embedding-3-large` for the index |

Nothing uses keys or passwords:

- **SQL** accepts Microsoft Entra sign-in only. Its administrator is the deployment pipeline's service principal, the same one GitHub Actions already signs in to Azure with, so every deployment can apply schema changes and grant the site access without a person running scripts.
- **Foundry** has API keys turned off, and the managed identity has the Cognitive Services OpenAI User role on it.
- **PR slots** share staging's database and models through the same identity. Every PR slot gets a new system-assigned identity, so access can't be granted to those. A PR deploy only attaches the identity; it never changes the shared database or models, so PR branches can't change what staging uses.

### Before the first deployment

The subscription needs, once:

- **Providers.** `Microsoft.Sql`, `Microsoft.CognitiveServices`, `Microsoft.ManagedIdentity` and `Microsoft.App` are registered.
- **Quota.** There is Global Standard quota in Australia East for both models: 100K tokens per minute of `gpt-6-luna` and 150K of `text-embedding-3-large`. Check with `az cognitiveservices usage list -l australiaeast -o table`.

The pipeline also gives the site access to the database, together with the database schema. It creates the identity's database user with `CREATE USER … WITH SID = …, TYPE = E`, where the SID comes from the identity's client ID (the `rulesChatIdentityClientId` output). That needs no directory lookup, so the SQL server doesn't need Microsoft Graph permissions or the Directory Readers role. The catch is that SQL doesn't check the ID: a wrong client ID creates the user without an error, and only shows up later as a failed sign-in from the site.

### Keeping the index up to date

| Resource | Name | Purpose |
|---|---|---|
| Container Apps environment | `cae-sswrules-chat-{env}` | Hosts the index job; logs go to the environment's Log Analytics workspace |
| Container Apps job | `caj-sswrules-chat-index-{env}` | Runs `scripts/rules-chat/job`: fetches SSW.Rules.Content and embeds the new and changed rules |

The job runs as the Rules Chat identity and pulls its image (`rules-chat-index:{staging|production}`) from the environment's registry. Each staging and production deploy rebuilds and pushes that image before deploying the job.

It runs:

- **Nightly**, at 15:00 UTC (01:00 Sydney standard time), as a safety net.
- **When rules change.** SSW.Rules.Content sends a `rules-content-changed` dispatch on every merge to `main`, and the **Re-index Rules for The Rulekeeper** workflow starts the staging job. It can also be started by hand for either environment.
- **By hand from a GitHub runner** with **Index Rules for The Rulekeeper**, the fallback for resetting an index.

Runs never overlap: the index script takes a database lock, and a second run stops straight away. It also stops if the tables don't exist, which means the environment hasn't been deployed yet.

**Alerts.** Set the GitHub environment variable `RULES_CHAT_ALERT_EMAIL` to email a distribution group:

- when a run fails;
- when no run has succeeded for two days.

Without it, no alerts are created. Both alerts search the job's logs for markers the index script prints (`RULES_CHAT_INDEX_FAILED` and `RULES_CHAT_INDEX_SUCCEEDED`). The staleness alert also fires in the two days after a new environment's first deploy, until the job first succeeds.

The job reads the content branch the site shows: the `NEXT_PUBLIC_TINA_BRANCH` GitHub variable, or `main`.

### Looking at the data

Nobody signs in to the database day to day. To look at data while debugging, someone with Owner rights on the subscription can temporarily make themselves the administrator in the portal: the SQL server → **Settings** → **Microsoft Entra ID** → **Set admin**.

That access only lasts until the next deployment of that environment, which sets the pipeline back as the administrator. Staging deploys on every merge to `main`, so expect to lose access whenever something merges.

### Sizes and cost

| | Staging | Production |
|---|---|---|
| Database | General Purpose serverless, 1 vCore, pauses after 60 idle minutes | Standard S1, fixed price, never pauses |
| Models | Pay per token | Pay per token |

The first question after staging's database pauses waits while it resumes. Production uses S1 so real users never wait for that.

Global Standard model deployments can process a request in any Azure region. See the ADR [Use Microsoft Foundry for chat and embedding models](../docs/adr/20261007-use-microsoft-foundry-for-chat-and-embeddings.md).

### Model versions

`main.bicep` pins each model's version. Azure keeps a deployment on that version until the version retires, then moves it to the current default. Before a retirement date (listed on Microsoft's model retirement page), bump the version in `main.bicep` and deploy, so the template never pins a retired version.
