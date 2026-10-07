# Cite rules with one number per rule for the whole conversation

- Status: proposed
- Deciders: Anton Polkanov, Tom Iwainski, Josh Berman
- Date: 2026-10-07
- Tags: ai-chat, security

## Context and Problem Statement

The Rulekeeper's answers must show which rules they come from, so people can check them. The model writes citations such as [2], which are turned into links.

Two questions came up while testing. First, the model numbers rules by their position in the search results, so an answer could show [1] and [7] with nothing in between. Second, people want to refer back to an earlier answer, as in "tell me more about [2]", which only works if [2] means the same rule throughout.

Answers are also written by a model reading rule text that anyone can edit through a pull request, so what the chat renders must be limited.

How should citations be numbered and rendered?

## Considered Options

1. One number per rule for the whole conversation
2. Number each answer's citations from 1
3. Keep the search-result positions as the numbers

## Decision Outcome

Chosen option 1: "One number per rule for the whole conversation", because it is the only option that lets a follow-up refer to an earlier citation.

How it works:

- A rule keeps the number it was first cited with. Rules new to the conversation continue the sequence in the order the answer mentions them.
- The chat sends the rules cited so far with each question. The server shows those rules to the model under their existing numbers, and pulls in the text of any rule the question mentions by number.
- Citations to numbers the model was never given are dropped.
- Square brackets inside code are not treated as citations.
- Only links to rules on the site are rendered as links. Other links and images written by the model are shown as plain text or dropped.
- "New chat" starts the numbering again from 1.

## Pros and Cons of the Options

### One number per rule for the whole conversation

- ✅ "Tell me more about [2]" works.
- ✅ The same rule never appears under two numbers.
- ❌ A single answer can show numbers out of order, for example [2] and [5], when it mixes earlier and new rules.
- ❌ The chat and the server must exchange the list of cited rules.

### Number each answer's citations from 1

- ✅ Every answer reads cleanly from [1].
- ❌ [1] means a different rule in each answer, so earlier citations cannot be referred to.

### Keep the search-result positions

- ✅ No renumbering logic.
- ❌ Gaps such as [1] and [7] confuse readers.
- ❌ Numbers change meaning between answers.

## Links

- Refines [Answer questions from the rules with vector search](20261007-answer-questions-from-the-rules-with-vector-search.md)
