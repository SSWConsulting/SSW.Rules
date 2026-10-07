<!-- This file is the homepage of the Log4brains knowledge base. -->

# Architecture knowledge base

Welcome 👋 to the architecture knowledge base of SSW.Rules.
You will find here all the Architecture Decision Records (ADRs) of the project.

## Definition and purpose

> An Architectural Decision (AD) is a software design choice that addresses a functional or non-functional requirement that is architecturally significant.
> An Architectural Decision Record (ADR) captures a single AD, such as often done when writing personal notes or meeting minutes; the collection of ADRs created and maintained in a project constitutes its decision log.

An ADR is immutable: only its status can change (i.e., become deprecated or superseded). That way, you can become familiar with the whole project history just by reading its decision log in chronological order.
Maintaining this documentation aims at:

- 🚀 Improving and speeding up the onboarding of a new team member
- 🔭 Avoiding blind acceptance/reversal of a past decision (cf [Michael Nygard's famous article on ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html))
- 🤝 Formalizing the decision process of the team

## Usage

The ADRs are markdown files in `docs/adr`, next to the code, and are changed through pull requests like any other file.
Browse them with the left menu or the search bar.

The typical workflow of an ADR is the following:

![ADR workflow](/l4b-static/adr-workflow.png)

## More information

- [Do you use Architectural Decision Records (ADRs)?](https://www.ssw.com.au/rules/architectural-decision-records)
- [Log4brains documentation](https://github.com/thomvaill/log4brains/tree/master#readme)
- [ADR GitHub organization](https://adr.github.io/)
