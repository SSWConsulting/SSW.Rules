# Running The Rulekeeper locally

The Rulekeeper answers questions from the rules. It looks up the rule excerpts closest to a question in a vector index, then writes an answer from them. Locally, everything runs on your machine: SQL Server in Docker and the models in Ollama. You don't need an Azure account.

## What you need

- **Docker Desktop**, running.
- **Ollama** from [ollama.com](https://ollama.com), running.
- **This repo set up as usual.** That's `pnpm install` and a `.env.local` with `LOCAL_CONTENT_RELATIVE_PATH` pointing at your `SSW.Rules.Content` clone (see the README).
- **About 3 GB free:** about 1 GB for the embedding model, and the rest for SQL Server.

## Set up

```bash
pnpm rules-chat:setup
```

It's safe to run again; every step skips what's already done.

1. It adds any missing `RULES_CHAT_*` settings to `.env.local`, including a generated SQL Server password.
2. It checks that the rules content is where `LOCAL_CONTENT_RELATIVE_PATH` says.
3. It checks that Ollama is running, and downloads the `bge-m3` embedding model if needed.
4. It starts SQL Server 2025 in Docker on `localhost:14333`, and waits until it accepts connections.
5. It creates the tables and indexes a sample of 200 rules, which takes a few minutes.

To index every rule instead, which takes much longer, run `pnpm rules-chat:setup --all` or `pnpm rules-chat:index`.

## How it fits together

```
SSW.Rules.Content/public/uploads/rules/*/rule.mdx
        │  pnpm rules-chat:index: read, clean, split into chunks
        ▼
Ollama (bge-m3)  ──  turns each chunk into 1,024 numbers (its embedding)
        │
        ▼
SQL Server in Docker, database RulesChat
  dbo.IndexedRules   one row per rule, with a hash to skip unchanged rules
  dbo.RuleChunks     one row per chunk, with its text and VECTOR(1024) embedding
```

The tables are defined in `db/rules-chat/`, one file per table. `pnpm rules-chat:schema` applies them, and so does every staging and production deploy.

## Common tasks

| Task | Command |
|---|---|
| Index new and changed rules | `pnpm rules-chat:index` |
| See how one rule is split into chunks, without indexing | `pnpm rules-chat:index --show <rule-uri>` |
| Start the index again from empty | `pnpm rules-chat:index --reset` |
| Apply the table definitions only | `pnpm rules-chat:schema` |
| Stop SQL Server | `docker compose -f scripts/rules-chat/docker-compose.yml stop` |
| Delete SQL Server and its data | `docker compose -f scripts/rules-chat/docker-compose.yml down -v` |

After changing how rules are cleaned or chunked in `scripts/rules-chat/index-rules.mjs`, bump `CHUNKING_VERSION` in that file. The next index run then re-embeds every rule.

### Using a different embedding model

The index stores 1,024-dimension vectors. Any model works if it returns that size, or can be asked for it:

- **Another Ollama model with 1,024 dimensions:** set `RULES_CHAT_EMBEDDING_MODEL`.
- **A larger model, such as Azure's `text-embedding-3-large`:** also set `RULES_CHAT_EMBEDDING_DIMENSIONS=1024`.

Switching models changes every vector, so run `pnpm rules-chat:index --reset` afterwards.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Docker isn't running" | Start Docker Desktop. |
| "Ollama isn't running" | Start the Ollama app, or run `ollama serve`. |
| "SQL Server rejected the password" | SQL Server keeps the password it first started with. Put that one in `RULES_CHAT_SQL_PASSWORD`, or run `docker compose -f scripts/rules-chat/docker-compose.yml down -v` and set up again. |
| SQL Server takes minutes to start, or the Mac gets hot | Microsoft only publishes the image for Intel, so Apple Silicon emulates it. It's slow the first time and usually fine after. |
| Port 14333 is in use | Change `RULES_CHAT_SQL_PORT` in `.env.local` and the port in `scripts/rules-chat/docker-compose.yml`. |
| "returned 512 dimensions, but the index stores 1024" | `RULES_CHAT_EMBEDDING_DIMENSIONS` doesn't match the model. Leave it unset for `bge-m3`. |

## In Azure

Staging and production use Azure SQL and Microsoft Foundry instead (see [`infra/README.md`](../../infra/README.md)). They sign in with a managed identity, so they have no passwords or API keys. To index them, run the **Index Rules for The Rulekeeper** workflow from the Actions tab.
