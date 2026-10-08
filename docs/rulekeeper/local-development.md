# Running The Rulekeeper locally

The Rulekeeper answers questions from the rules. It looks up the rule excerpts closest to a question in a vector index, then writes an answer from them. Locally, everything runs on your machine, started by .NET Aspire. You don't need an Azure account.

## What you need

- **The .NET 10 SDK** and the **Aspire CLI 13.6 or later**, no older than the AppHost's Aspire packages. Install it with `curl -sSL https://aspire.dev/install.sh | bash`, or update with `aspire update --self`. Check with `aspire --version`. An old CLI, for example the `aspire.cli` .NET global tool, can stop at "Connecting to AppHost...". Remove it with `dotnet tool uninstall -g aspire.cli`.
- **A container runtime**, running. On macOS, [OrbStack](https://orbstack.dev) is recommended: SQL Server's image is Intel-only, and OrbStack runs it through Rosetta, faster and lighter than Docker Desktop. Docker Desktop works too.
- **Ollama** from [ollama.com](https://ollama.com), running. Aspire uses the Ollama app on macOS, because Docker on a Mac can't use the GPU. On Windows and Linux, Aspire runs Ollama in a container instead.
- **This repo set up as usual.** That's `pnpm install` and a `.env.local` with `LOCAL_CONTENT_RELATIVE_PATH` pointing at your `SSW.Rules.Content` clone (see the README).

## Run it

From the repo root:

```bash
aspire run --project src/RulesChat/RulesChat.AppHost
```

The terminal prints a link to the Aspire dashboard. It shows each part's state and logs:

| Resource | What it does |
|---|---|
| `sql` / `RulesChat` | SQL Server 2025 in Docker, on `localhost:14333`. It keeps its data between runs. |
| `rules-chat-schema` | Applies the EF Core migrations, then finishes. |
| `ollama`, `ollama-pull-bge-m3` | The embedding model. It downloads about 1 GB the first time. |
| `rules-chat-index` | Indexes a sample of 200 rules. The first run takes under a minute; later runs skip unchanged rules. |
| `site` | The Next.js site, at http://localhost:3000/rules. |

To index every rule instead of a sample, set `RulesChat:IndexSample` to `all`:

```bash
dotnet user-secrets set RulesChat:IndexSample all --project src/RulesChat/RulesChat.AppHost
```

## How it fits together

```
SSW.Rules.Content/public/uploads/rules/*/rule.mdx
        │  scripts/rules-chat/index-rules.mjs: read, clean, split into chunks
        ▼
Ollama (bge-m3)  ──  turns each chunk into 1,024 numbers (its embedding)
        │
        ▼
SQL Server, database RulesChat
  dbo.IndexedRules   one row per rule, with a hash to skip unchanged rules
  dbo.RuleChunks     one row per chunk, with its text and vector(1024) embedding
```

The tables are defined by the EF Core model and migrations in `src/RulesChat/RulesChat.Database`. Staging and production deploys run the same project to apply them.

## Common tasks

| Task | How |
|---|---|
| See how one rule is split into chunks | `pnpm rules-chat:index --show <rule-uri>` (needs no database) |
| Re-run the index | The dashboard → `rules-chat-index` → Restart |
| Change the schema | Edit the entities in `src/RulesChat/RulesChat.Database`, then `cd src/RulesChat && dotnet tool restore && dotnet ef migrations add <Name> --project RulesChat.Database --output-dir Migrations`. Never write migrations by hand. |
| Run the index outside Aspire | Set the `RULES_CHAT_SQL_*` settings in `.env.local` (see `.env.example`), then `pnpm rules-chat:index`. Add `--reembed` to embed every rule again. |
| Index refuses to remove many rules | A full run stops before removing more than a fifth of the index, in case the rules were read wrongly. If that many really were archived or deleted, pass `--allow-removals`, or tick "Allow removals" in the Index Rules workflow. |
| Get the local SQL password | `dotnet user-secrets list --project src/RulesChat/RulesChat.AppHost` |
| Delete the local database | Stop Aspire, then `docker volume rm ssw-rules-chat-sql` |

After changing how rules are cleaned or chunked in `scripts/rules-chat/index-rules.mjs`, bump `CHUNKING_VERSION` in that file. The next index run then re-embeds every rule.

## Troubleshooting

| Problem | Fix |
|---|---|
| `sql` stays Unhealthy, and its log says "Password did not match" | The data volume keeps the password SQL Server first started with, and the AppHost's user secrets now hold a different one. Delete the volume (`docker volume rm ssw-rules-chat-sql`) and run again. |
| `ollama` is Unhealthy (macOS) | Start the Ollama app. |
| SQL Server takes minutes to start, or the Mac gets hot | Microsoft only publishes the image for Intel, so Apple Silicon emulates it. It's slow the first time and usually fine after. |
| Stuck at "Connecting to AppHost..." | Check `aspire --version`. It must be 13.6 or later; see What you need. |
| Port 3000 or 14333 is in use | Stop whatever else is using it, for example another `pnpm dev` (port 3000) or another SQL Server container (port 14333). |
| `rules-chat-index` says the model returned a different number of dimensions | `RULES_CHAT_EMBEDDING_DIMENSIONS` doesn't match the model. Leave it unset for `bge-m3`. |

## In Azure

Staging and production use Azure SQL and Microsoft Foundry instead (see [`infra/README.md`](../../infra/README.md)). They sign in with a managed identity, so they have no passwords or API keys. To index them, run the **Index Rules for The Rulekeeper** workflow from the Actions tab.
