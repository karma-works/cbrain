---
name: cbrain-session-capture
version: 1.0.0
description: |
  Capture knowledge from the current (or a pending) session into cbrain.
  Scans the session for decisions, problems solved, concepts discussed, files written.
  Applies a quality filter: only captures what would be useful in a future cold session.
  Triggered by Stop hook (via cbrain hook session-end) or manually.
  Use when: ending a productive session, or when /cbrain-session-load shows pending captures.
triggers:
  - session capture
  - capture this session
  - save session to brain
  - cbrain capture
  - process session
  - what did we do today
allowed-tools:
  - Bash
  - Read
  - Write
---

# cbrain-session-capture

Extract and store knowledge from the current session into cbrain.

## Contract

This skill guarantees:
- At least 1 page is written per non-trivial session (unless truly nothing worth keeping)
- Quality filter is applied: noise is NOT written (casual questions, dead-end explorations)
- Dedup check runs: existing pages are updated not duplicated
- Pending session queue entries are marked as captured
- Completes in < 60 seconds

## Quality Filter (apply before writing anything)

Ask yourself these questions for each potential page:
1. "Would I want to know this at the START of my next session on this project?"
2. "Is this a decision, a solved problem, a new concept, or a pattern I should remember?"
3. "Is this already in cbrain?" (check with `cbrain search`)

If the answer to (1) or (2) is NO, or (3) is YES — skip it.

**DO capture:**
- Explicit decisions (what was chosen and why)
- Problems solved (the solution and what caused the problem)
- New concepts or terms introduced
- Files created that represent significant work
- Architecture choices made
- Things that took time to figure out

**DO NOT capture:**
- Clarifying questions and their obvious answers
- Exploratory dead-ends (unless the dead-end itself is instructive)
- Things already in the brain at high confidence
- Conversational filler
- Tasks completed that are self-evident from the code

## Phase 1 — Scan Session

Review the current conversation context. Identify candidate knowledge units:

For each candidate, note:
- Type: decision | concept | note | person | project
- Title: one clear phrase
- Content: decision/rationale/consequences OR problem/solution OR concept explanation
- Tags: what areas
- Confidence: high (certain, verified) | medium (likely correct) | low (uncertain)

## Phase 2 — Dedup Check

For each candidate:
```bash
cbrain search "<candidate title>" --limit 3 --json 2>/dev/null
```

If a highly similar page exists (same topic, similar title), note the existing slug.
Plan to UPDATE rather than create.

## Phase 3 — Write Pages

For each page that passes the quality filter:

```bash
cbrain write "<type>/<date>-<kebab-slug>" \
  --title "<title>" \
  --type <type> \
  --source "$(basename $(pwd))" \
  --tags "<tags>" \
  --confidence <level> \
  --content "<structured content>"
```

Content structure by type:

**Decision:**
```
## Decision
<what was decided>

## Rationale
<why>

## Trade-offs
<what was given up>
```

**Problem solved:**
```
## Problem
<what was broken or unclear>

## Solution
<what fixed it>

## Root Cause
<why it happened>
```

**Concept:**
```
<Clear explanation of the concept.>
<How it relates to this project.>
<Key properties or constraints.>
```

## Phase 4 — Write Session Summary

Always write a session summary page:

```bash
cbrain write "sessions/$(date +%Y-%m-%d)-$(basename $(pwd))" \
  --title "Session: $(date +%Y-%m-%d) — $(basename $(pwd))" \
  --type session \
  --source "$(basename $(pwd))" \
  --tags "session,summary" \
  --confidence medium \
  --content "$(cat <<'EOF'
## Summary
<2-3 sentence summary of what was accomplished>

## Key Decisions
<list decisions made>

## Problems Solved
<list problems resolved>

## Next Steps
<list what remains>
EOF
)"
```

## Phase 5 — Mark Queue Entries Captured

```bash
cbrain hook list-queue
```

If there are pending entries, they are now captured. Note that the queue entries
remain as JSON files in `~/.cbrain/session-queue/` with `captured: true`.
(The `cbrain hook list-queue` command shows uncaptured ones only.)

## Phase 6 — Confirm

Tell the user:
- N pages written (list slugs)
- N pages skipped (too noisy or already existed)
- Run `/cbrain-session-load` next session to retrieve this context

## Eval Criteria

- At least 1 page written per non-trivial session (10+ turns, meaningful work done)
- 0 pages written for trivial sessions (< 5 turns, just questions)
- Session summary page is always written if any pages were written
- `cbrain search "<session topic>"` returns relevant pages after capture
- No duplicate pages created (dedup check caught matches)
- Capture completes in < 60 seconds
