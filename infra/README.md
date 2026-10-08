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
- **PR slots** share staging's database and models through the same identity. Every PR slot gets a new system-assigned identity, so access can't be granted to those.

### Before the first deployment

The subscription needs, once:

- **Providers.** `Microsoft.Sql`, `Microsoft.CognitiveServices` and `Microsoft.ManagedIdentity` are registered.
- **Quota.** There is Global Standard quota in Australia East for both models: 100K tokens per minute of `gpt-6-luna` and 150K of `text-embedding-3-large`. Check with `az cognitiveservices usage list -l australiaeast -o table`.

The site's database access is granted by the pipeline too, together with the database schema.

### Looking at the data

Nobody signs in to the database day to day. To look at data while debugging, someone with Owner rights on the subscription can temporarily make themselves the administrator in the portal: the SQL server → **Settings** → **Microsoft Entra ID** → **Set admin**. The next deployment sets the pipeline back as the administrator.

### Sizes and cost

| | Staging | Production |
|---|---|---|
| Database | General Purpose serverless, 1 vCore, pauses after 60 idle minutes | Standard S1, fixed price, never pauses |
| Models | Pay per token | Pay per token |

The first question after staging's database pauses waits while it resumes. Production uses S1 so real users never wait for that.

Global Standard model deployments can process a request in any Azure region. See the ADR [Use Microsoft Foundry for chat and embedding models](../docs/adr/20261007-use-microsoft-foundry-for-chat-and-embeddings.md).
