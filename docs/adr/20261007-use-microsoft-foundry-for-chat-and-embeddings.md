# Use Microsoft Foundry for chat and embedding models

- Status: proposed
- Deciders: Anton Polkanov
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

Chosen option 1: "Microsoft Foundry", because it keeps the models in SSW's Azure tenant, alongside the rest of the Rules site's infrastructure and billing, and it can keep data in Australia.

The code talks to any OpenAI-compatible endpoint, configured with `RULES_CHAT_AI_BASE_URL`, `RULES_CHAT_CHAT_MODEL` and `RULES_CHAT_EMBEDDING_MODEL`. Local development uses Ollama (`bge-m3` for embeddings, `qwen3.5:9b` for chat) through the same code.

Data stays in Australia. Models are deployed in an Australian region with a deployment type that processes data in that region. Global deployments, which can process data in any region, are not used. Fewer models are offered this way in Australia than globally, and the price is slightly higher.

Not decided here:

- Which chat model and which embedding model, from those available in Australia. Changing the embedding model means re-embedding every rule (cheap, but every environment must be re-indexed together). One third-party price list says `text-embedding-3-small` is scheduled for deprecation in Azure; check the Foundry catalog before choosing.

Expected cost: about $3–5 per 1,000 questions with a "mini" chat model (about 8,000 tokens in and 400 out per question, estimated from the prompt size; Australian regional prices are slightly above the global prices this is based on), and well under $1 to re-embed every rule.

## Pros and Cons of the Options

### Microsoft Foundry

- ✅ Runs in SSW's Azure tenant; one bill and one security boundary.
- ✅ Can keep data in Australia.
- ✅ Offers several model families behind one service.
- ❌ New models can reach Foundry later than the provider's own API, and fewer are available in Australian regions.

### A provider's own API directly

- ✅ Newest models first.
- ❌ Another vendor account, key and bill outside Azure.

### OpenRouter

One API in front of many providers' models.

- ✅ One key and one bill for models from many providers, easy to switch between them.
- ✅ OpenAI-compatible, so it works with the same code.
- ❌ Another vendor outside Azure, and requests pass through it to the model provider.
- ❌ Cannot guarantee that data stays in Australia.

### Self-hosted open models

- ✅ No per-question cost; data never leaves SSW.
- ✅ Good enough for local development and demos.
- ❌ Needs GPU hosting in production, which costs more than per-question pricing at this volume.
- ❌ Answer quality is below hosted models.

## Links

- Refines [Answer questions from the rules with vector search](20261007-answer-questions-from-the-rules-with-vector-search.md)
- Azure OpenAI pricing: https://azure.microsoft.com/pricing/details/azure-openai/
