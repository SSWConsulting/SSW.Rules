# Answer questions from the rules with vector search

- Status: accepted
- Deciders: Anton Polkanov, Tom Iwainski, Josh Berman
- Date: 2026-10-07
- Tags: ai-chat, search

## Context and Problem Statement

The Rulekeeper has to answer two kinds of question: "do we have rules about X?", where people expect every relevant rule, and "what do the rules say about X?", where people expect an answer with the rules it came from.

Today the site's Algolia index holds titles, SEO descriptions, authors and categories, but not rule text, and it is rebuilt only during a deploy (daily for production). Nothing in the site embeds or vectorises content.

How should The Rulekeeper find the rules that answer a question?

## Considered Options

1. Vector search plus an AI model (retrieval-augmented generation): split every rule into chunks, store an embedding of each chunk, find the chunks closest in meaning to the question, and have the model answer only from them, citing the rules it used
2. Keyword search: index rule text in Algolia and show matching rules, with no AI
3. Keyword search plus an AI model: the model turns the question into several Algolia searches and writes the answer

## Decision Outcome

Chosen option 1: "Vector search plus an AI model", because it finds rules by meaning rather than wording, which is what "rules about X" needs, and it supports answers with citations.

The model answers only from the retrieved excerpts, cites each rule it uses, and replies "No rule for that yet. Sounds like you should write one." when the excerpts do not cover the question. A local prototype indexed 3,384 active rules into about 10,000 chunks and answered test questions correctly with citations.

Hybrid search (keyword plus vector) is not part of this decision. It can be added later if exact terms such as product names rank too low.

## Pros and Cons of the Options

### Vector search plus an AI model

- ✅ Finds rules by meaning, so the wording of the question matters less.
- ✅ Answers come with links to the rules they are based on.
- ❌ Needs a vector store and an embedding model, and an index that must be kept current.
- ❌ Weaker than keyword search on exact terms, such as product names. Keyword search can be added alongside it later (hybrid search).
- ❌ Answers can still be wrong; citations let people check them.

### Keyword search, with no AI

- ✅ No AI cost, and no risk of a wrong generated answer.
- ✅ Reuses Algolia, which the site already pays for.
- ❌ Misses rules that describe the topic in different words.
- ❌ Lists rules; does not answer questions.

### Keyword search plus an AI model

- ✅ Reuses Algolia; no new database.
- ✅ The model can try several phrasings.
- ❌ Still limited to rules that share words with one of the searches.
- ❌ Algolia record size limits mean long rules must be split anyway.

## Links

- Refines [Replace RulesGPT with The Rulekeeper, built into the Rules site](20261007-replace-rulesgpt-with-the-rulekeeper.md)
- Refined by [Use Azure SQL Database for vector search](20261007-use-azure-sql-database-for-vector-search.md)
- Refined by [Embed active rule text with labelled examples, and leave out archived rules](20261007-embed-active-rule-text-with-labelled-examples.md)
