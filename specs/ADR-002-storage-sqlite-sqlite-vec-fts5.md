# ADR-002: Storage — SQLite + sqlite-vec + FTS5

**Status:** Decided
**Date:** 2026-05-15

## Context
cbrain needs three retrieval mechanisms matching gbrain's approach:
1. **Vector search** — semantic similarity over embedded page content
2. **BM25 full-text search** — keyword/token matching
3. **Graph traversal** — typed entity link following

Alternatives considered:
- **PGLite**: Embedded Postgres via WASM. What gbrain uses. Has pgvector. But WASM runtime adds ~5MB overhead and complexity that's unnecessary for single-user use.
- **Postgres + pgvector**: Full server. Production-grade but requires a running process. Not portable.
- **Chroma / LanceDB**: Dedicated vector DBs. Good for pure vector search but add Python/Rust dependencies for what SQLite can do natively.
- **SQLite + sqlite-vec + FTS5**: SQLite ships FTS5 built-in. sqlite-vec adds vector search as a single loadable extension. One `.db` file. Zero external processes.

## Decision
Use SQLite (`bun:sqlite`) for all storage. Load `sqlite-vec` extension for vector operations. Use SQLite's built-in FTS5 module for BM25 full-text search. Model graph as a `links` table with `source_slug`, `target_slug`, `link_type` columns.

## Rationale
- Single `.db` file at `~/.cbrain/brain.db` is trivially portable.
- FTS5 BM25 is built in — no extra dependency for keyword search.
- sqlite-vec 0.1.x is production-stable, maintained by Alex Garcia, and covers cbrain's scale (personal, < 5K pages).
- Graph as SQL tables gives full JOIN semantics: "find all pages X links to via `worked_with` links" is a two-table JOIN.
- `bun:sqlite` is the fastest JS SQLite driver; loadable extensions work via `db.loadExtension()`.

## What This Option Does NOT Do Well
- sqlite-vec uses flat scan (no HNSW). At > ~5,000 pages, vector query latency will degrade from ~10ms to ~100ms+. This is acceptable for personal scale; post-MVP, add IVF index configuration.
- Cannot serve multiple concurrent processes. cbrain is single-user only at MVP.
- No built-in replication or backup. Mitigation: skills should include a `cbrain backup` command that copies the `.db` file to a user-specified location.

## Consequences
- `cbrain init` must run `CREATE VIRTUAL TABLE` for FTS5 and load sqlite-vec before first write.
- All three retrieval types (vector, BM25, graph) must be executed and ranked together in `cbrain search`.
- Schema migrations are needed before any breaking schema change — version the schema with a `schema_version` table from day one.
- The `.db` file is binary — not human-readable or diffable. The skills and page markdown source files remain the human-readable layer.
