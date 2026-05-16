---
name: cbrain-decision-log
version: 1.0.0
description: |
  Log a decision to cbrain. Extracts the current decision from conversation context,
  writes a structured page with rationale and linked entities, and optionally creates
  an ADR in specs/.
  Use when: a significant decision was just made in the session that should be remembered.
  "log this decision", "remember we decided", "write this to cbrain".
triggers:
  - log this decision
  - remember we decided
  - write this to cbrain
  - decision log
  - save this decision
  - record this decision
allowed-tools:
  - Bash
  - Write
  - Read
---

# cbrain-decision-log

Log a decision from the current session to the cbrain brain.

## Contract

This skill guarantees:
- Decision is written as a structured cbrain page under `decisions/<slug>`
- Slug, title, rationale, tags, and confidence are set correctly
- Optionally creates an ADR file in specs/ if the decision is architectural
- Completes in < 20 seconds

## Phase 1 — Extract Decision

From the current conversation context, identify:
- **What** was decided (the decision itself, one sentence)
- **Why** (the rationale — what alternatives were considered, why this one was chosen)
- **Confidence** — how confident is this decision? (high/medium/low)
- **Tags** — what areas does this touch? (e.g. architecture, auth, database, process)
- **Is it architectural?** — should an ADR file be created in specs/?

If the decision is not clear from context, ask the user:
"What decision should I log? Give me: the decision, why you chose it, and confidence level."

## Phase 2 — Generate Slug

Create a slug: `decisions/<date>-<kebab-case-summary>`
Example: `decisions/2026-05-15-chose-sqlite-over-pglite`

## Phase 3 — Write to cbrain

```bash
cbrain write "decisions/<slug>" \
  --title "<decision title>" \
  --type decision \
  --source "$(basename $(pwd))" \
  --tags "<tag1>,<tag2>" \
  --confidence <high|medium|low> \
  --content "<decision text + rationale>"
```

The content should follow this structure:
```
## Decision
<one sentence: what was decided>

## Rationale
<why this option over alternatives>

## Trade-offs Accepted
<what this decision gives up>

## Consequences
<what must now be true as a result>
```

## Phase 4 — Optionally Write ADR

If the decision is architectural (database, runtime, API design, auth, deployment):

Write `specs/ADR-NNN-<slug>.md` in the standard ADR format:
```markdown
# ADR-NNN: <Title>

**Status:** Decided
**Date:** YYYY-MM-DD

## Context
## Decision
## Rationale
## What This Option Does NOT Do Well
## Consequences
```

Find the next ADR number with:
```bash
ls specs/ADR-*.md 2>/dev/null | wc -l
```

## Phase 5 — Confirm

Tell the user:
- The slug that was written
- Whether an ADR was created
- `cbrain get <slug>` to verify

## Eval Criteria

- Written page has all required frontmatter fields
- Content follows the decision/rationale/tradeoffs/consequences structure
- `cbrain get <slug>` returns the page correctly
- `cbrain search <decision keyword>` returns the page in top 3
