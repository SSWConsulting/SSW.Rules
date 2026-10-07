---
name: adr-documenter
description: Record an architectural decision for SSW.Rules as an Architecture Decision Record (ADR) in docs/adr, using the repo's Log4brains MADR template. Use when someone says "record this decision", "write an ADR", "document why we chose X", or when a conversation settles a choice between technical options worth explaining to future developers (a library, a storage or hosting choice, an integration approach, a security or cost trade-off). Not for coding conventions or style rules; those go in AGENTS.md.
---

# ADR documenter

Turns a decision into an Architecture Decision Record (ADR), so that in six months people can see why SSW.Rules works the way it does. Follows the SSW rule [Do you use Architectural Decision Records (ADRs)?](https://www.ssw.com.au/rules/architectural-decision-records).

ADRs live in `docs/adr/` and are managed with [Log4brains](https://github.com/thomvaill/log4brains). See `docs/adr/README.md` for previewing them.

## When this does not apply

- The decision is small and easy to reverse, such as renaming a variable or choosing between two equivalent helper functions. An ADR is for decisions that are costly to change, have long-term effects, or needed discussion.
- The "decision" is a convention for how code is written. Put that in `AGENTS.md` instead.

## Steps

### 1. Read the existing ADRs

List `docs/adr/` and read the ADRs that touch the same area. This tells you whether the decision is already recorded, whether it replaces an earlier one, and which ADRs to link to. Skip `README.md`, `index.md` and `template.md`; they are not decisions.

### 2. Interview the user, one question at a time

Ask only for what the conversation has not already made clear. Asking several questions at once gets partial answers.

- What problem or question the decision answers
- The options that were considered (at least two; "do nothing" counts)
- Which option was chosen, and why
- The consequences: what gets easier, what gets harder, what is still open
- Who decided. Use real people's names, not a team or a role, because a name tells a future reader who to ask
- When it was decided

Before writing, check any fact the ADR states about the codebase or infrastructure (a file path, a current behaviour, a resource that exists). An ADR is read as a record of how things were, so an unchecked claim misleads for years.

### 3. Write the ADR from the template

Copy `docs/adr/template.md` and fill it in:

- **File name:** `docs/adr/YYYYMMDD-short-title-in-kebab-case.md`, using the date the decision was made, not the day you write the file. Log4brains sorts by this date.
- **Title:** a short statement of the decision, such as "Use Azure SQL Database for vector search", not a question.
- **Status:** `proposed` until the team accepts it in the pull request; it changes to `accepted` before merge.
- **Deciders, Date and Tags:** from the interview. Reuse tags already used in other ADRs where they fit.
- **Considered Options:** describe each option neutrally, with real pros and cons. Name the chosen option once, in "Decision Outcome". An ADR that argues for its answer in every section reads as a justification written afterwards.
- **Links:** related ADRs, and the issue or PBI the decision came from.

Remove the template's `<!-- ... -->` hint comments and any optional section you have nothing for. Write in plain language that a developer new to the project can follow.

### 4. Never rewrite an old decision

An accepted ADR is a historical record. When a decision changes, write a new ADR and set the old one's status to `superseded by [new title](YYYYMMDD-new-slug.md)`. Changing the status line is the only edit allowed on an accepted ADR. Fixing a typo is fine too.

### 5. Show the draft and wait

Show the user the full ADR and wait for their approval before committing it. Then commit it on its own (or with the change it explains) and open a pull request. The pull request review is where the team accepts the decision.

## Checking the result

Run `npx log4brains adr list` from the repository root. The new ADR should appear with the right title and status. If it is missing, the file name or the title line does not match the template.
