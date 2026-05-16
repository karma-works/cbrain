---
name: cbrain-resolver
version: 1.0.0
description: cbrain skill dispatcher — maps trigger phrases to cbrain skills
---

# cbrain Skill Resolver

## Skill Dispatch Table

| Trigger phrase | Skill |
|---------------|-------|
| "gather requirements", "spec this out", "let's plan", "write requirements" | /cbrain-gather-requirements |
| "session load", "load context", "pick up where", "what were we working on" | /cbrain-session-load |
| "log this decision", "remember we decided", "save decision", "decision log" | /cbrain-decision-log |
| "session capture", "capture this session", "save to brain", "what did we do" | /cbrain-session-capture |

## cbrain CLI Quick Reference

```bash
cbrain init                          # Initialize brain
cbrain write <slug> [options]        # Write a page
cbrain get <slug>                    # Read a page
cbrain search "<query>"              # Hybrid search
cbrain query "<question>"            # RAG query (LLM-answered)
cbrain link <from> <type> <to>       # Add typed link
cbrain maintain                      # Health check
cbrain stats                         # Brain statistics
cbrain backup                        # Backup brain.db
cbrain re-embed                      # Re-embed all pages
cbrain hook list-queue               # Show pending captures
cbrain config get                    # Show config
cbrain config set <key> <value>      # Set config
```

## Page Schema Quick Reference

```yaml
---
slug: <type>/<kebab-name>      # e.g. decisions/chose-sqlite
title: "Human readable title"
type: decision|concept|person|project|meeting|note|session
source: <project-name>
date: YYYY-MM-DD
tags: [tag1, tag2]
confidence: high|medium|low
schema_version: 1
links:
  - target: concepts/sqlite
    type: depends_on
---
Content in markdown.
```

## Link Types

implements, references, authored_by, attended, part_of, depends_on, contradicts, supersedes, related_to, worked_with, decided_by, member_of, founded, invested_in, advises
