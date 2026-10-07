# Use Microsoft Foundry for chat and embedding models

- Status: accepted
- Deciders: Anton Polkanov, Tom Iwainski, Josh Berman
- Date: 2026-10-07
- Tags: ai-chat, ai-provider, infrastructure

## Context and Problem Statement

The Rulekeeper needs two models: an embedding model that turns rule chunks and questions into vectors, and a chat model that writes answers from the retrieved excerpts.

Where should these models run?

## Considered Options

1. Microsoft Foundry
2. A provider's own API directly (for example OpenAI or Anthropic)
3. OpenRouter
4. Self-hosted open models (for example through Ollama)

## Decision Outcome

Chosen option 1: "Microsoft Foundry", because it keeps the models in SSW's Azure tenant, alongside the rest of the Rules site's infrastructure and billing.

The code talks to any OpenAI-compatible endpoint, configured with `RULES_CHAT_AI_BASE_URL`, `RULES_CHAT_CHAT_MODEL` and `RULES_CHAT_EMBEDDING_MODEL`. Local development uses Ollama (`bge-m3` for embeddings, `qwen3.5:9b` for chat) through the same code.

Models:

- Chat: `gpt-6-luna`, the fast, low-cost model in the GPT-6 family, with reasoning effort set to the lowest level.
- Embeddings: `text-embedding-3-large` with `dimensions: 1024`, so the vectors fit the existing `VECTOR(1024)` column. Changing the embedding model means re-embedding every rule (cheap, but every environment must be re-indexed together).

Both use Global Standard deployments, created in the Foundry resource in Australia East. A Global deployment can process a request in any Azure region. That is acceptable because the rules are public, and the only private content sent to a model is what a user types into the chat. Users' identities are never sent.

Expected cost: about $1 per 1,000 questions (about 8,000 tokens in and 400 out per question, estimated from the prompt size, at $0.10 per million input tokens and $0.50 per million output tokens), and about $1 to re-embed every rule.

## Pros and Cons of the Options

### Microsoft Foundry

- ✅ Runs in SSW's Azure tenant; one bill and one security boundary.
- ✅ Offers several model families behind one service.
- ❌ New models can reach Foundry later than the provider's own API.

### A provider's own API directly

- ✅ Newest models first.
- ❌ Another vendor account, key and bill outside Azure.

### OpenRouter

One API in front of many providers' models.

- ✅ One key and one bill for models from many providers, easy to switch between them.
- ✅ OpenAI-compatible, so it works with the same code.
- ❌ Another vendor outside Azure, and requests pass through it to the model provider.

### Self-hosted open models

- ✅ No per-question cost; data never leaves SSW.
- ✅ Good enough for local development and demos.
- ❌ Needs GPU hosting in production, which costs more than per-question pricing at this volume.
- ❌ Answer quality is below hosted models.

## Links

- Refines [Answer questions from the rules with vector search](20261007-answer-questions-from-the-rules-with-vector-search.md)
- Azure OpenAI pricing: https://azure.microsoft.com/pricing/details/azure-openai/
- Region availability for Foundry models: https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability
