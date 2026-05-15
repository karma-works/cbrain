# Product Specification

## User Types

| User | Goal | Trust Level |
|------|-------|-------------|
| Christian (primary) | Accumulate and retrieve cognitive capital across sessions | Full — this is a personal system |
| Future Christian (next session) | Pick up where last session left off, without re-explaining | Full — same person, different context window |

## Core Flows

### Flow 1: Requirements Gathering (first skill)

A skill that, when invoked, runs a structured requirements-gathering session and deposits the output into both `specs/` (human-readable documents) and the cbrain memory system (structured pages with frontmatter + typed links).

1. Read current working directory and any existing specs
2. Ask the user a targeted intake question
3. Iteratively challenge assumptions and extract signal
4. Write `specs/thesis.md`, `specs/vision.md`, `specs/product.md`, `specs/challenges.md`, `specs/tech-stack.md`, ADRs, `specs/implementation-plan.md`, `specs/README.md`
5. Write memory pages: one per major decision, entity, or concept that cbrain should recall later
6. Output a debrief with honest assessment of risks

This skill IS currently being executed. It is itself the first artifact of cbrain.

### Flow 2: Memory Query

Given a question ("what did I decide about auth last month?"), retrieve structured pages from the memory system and return a coherent answer.

1. Parse the question for entity references and topic keywords
2. Scan memory pages by slug and frontmatter tags
3. Follow typed entity links to related pages
4. Return relevant pages with provenance (when written, which skill produced it)

### Flow 3: Session Context Load

At the start of a new Claude Code session, surface relevant prior context without the user asking.

1. Read memory pages tagged with the current project or recent work
2. Summarize active decisions, preferences, and in-progress work
3. Offer to restore full context or proceed with summary

### Flow 4: Decision Logging

When a significant decision is made mid-session, write it to memory in structured form.

1. User or agent identifies a decision worth persisting
2. Skill writes a memory page: slug, date, decision, rationale, linked entities, confidence
3. Optionally adds an ADR to `specs/` if the decision is architectural

### Flow 5: Memory Enrichment (post-MVP)

Background consolidation: merge duplicate pages, extract entity links from prose pages, flag contradictions.

## Feature Table

| Feature | User | MVP | Post-MVP | Notes |
|---------|------|-----|----------|-------|
| Requirements gathering skill | Christian | Yes | — | First skill; produces specs/ + memory pages |
| Memory page schema (slug, frontmatter, typed links) | Christian | Yes | — | Foundation; everything else depends on this |
| Memory query skill | Christian | Yes | — | Without retrieval, memory accumulation is useless |
| Session context load skill | Christian | Yes | — | Core session reset problem |
| Decision logging skill | Christian | Yes | — | Closes the "why did I decide X" gap |
| Memory enrichment / consolidation | Christian | No | Yes | Nice to have; complex to get right |
| Entity extraction from prose | Christian | No | Yes | gbrain does this well; cbrain defers it |
| Cron-based background jobs | Christian | No | Yes | Over-engineering for MVP |
| Multi-project memory routing | Christian | No | Yes | One brain, one source for MVP |
| Team / shared brains | Other users | No | Future | Explicitly out of scope |

## Monetization Hypothesis

None. This is a personal tool. The "cost" is Christian's time building it. The "return" is compounding cognitive capital — sessions that start smarter, work that takes less re-explanation time. Not a product business.
