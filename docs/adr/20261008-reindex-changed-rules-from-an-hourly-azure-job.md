# Re-index changed rules from an hourly Azure job

- Status: accepted
- Deciders: Anton Polkanov
- Date: 2026-10-08
- Tags: ai-chat, search, infrastructure, content-pipeline

## Context and Problem Statement

[Re-index changed rules from an Azure job on every content merge](20261007-reindex-changed-rules-from-an-azure-job.md) had `SSW.Rules.Content` start the index job through `repository_dispatch` on every merge to `main`. That call needs a token with Contents: write on `SSW.Rules`. Such a token can push to any unprotected branch, including workflow changes that run with the repo's secrets. A personal token also expires, or leaves with its owner, and nothing would notice: the nightly run keeps succeeding.

The index script is incremental. A run with no changes clones the rules, compares their hashes with the stored ones and stops, so running it often costs almost nothing.

How should a rule change start re-indexing?

## Considered Options

1. An hourly schedule on the Azure job, with no trigger from the content repo
2. `repository_dispatch` from the content repo, signed by a GitHub App installed only on `SSW.Rules`
3. `repository_dispatch` from the content repo, signed by a personal access token

## Decision Outcome

Chosen option 1: "An hourly schedule on the Azure job", because it needs no credential outside Azure and no change to the content repo, and an hour is quick enough for rules to reach The Rulekeeper.

How it works:

- Each environment's Container Apps job runs at the top of every hour, and can still be started by hand.
- A run waits for one that's still going, so back-to-back runs don't fail.
- Everything else in the previous decision stands: one index per environment, failure emails, and the alert when an index hasn't updated for two days.

Not decided here:

- Whether the hour should shrink once the cost of a no-change run has been measured.

## Pros and Cons of the Options

### An hourly schedule on the Azure job

- ✅ No token or App to create, store, rotate or lose.
- ✅ Nothing to add to `SSW.Rules.Content`.
- ❌ A new rule can take up to an hour to reach the chat.
- ❌ 24 runs a day per environment, most of which find nothing to do.

### `repository_dispatch` signed by a GitHub App

- ✅ A change reaches the chat within minutes.
- ✅ The App's permissions are limited to the one repo, and its tokens don't expire with a person.
- ❌ Needs an org admin to create and install the App, and a workflow plus a secret in the content repo.

### `repository_dispatch` signed by a personal access token

- ✅ A change reaches the chat within minutes.
- ❌ Contents: write on `SSW.Rules` is far more than starting a job needs.
- ❌ The token expires, or leaves with its owner, without any alert.

## Links

- Supersedes [Re-index changed rules from an Azure job on every content merge](20261007-reindex-changed-rules-from-an-azure-job.md)
