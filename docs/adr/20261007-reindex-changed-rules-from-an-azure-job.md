# Re-index changed rules from an Azure job on every content merge

- Status: proposed
- Deciders: Anton Polkanov, Tom Iwainski, Josh Berman
- Date: 2026-10-07
- Tags: ai-chat, search, infrastructure, content-pipeline

## Context and Problem Statement

New and edited rules must reach The Rulekeeper quickly; slow discovery of new rules is why it exists. Rules are created and edited through TinaCMS or pull requests, and both end up as commits on `main` in `SSW.Rules.Content`.

The index script (`SSW.Rules/scripts/rules-chat/index-rules.mjs`) is incremental. It compares a hash of each rule file with what is stored, so a run embeds only new and changed rules, removes deleted and archived ones, and re-embeds everything when the embedding model or chunking rules change.

RulesGPT's index went stale for months without anyone noticing, so failures must be visible.

When and where should the index script run?

## Considered Options

1. An Azure job, triggered on every merge to `main` in `SSW.Rules.Content`, plus a nightly run
2. A GitHub Actions job that connects to the database directly
3. The Rules site's existing content webhook (`/api/revalidate`), indexing each changed rule as it is saved
4. Only during the daily site deploy, next to the Algolia sync

## Decision Outcome

Chosen option 1: "An Azure job, triggered on every merge, plus a nightly run", because one trigger covers every way a rule changes, the database stays private inside Azure, and the nightly run catches anything a failed run missed.

How it works:

- A GitHub Action in `SSW.Rules.Content` starts the job when `main` changes. A new or edited rule is searchable within minutes of merge.
- The same job runs nightly as a safety net.
- Every environment that serves the chat (staging and production) has its own index, built from the content branch that environment shows.
- Runs for the same environment never overlap.
- A failed run emails a distribution group, and a check alerts when an index has not updated for two days.

Expected cost: about $0. The job should fit in Azure Container Apps' monthly free allowance, and embedding only changed rules costs fractions of a cent.

Not decided here:

- The distribution group that receives failure emails.

## Pros and Cons of the Options

### An Azure job, triggered on every merge, plus a nightly run

- ✅ Covers creates, edits, renames, archives and deletes, whatever tool made the change.
- ✅ The database does not need to be reachable from GitHub.
- ❌ One more Azure resource to deploy and monitor.

### A GitHub Actions job that connects to the database directly

- ✅ Simplest to build; no Azure job.
- ❌ The database must accept connections from GitHub's runners, or a self-hosted runner is needed.

### The existing content webhook

- ✅ Fastest: seconds after a save.
- ❌ Handles added and modified content only, not deletes.
- ❌ Not confirmed to fire for rules merged through GitHub pull requests.
- ❌ The chunking code would have to move into the site and stay in step with the script.

### Only during the daily site deploy

- ✅ No new trigger; the deploy already syncs Algolia.
- ❌ New rules wait up to a day, which is the problem The Rulekeeper is meant to fix.

## Links

- Refines [Use Azure SQL Database for vector search](20261007-use-azure-sql-database-for-vector-search.md)
- Related to [Embed active rule text with labelled examples, and leave out archived rules](20261007-embed-active-rule-text-with-labelled-examples.md)
