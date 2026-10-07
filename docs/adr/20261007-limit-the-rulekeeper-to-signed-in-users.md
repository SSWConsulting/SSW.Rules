# Limit The Rulekeeper to signed-in users, with daily limits outside SSW

- Status: proposed
- Deciders: Anton Polkanov
- Date: 2026-10-07
- Tags: ai-chat, security, cost

## Context and Problem Statement

Every question costs money, and the Rules site is public. Without limits, anyone could run up the AI bill or use The Rulekeeper as a free general chatbot.

Sign-in on the Rules site is through Auth0 with GitHub, and is optional. The signed-in profile carries the person's GitHub username and their GitHub email, which is usually not an `@ssw.com.au` address. The site can already look up current employees in Dynamics CRM, which stores each employee's GitHub profile URL.

Who can use The Rulekeeper, and how much?

## Considered Options

1. Signed-in users only: SSW staff with a high safety cap, other signed-in users with a daily limit
2. Everyone, including people who are not signed in, with a small daily limit for anonymous use
3. SSW staff only

## Decision Outcome

Chosen option 1: "Signed-in users only", because it opens The Rulekeeper beyond SSW without the work and risk of anonymous access: no identifying visitors by cookie and IP address, no bot protection, and no public privacy notice for anonymous users.

How it works:

- **SSW staff** are signed-in users whose GitHub sign-in username exactly matches the GitHub profile CRM holds for a current employee. They get a high safety cap (for example 200 questions a day) so a leaked session or a runaway script cannot run up the bill.
- **Other signed-in users** get a daily limit (for example 20–30 questions). Anyone can create a GitHub account, so this tier is treated as close to anonymous.
- **A monthly spending cap** across everyone switches The Rulekeeper off for non-SSW users when reached.
- **Usage counts** are stored in the chat database, so limits survive restarts and are shared between server instances.
- **Conversations** are kept only in the user's browser; questions are not stored on the server.

Not decided here:

- The exact daily limits and the monthly cap.
- Anonymous access, which would be a separate decision.

## Pros and Cons of the Options

### Signed-in users only

- ✅ Every question is tied to an account, which makes limits enforceable.
- ✅ No anonymous bot traffic.
- ❌ Most of the site's visitors arrive from Google without signing in, so they will not see it.
- ❌ A GitHub account is free, so the signed-in limit is only a speed bump.

### Everyone, with a small limit for anonymous use

- ✅ Reaches the biggest audience.
- ❌ Anonymous visitors can only be identified by cookie and IP address; cookies can be cleared and offices share IPs.
- ❌ Needs bot protection (for example a CAPTCHA) and a public privacy notice.
- ❌ The largest cost exposure.

### SSW staff only

- ✅ Lowest cost and risk.
- ❌ Clients and the community, who also read the rules, cannot use it.

## Links

- Refines [Replace RulesGPT with The Rulekeeper, built into the Rules site](20261007-replace-rulesgpt-with-the-rulekeeper.md)
