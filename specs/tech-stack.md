# Tech Stack

## Summary

| Layer | Technology | Status | ADR |
|-------|-----------|--------|-----|
| Runtime | Bun (TypeScript) | Decided | ADR-001 |
| Storage | SQLite (bun:sqlite) | Decided | ADR-002 |
| Vector search | sqlite-vec | Decided | ADR-002 |
| Full-text / BM25 | SQLite FTS5 (built-in) | Decided | ADR-002 |
| Graph / links | SQLite tables | Decided | ADR-002 |
| Embeddings (default) | OpenAI text-embedding-3-small | Decided | ADR-003 |
| Embeddings (local) | Ollama (nomic-embed-text) | Decided | ADR-003 |
| Skill format | Fat markdown files | Decided | ADR-004 |
| CLI interface | `cbrain` command | Decided | ADR-005 |
| MCP server | Not implemented | Deferred | ADR-006 |
| Entity extraction | LLM-based at write time | Decided | ADR-007 |
| Memory namespace | `~/.cbrain/` | Decided | ADR-008 |
| Page schema | Slug + YAML frontmatter + typed links | Decided | ADR-009 |

---

## Decided Choices

### Bun + TypeScript
**Rationale:** Fast startup (< 50ms for CLI invocations, vs 200-400ms for Python), TypeScript-native, single binary install. Claude Code skills invoke the cbrain CLI on every operation — startup latency compounds. Bun also has a built-in SQLite driver (`bun:sqlite`) that is faster than `better-sqlite3`.

**Trade-off accepted:** Bun is not as universally installed as Node or Python. Mitigation: the install script checks for Bun and installs it if absent. This is a one-time friction.

**What this does NOT do well:** Bun's ecosystem is smaller than Node's. Some npm packages don't work. Mitigation: the dependencies cbrain needs (SQLite, HTTP for embeddings) are covered by Bun's standard APIs.

### SQLite + sqlite-vec + FTS5
**Rationale:** Single `.db` file. Zero-config. Truly portable (copy the file). sqlite-vec provides ANN vector search as a loadable extension. FTS5 provides BM25 full-text search as a built-in SQLite module. Together they give cbrain the same three-layer hybrid search as gbrain (vector + BM25 + graph) from a single dependency.

**Trade-off accepted:** sqlite-vec is newer than pgvector and less battle-tested. It does not support HNSW index — it uses a flat scan for small datasets and IVF for larger ones. At cbrain's personal scale (< 1,000 pages), this is acceptable. Beyond 1,000 pages, query latency will degrade.

**What this does NOT do well:** Cannot run as a network-accessible server. cbrain is single-user only. If cbrain ever needs multi-user access, this needs to change.

### OpenAI text-embedding-3-small (default) + Ollama (local fallback)
**Rationale:** text-embedding-3-small is cheap ($0.02/1M tokens), high quality, and available via a simple HTTP call. At personal scale (~10 writes/day, 1K tokens/page), monthly embedding cost is ~$0.01. Ollama + nomic-embed-text provides a zero-cost local alternative for users who prefer no API dependency.

**Trade-off accepted:** OpenAI dependency for the default path. Mitigation: config flag `CBRAIN_EMBEDDING_PROVIDER=ollama` switches to local without code changes.

**What this does NOT do well:** Local Ollama embeddings (nomic-embed-text) are lower quality than OpenAI's. Retrieval accuracy will be measurably worse on semantic queries. This is an acceptable trade-off for users who prioritize zero cost and zero external dependency.

### Fat markdown skills
**Rationale:** Same format as gbrain and gstack. Tool-agnostic. Work in Claude Code, Cursor, Windsurf, or any future platform that reads markdown. No compilation step. Human-readable. Diffable.

**Trade-off accepted:** Fat markdown skills cannot be unit-tested like code. The only way to validate a skill is to run it. Mitigation: define eval criteria per skill and run them manually at each skill version increment.

---

## What We Explicitly Chose NOT to Use

| Technology | Reason |
|-----------|--------|
| PGLite | Requires WASM runtime; adds complexity for no benefit over SQLite at personal scale |
| Postgres + pgvector | Network process required; not portable; over-engineered for single-user |
| Chroma | Python dependency; adds ecosystem friction; sqlite-vec covers the same need |
| LanceDB | Newer, less documented; sqlite-vec is simpler for structured page metadata |
| Node.js | Slower startup than Bun; no native TypeScript; `better-sqlite3` is slower than `bun:sqlite` |
| Python | Import startup latency (~300ms) is noticeable in interactive CLI contexts |
| MCP server (MVP) | Adds a persistent process; out of scope for personal portable tool at MVP |
| gbrain as dependency | Would violate the independence requirement; cbrain must install without gbrain |
| Claude Code project memory paths | Not portable across machines/projects; cbrain owns `~/.cbrain/` |

---

## Cost Profile

At typical personal use (10 skill executions/day, 1K tokens average per page write):
- Embeddings: ~$0.006/month (OpenAI text-embedding-3-small)
- LLM calls (entity extraction at write): ~$0.10/month (Haiku 4.5 at 500 tokens/call)
- Storage: < 10MB SQLite file for 1,000 pages

Total: **< $0.15/month**. Cost is not a meaningful constraint.
