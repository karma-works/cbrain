---
name: cbrain-session-load
version: 1.0.0
description: |
  Load relevant context from cbrain at the start of a session.
  Checks for pending session captures, queries for project-relevant pages,
  and presents a summary so the session starts informed.
  Use at the start of every work session. Replaces "remind me what we were doing".
triggers:
  - session load
  - load context
  - what were we working on
  - pick up where we left off
  - restore context
  - what's in my brain
  - cbrain load
allowed-tools:
  - Bash
  - Read
---

# cbrain-session-load

Load your brain context. Run this at the start of every session.

## Agent Compatibility

This is a shared cbrain skill for Claude Code and Codex. In Claude Code, it may
be invoked as `/cbrain-session-load` or by trigger phrase. In Codex, invoke it
by name or natural language, for example: "use cbrain-session-load" or
"load cbrain context".

## Contract

This skill guarantees:
- Pending session captures are surfaced (not auto-processed — that requires /cbrain-session-capture)
- Relevant pages for the current project are retrieved and summarized
- Active decisions, in-progress work, and key context are presented
- Session completes in < 30 seconds

## Phase 1 — Check Pending Captures

```bash
cbrain hook list-queue 2>/dev/null
```

If there are uncaptured sessions, note them. Say:
"There are N uncaptured sessions. Run cbrain-session-capture to process them."

## Phase 2 — Identify Current Project

```bash
pwd
ls -la | head -20
git remote -v 2>/dev/null | head -3 || echo "no git"
```

Infer the project name from the current directory or git remote.

## Phase 3 — Query Brain

```bash
# Search for project-relevant pages
cbrain search "$(basename $(pwd)) recent work decisions" --limit 8 --json 2>/dev/null

# Search for recent session summaries
cbrain search "session summary recent" --type session --limit 3 --json 2>/dev/null

# Search for active decisions
cbrain search "decision architecture" --type decision --limit 5 --json 2>/dev/null
```

## Phase 4 — Present Context

Format a concise context block:

```
## Brain Context: <project> — <date>

### Active Decisions
<list top decision pages with title + date>

### Recent Sessions
<list recent session summaries if any>

### Relevant Knowledge
<list other relevant pages>

### Pending Captures
<list if any>
```

Keep it short. Do NOT dump full page content — just titles, slugs, dates, and one-line summaries.
The user can run `cbrain get <slug>` to read any page in full.

## Phase 5 — Offer Actions

Offer:
1. "Run cbrain-session-capture to process pending sessions"
2. "Run `cbrain get <slug>` to read any page in full"
3. "Run `cbrain query '<question>'` to ask a specific question"

## Eval Criteria

- Completes in < 30 seconds
- Returns at least 1 relevant page for any project that has cbrain pages
- Correctly identifies and lists pending session captures
- Does NOT dump full page content (respects brevity)
