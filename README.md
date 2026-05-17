# cbrain

Christian's Brain — a personal knowledge OS for agent coding sessions.

Every Claude Code or Codex session starts amnesiac. cbrain fixes that. It accumulates decisions, working preferences, and domain knowledge across sessions in a queryable brain, and gives agents shared skills that encode how you actually work — not just what you know.

---

## Goal

Stop re-explaining yourself. Every significant decision you make, problem you solve, or architectural choice you land on gets written to a structured brain. The next session starts informed.

The brain gets smarter over time through two mechanisms:

1. **Explicit capture** — skills like `/cbrain-gather-requirements` and `/cbrain-decision-log` write structured pages as a side effect of real work
2. **Passive capture** — a Stop hook fires at session end and queues the session for capture; a PostToolUse hook auto-ingests specs, ADRs, `CLAUDE.md`, and `AGENTS.md` files as you write them

cbrain follows [gbrain](https://github.com/garrytan/gbrain)'s knowledge management approach — structured pages, typed entity links, hybrid search — but is independent: no Postgres, no MCP server process, no 30-minute install. One `.db` file.

---

## Install

**Requirements:** [Bun](https://bun.sh) 1.0+, an `OPENAI_API_KEY` (or local Ollama for embeddings)

```bash
git clone https://github.com/karma-works/cbrain.git
cd cbrain
bun install
bun link
cbrain init
```

`cbrain init` will:
- Create `~/.cbrain/brain.db` (your brain)
- Write `~/.cbrain/config.json`
- Install shared cbrain skills for Claude Code and Codex
- Add Claude `Stop` and `PostToolUse` hooks to `~/.claude/settings.json` when that file exists
- Add Codex `SessionStart`, `PostToolUse`, and `Stop` hooks to `~/.codex/hooks.json`
- Add cbrain managed blocks to project-local `CLAUDE.md` and `AGENTS.md`

Agent targeting:

```bash
cbrain init --agent all          # default: Claude Code + Codex
cbrain init --agent claude       # Claude Code only
cbrain init --agent codex        # Codex only
cbrain init --link-skills        # symlink skills for local development
cbrain init --skip-agent-setup   # initialize only ~/.cbrain
```

Uninstall agent integration without deleting brain data:

```bash
cbrain uninstall                 # remove cbrain skills, hooks, and managed instruction blocks
cbrain uninstall --agent codex   # remove only Codex integration
```

**No `OPENAI_API_KEY`?** Use local Ollama instead:

```bash
ollama pull nomic-embed-text
cbrain init --embedding-provider ollama
```

### Install skills

`cbrain init` installs skills automatically. The target paths are:

- Claude Code: `~/.claude/skills/cbrain-*`
- Codex: `~/.codex/skills/cbrain-*`
- Shared agents path: `~/.agents/skills/cbrain-*`

The repo also includes `install.sh`, which defaults to all supported agents:

```bash
./install.sh
./install.sh --target codex --link-skills
```

---

## Usage

### CLI

```bash
# Write a page to the brain
cbrain write "decisions/2026-05-chose-bun" \
  --title "Chose Bun over Node for cbrain runtime" \
  --type decision \
  --tags "runtime,architecture" \
  --confidence high \
  --content "Bun starts in ~25ms vs Node's ~150ms. Skills invoke the CLI repeatedly."

# Search (hybrid: BM25 + vector + graph)
cbrain search "runtime decision"

# Ask a question answered from the brain
cbrain query "why did we choose Bun?"

# Read a page
cbrain get "decisions/2026-05-chose-bun" --backlinks

# Manual typed link
cbrain link "decisions/2026-05-chose-bun" depends_on "concepts/bun"

# Health check
cbrain maintain

# Backup
cbrain backup
```

### Skills

Invoke by typing the trigger phrase or skill name. Claude Code also supports slash-style invocation.

| Skill | Trigger | What it does |
|-------|---------|--------------|
| `cbrain-gather-requirements` | "spec this out" | Full requirements session → specs/ + brain pages |
| `cbrain-session-load` | "load context" | Cold-start context restore from brain |
| `cbrain-decision-log` | "log this decision" | Write a structured decision page |
| `cbrain-session-capture` | "capture this session" | Extract and store session knowledge |

Claude examples:

```text
/cbrain-session-load
/cbrain-decision-log
```

Codex examples:

```text
use cbrain-session-load
log this decision to cbrain
capture this session to cbrain
```

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun 1.x + TypeScript |
| Storage | SQLite (`bun:sqlite`) |
| Full-text search | SQLite FTS5 (BM25, built-in) |
| Vector search | In-memory cosine similarity over `FLOAT32` BLOBs |
| Graph | `links` table with typed edges |
| Embeddings | OpenAI `text-embedding-3-small` (default) or Ollama `nomic-embed-text` |
| Entity extraction | Anthropic Haiku 4.5 (one call per page write) |
| RAG query | Anthropic Haiku 4.5 (retrieval → LLM answer) |
| Skills | Shared fat markdown files (`SKILL.md`) installed for Claude Code and Codex |

### Brain file layout

```
~/.cbrain/
  brain.db          # SQLite database — pages, links, FTS5 index, embeddings
  config.json       # embedding provider, model, capture settings
  backups/          # cbrain backup outputs
  session-queue/    # pending session capture entries (from Stop hook)
  capture-state.json
```

Skills install separately to agent skill directories: `~/.claude/skills/cbrain-*/`, `~/.codex/skills/cbrain-*/`, and `~/.agents/skills/cbrain-*/`.

### Page schema

Every piece of knowledge is a **page**:

```yaml
---
slug: decisions/2026-05-chose-bun   # type/kebab-name — unique identifier
title: "Chose Bun over Node"
type: decision                       # decision | concept | person | project | meeting | note | session
source: cbrain                       # project scope
date: 2026-05-15
tags: [runtime, architecture]
confidence: high                     # high | medium | low (staleness signal)
schema_version: 1
links:
  - target: concepts/bun
    type: depends_on
---

Page body in markdown. Entity extraction reads this to auto-populate links.
```

**Slug types:** `decisions/`, `concepts/`, `people/`, `projects/`, `meetings/`, `notes/`, `sessions/`

**Link types:** `implements`, `references`, `authored_by`, `attended`, `part_of`, `depends_on`, `contradicts`, `supersedes`, `related_to`, `worked_with`, `decided_by`, `member_of`, `founded`, `invested_in`, `advises`

### Hybrid search

`cbrain search` runs three retrieval passes and merges them with [Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) (k=60):

1. **Vector** — cosine similarity between query embedding and all page embeddings (loaded into memory)
2. **BM25** — FTS5 `MATCH` query with `bm25()` ranking
3. **Graph** — 1-hop neighbors of the top vector + BM25 hits via the `links` table

At personal scale (<1,000 pages), loading all embeddings into memory for cosine similarity takes <5ms and ~4MB RAM.

### Passive capture

Hooks fire automatically in supported agents:

- **Claude Code Stop hook** → `cbrain hook session-end --agent claude`: debounced (30 min), checks turn count (≥5), writes a JSON entry to `~/.cbrain/session-queue/`.
- **Claude Code PostToolUse hook (Write/Edit)** → `cbrain hook file-written --agent claude`: checks written file paths against ingestion patterns and auto-ingests matches.
- **Codex SessionStart hook** → `cbrain hook session-start --agent codex`: injects a short reminder that cbrain memory is available.
- **Codex PostToolUse hook (Edit/Write/apply_patch)** → `cbrain hook file-written --agent codex`: extracts changed paths from hook input and auto-ingests high-signal markdown files.
- **Codex Stop hook** → `cbrain hook session-end --agent codex`: queues the session for capture and returns valid Codex hook JSON.

The next `cbrain-session-load` invocation surfaces pending entries. `cbrain-session-capture` turns useful session knowledge into durable pages.

### Source tree

```
src/
  agents/             # Claude Code + Codex integration adapters
  cli.ts              # Commander-based CLI entry point
  types.ts            # Page, Link, SearchResult types
  config.ts           # ~/.cbrain/config.json management
  db.ts               # SQLite schema, FTS5 triggers, CRUD, BM25, graph
  embed.ts            # OpenAI / Ollama embedding abstraction
  extract.ts          # LLM entity extraction (Haiku 4.5)
  search.ts           # Hybrid RRF search
  commands/
    init.ts           # cbrain init (DB + hooks)
    write.ts          # cbrain write (embed + extract + upsert)
    get.ts            # cbrain get
    search.ts         # cbrain search
    query.ts          # cbrain query (RAG)
    link.ts           # cbrain link
    maintain.ts       # cbrain maintain (stale/orphan/dead/dupe checks)
    backup.ts         # cbrain backup
    stats.ts          # cbrain stats
    hook.ts           # cbrain hook session-end / file-written
    uninstall.ts      # Remove cbrain-managed agent integration
    re-embed.ts       # cbrain re-embed

skills/              # Shared Skill SKILL.md files installed by cbrain init
  cbrain-gather-requirements/
  cbrain-session-load/
  cbrain-decision-log/
  cbrain-session-capture/
  cbrain-resolver/

specs/               # Full design docs and ADRs
```

### Known limits

- Vector search degrades past ~5,000 pages (flat-scan, no HNSW index). Post-MVP: add sqlite-vec or IVF clustering.
- Single-user only — SQLite with no concurrent access.
- Switching embedding providers requires `cbrain re-embed` to backfill all pages.

---

## Design docs

Full spec in [`specs/README.md`](specs/README.md) — thesis, vision, product doc, 12 challenges, tech stack rationale, 10 ADRs, and an 8-week implementation plan.
