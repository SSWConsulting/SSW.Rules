# Use Azure SQL Database for vector search

- Status: accepted
- Deciders: Anton Polkanov, Tom Iwainski, Josh Berman
- Date: 2026-10-07
- Tags: ai-chat, search, infrastructure, database

## Context and Problem Statement

Vector search needs somewhere to store about 10,000 rule chunks with their embeddings (about 50 MB including text) and to find the closest ones for each question. The Rules site has no database today: its Azure resources are the App Service, Application Insights, Log Analytics and the container registry.

The local prototype stores vectors in SQL Server 2025 using the `VECTOR` type and `VECTOR_DISTANCE`. A search over the full index took about 20 ms.

Where should the vectors live in staging and production?

## Considered Options

1. Azure SQL Database
2. Azure AI Search
3. Reuse RulesGPT's Supabase (Postgres) database

## Decision Outcome

Chosen option 1: "Azure SQL Database", because the prototype already runs on the same `VECTOR` type, the same database can hold the per-user usage counts the chat needs, and the team already uses SQL Server vector search in HubX.

Each environment that serves the chat gets its own database, in Australia East next to the site: staging and production. PR preview deployments share staging's.

Not decided here:

- The service tier. Expected cost is about $5–15 a month for staging (Basic or S0) and $15–30 for production (S0 or S1), from public US pay-as-you-go prices. Search speed on the smallest tier has not been measured.
- Avoid a tier that pauses when idle, or accept the delay on the first question after a pause.
- Confirm that the chosen tier and region support the `VECTOR` type before provisioning.

## Pros and Cons of the Options

### Azure SQL Database

- ✅ Same vector features as the prototype, so the code carries over.
- ✅ Also holds the usage counts for rate limiting.
- ✅ Familiar to the team; SQL Server vector search is already used in HubX.
- ❌ A new paid resource for a site that has no database today.
- ❌ No built-in keyword-plus-vector search; keyword search would be added with full-text search if needed.

### Azure AI Search

- ✅ Keyword and vector search combined in one service, with ranking built in.
- ✅ Managed indexing features.
- ❌ A separate paid service that only does search; rate-limit counts would still need a database.
- ❌ The prototype's search and indexing code would need rewriting.

### Reuse RulesGPT's Supabase database

- ✅ Already exists, with vector support (pgvector).
- ❌ Its data is stale and RulesGPT is being retired.
- ❌ Hosted outside SSW's Azure, with a separate account, billing and security review.

## Links

- Refines [Answer questions from the rules with vector search](20261007-answer-questions-from-the-rules-with-vector-search.md)
- Azure SQL vector data type: https://learn.microsoft.com/sql/t-sql/data-types/vector-data-type
