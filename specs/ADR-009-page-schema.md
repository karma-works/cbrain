# ADR-009: Page Schema — Slug + YAML Frontmatter + Typed Links

**Status:** Decided
**Date:** 2026-05-15

## Context
cbrain's memory unit is a "page" — the same concept as gbrain's page. Every piece of knowledge written to cbrain is a page. The schema must be:
- Structured enough to support hybrid search and graph traversal
- Simple enough that skills can write valid pages without complex logic
- Compatible with gbrain's page format (so future migration to gbrain is a one-import operation)

## Decision

Every cbrain page has:

```yaml
---
slug: decisions/auth-jwt-vs-session      # required; unique identifier; path-like
title: "Chose JWT over session cookies"  # required; human-readable
type: decision | concept | person | project | meeting | note  # required
source: cbrain                           # required; project or domain scope
date: 2026-05-15                         # required; ISO date
tags: [auth, architecture, security]     # required; at least one
confidence: high | medium | low          # required; staleness signal
schema_version: 1                        # required; for migrations
links:                                   # optional; auto-populated by extraction
  - target: concepts/jwt
    type: implements
  - target: people/christian
    type: authored_by
---

Page body in markdown. Free-form prose. Entity extraction reads this.
```

**Slug format:** `<type>/<kebab-case-identifier>`. Examples:
- `decisions/auth-jwt-2026-05`
- `concepts/hybrid-search`
- `people/garry-tan`
- `projects/cbrain`
- `meetings/kickoff-2026-05-15`

**Link types (initial set):** `implements`, `references`, `authored_by`, `attended`, `part_of`, `depends_on`, `contradicts`, `supersedes`, `related_to`. Extensible — new types added via extraction prompt update.

## Rationale
- slug-as-path provides namespacing without requiring a separate `type` routing layer
- YAML frontmatter is machine-parseable and human-readable
- `confidence` field addresses Challenge 2 (stale context): `low` confidence pages surface as uncertain in queries
- `schema_version: 1` enables future migrations without reading content
- `source` field enables per-project scoping (ADR-008)
- Format is intentionally gbrain-compatible: gbrain's `put_page` accepts the same frontmatter fields, making a future migration path viable

## What This Option Does NOT Do Well
- Slug uniqueness is enforced by the database. Skills that write duplicate slugs will overwrite existing pages. This is intentional (update semantics) but can cause accidental data loss if a skill uses a non-specific slug. Mitigation: `cbrain write` warns if a slug already exists and shows the existing page's title.
- The `links` array in frontmatter is the authoritative link source for migration/export purposes. The `links` SQL table is derived from it. They must stay in sync. `cbrain maintain` checks for divergence.

## Consequences
- Every `cbrain write` call must provide at minimum: `slug`, `title`, `type`, `source`, `date`, `tags`, `confidence`.
- Skills that write pages must document which slugs they produce and at what frequency.
- The `schema_version` field must be incremented in all future spec documents when breaking schema changes are made.
- `cbrain re-embed` must re-parse frontmatter as well as re-embed content when schema_version changes.
