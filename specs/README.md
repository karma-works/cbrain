# cbrain — Christian's Brain: Spec Index

Personal knowledge OS for Christian. A collection of Claude Code skills backed by a lightweight brain engine (SQLite + vector search + typed entity graph) that accumulates cognitive capital across sessions.

**The core problem it solves:** Every Claude Code session starts amnesiac. cbrain gives the agent persistent, queryable access to Christian's decisions, preferences, and domain knowledge — without re-explanation.

---

## Spec Files

| File | Description |
|------|-------------|
| [thesis.md](thesis.md) | Why cbrain needs to exist; the broken status quo and the claim |
| [vision.md](vision.md) | What it is, what it's not, primary user, success criteria |
| [product.md](product.md) | User flows, feature table, monetization (none) |
| [challenges.md](challenges.md) | 12 challenges to the design; 3 critical risks; what to validate first |
| [tech-stack.md](tech-stack.md) | Technology choices, rationale, explicit non-choices |
| [ADR-001](ADR-001-runtime-bun-typescript.md) | Runtime: Bun + TypeScript |
| [ADR-002](ADR-002-storage-sqlite-sqlite-vec-fts5.md) | Storage: SQLite + sqlite-vec + FTS5 |
| [ADR-003](ADR-003-embeddings-openai-ollama.md) | Embeddings: OpenAI default, Ollama local fallback |
| [ADR-004](ADR-004-skill-format-fat-markdown.md) | Skill format: fat markdown files |
| [ADR-005](ADR-005-cli-interface.md) | CLI: `cbrain` command with subcommands |
| [ADR-006](ADR-006-mcp-server-deferred.md) | MCP server: deferred to post-MVP |
| [ADR-007](ADR-007-entity-extraction-llm-at-write.md) | Entity extraction: LLM-based at write time (Haiku 4.5) |
| [ADR-008](ADR-008-memory-namespace.md) | Memory namespace: `~/.cbrain/` global root |
| [ADR-009](ADR-009-page-schema.md) | Page schema: slug + YAML frontmatter + typed links |
| [ADR-010](ADR-010-passive-capture.md) | Passive capture: Stop hook + PostToolUse hook + session-capture skill |
| [implementation-plan.md](implementation-plan.md) | Phase 0 (8-week detailed plan) + Phase 1–2 outlines |

---

## Key Decisions (one line each)

- **gbrain approach, independent implementation**: cbrain implements gbrain's patterns (hybrid search, typed links, auto-enrichment, health maintenance) with its own lightweight stack — no gbrain dependency.
- **SQLite over PGLite/Postgres**: Single portable `.db` file; FTS5 + sqlite-vec covers all retrieval needs at personal scale.
- **LLM extraction over code-based**: One Haiku call per page write extracts typed entity links; more flexible than regex-based extraction at the cost of ~$0.30/month.
- **`~/.cbrain/` as global namespace**: Brain is project-agnostic; source field scopes pages per project.
- **Fat markdown skills**: Same format as gbrain/gstack; portable across agent platforms.
- **CLI-first, MCP deferred**: `cbrain` CLI is the interface; MCP server is post-MVP.
- **First skill is requirements-gathering**: This spec was produced by cbrain's own first skill.
- **Passive capture in Phase 0, not post-MVP**: Claude Code's Stop hook fires `cbrain-session-capture` at session end automatically; PostToolUse hook auto-ingests written specs and ADRs. No manual trigger required for baseline memory accumulation.
- **~200-page personal scale ceiling acknowledged**: At > 200 pages, sqlite-vec flat scan degrades; plan IVF index in Phase 2.
- **gbrain-compatible page schema**: Same frontmatter format as gbrain enables `cbrain export | gbrain import` as a future migration path.

---

## Relationship to gbrain

cbrain is NOT a fork or dependency of gbrain. It is an independent implementation of gbrain's knowledge management approach on a lighter substrate (SQLite vs Postgres, LLM extraction vs code-based extraction, CLI vs MCP-first). The page schema (slug, frontmatter, typed links) is intentionally gbrain-compatible for future migration at scale.

Think of it as: gbrain taught cbrain *how* to build a brain. cbrain builds its own.

---

## What's Not Specced Yet

- Eval framework (`cbrain eval <skill>`)
- The `cbrain-architecture-review` skill
- The `cbrain-memory-enrich` skill (background consolidation)
- Multi-source routing with cross-source search
- `cbrain serve --stdio` (MCP server)
- Capture quality dashboard (`cbrain stats --capture`)
