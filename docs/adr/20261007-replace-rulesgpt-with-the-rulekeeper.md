# Replace RulesGPT with The Rulekeeper, built into the Rules site

- Status: accepted
- Deciders: Anton Polkanov, Tom Iwainski, Josh Berman
- Date: 2026-10-07
- Tags: ai-chat, rulesgpt

## Context and Problem Statement

People struggle to find rules, especially new ones that Google has not indexed yet. Site search is easy to miss: it only appears on the home, search, latest and archived pages, not on rule or category pages, and it only matches titles and descriptions, not rule text.

SSW already has a rules chatbot, RulesGPT (`SSWConsulting/SSW.Rules.GPT`), linked from the Rules site header. It is a separate Blazor app and .NET API that keeps its vectors in a Supabase database. In October 2026 its production health endpoint returned 503 "Unhealthy", its repo had six open "unhandled error" bugs dating back to January 2026, and its embedding refresh only looks for `rules/*/rule.md`, which no longer matches the content layout after the move to TinaCMS (`public/uploads/rules/*/rule.mdx`).

Should we fix RulesGPT, build a new chat into the Rules site, or only improve site search?

## Considered Options

1. Build a new chat, The Rulekeeper, into the Rules site and retire RulesGPT
2. Fix RulesGPT and keep it as a separate app
3. Improve site search only (put it on every page and index rule text), with no AI

## Decision Outcome

Chosen option 1: "Build a new chat, The Rulekeeper, into the Rules site and retire RulesGPT", because it puts the chat on every page people are already reading, removes a second app and pipeline that has been broken for months without anyone noticing, and lets the chat share the site's sign-in, hosting and content pipeline.

Site search stays: The Rulekeeper is added alongside it, not instead of it. Search will also be improved: today it only appears on some pages, matches titles and descriptions but not rule text, and updates only during the daily deploy. How to improve it is a separate decision.

When The Rulekeeper goes live, the RulesGPT header link (`SSW.Rules/components/server/MegaMenuWrapper.tsx`) is removed, and RulesGPT's Azure resources and Supabase project are shut down.

## Pros and Cons of the Options

### Build a new chat, The Rulekeeper, into the Rules site and retire RulesGPT

- ✅ Available on every page, as a floating window that can also be popped out.
- ✅ Uses the site's existing sign-in, hosting and deployments.
- ✅ The index can be kept current from the same content repo the site is built from.
- ❌ Work to build and maintain, where RulesGPT already exists.
- ❌ Adds AI code and a database to a site that has neither today.

### Fix RulesGPT and keep it as a separate app

- ✅ The app, its UI and its conversation history already exist.
- ❌ Two apps, two deploy pipelines and a third-party database to keep running for one feature.
- ❌ Not available on every page. People have to leave the rule they are reading, and the Rules site, to use it.
- ❌ Its embedding refresh needs rewriting for the new content layout anyway.

### Improve site search only, with no AI

- ✅ Cheapest; no AI cost or AI-specific risk.
- ❌ Still keyword matching: finds rules that use the words in the question, not rules about the topic.
- ❌ Cannot answer "what do the rules say about X".
- ❌ Not a floating window, so searching takes people away from the rule they are reading.

## Links

- RulesGPT repo: https://github.com/SSWConsulting/SSW.Rules.GPT
- Refined by [Answer questions from the rules with vector search](20261007-answer-questions-from-the-rules-with-vector-search.md)
