# Implementation Plan

## Phase 0: Core Infrastructure + First Two Skills (6–8 weeks, solo)

This is the only phase with week-level detail. Everything else is a theme.

---

### Week 1–2: `cbrain` CLI Foundation

- [ ] Initialize repo: `git init`, `bun init`, `tsconfig.json`, `.gitignore`
- [ ] Create `~/.cbrain/` directory structure on `cbrain init`
- [ ] Write SQLite schema (v1):
  - `pages` table: `slug TEXT PRIMARY KEY, title TEXT, type TEXT, source TEXT, date TEXT, tags TEXT (JSON), confidence TEXT, schema_version INT, content TEXT, embedding BLOB, embedding_provider TEXT, embedding_model TEXT, created_at INT, updated_at INT`
  - `links` table: `id INTEGER PRIMARY KEY, source_slug TEXT, target_slug TEXT, link_type TEXT, created_at INT`
  - `schema_version` table: single row tracking current version
  - FTS5 virtual table: `pages_fts` over `title + content`
  - sqlite-vec: load extension, create `vec_pages` virtual table for `embedding` column
- [ ] Implement `cbrain init`: create `~/.cbrain/`, run migrations, write default `config.json`
- [ ] Implement `cbrain write <slug>` with options: `--title`, `--type`, `--source`, `--tags`, `--confidence`, `--content <file>`, `--stdin`
  - Parse frontmatter if content is a markdown file
  - Generate embedding via configured provider
  - Insert into FTS5 index
  - Queue link extraction (async, non-blocking on write)
- [ ] Implement `cbrain get <slug>`: return page as markdown with frontmatter
- [ ] Implement `cbrain stats`: page count, link count, embedding coverage %, FTS row count
- [ ] Basic test: write a page, get it back, verify embedding stored

---

### Week 3: Hybrid Search

- [ ] Implement vector search: `cbrain search <query>` with embedding + cosine similarity via sqlite-vec
- [ ] Implement BM25 search: FTS5 `MATCH` query with `bm25()` ranking
- [ ] Implement graph traversal: given a page, follow typed links 1–2 hops
- [ ] Implement hybrid ranking: RRF (Reciprocal Rank Fusion) to merge vector, BM25, and graph results — same approach as gbrain
- [ ] Implement `--source <slug>` filter on search
- [ ] Implement `--type <type>` filter on search
- [ ] Implement `--json` output flag on all commands
- [ ] Manual eval: write 20 test pages, run 10 queries, check top-3 results by hand. Target: 8/10 relevant. Fix ranking until target is met.

---

### Week 4: Entity Extraction + Link Management

- [ ] Implement LLM extraction at write time (Haiku 4.5)
  - Extraction prompt: extract entities (people, concepts, projects, decisions) and typed relationships from page content
  - Parse extraction output as structured JSON
  - Normalize entity names (lowercase, canonical form)
  - Write extracted links to `links` table
- [ ] Implement `cbrain link <from> <type> <to>`: manual link creation
- [ ] Implement backlink queries: `cbrain get <slug> --backlinks` shows all pages linking to this slug
- [ ] Update hybrid search to boost pages with high backlink count (backlink-boosted ranking)
- [ ] Test: write 5 pages with entity mentions. Verify extracted links are correct.

---

### Week 5: `cbrain-gather-requirements` Skill (First Skill)

- [ ] Write `~/.claude/skills/cbrain/gather-requirements/SKILL.md`
  - YAML frontmatter with name, version, triggers, tools
  - Contract: what this skill guarantees
  - Phase structure: orient → intake → thesis → vision → product → challenges → tech stack → ADRs → implementation plan → debrief
  - Memory output spec: list of pages the skill writes to cbrain on completion
  - Eval criteria: given a sample project description, skill produces 8+ spec files and 5+ cbrain pages within one session
- [ ] Define the memory pages this skill writes to cbrain:
  - `projects/<name>` — project overview
  - `decisions/<adr-slug>` — one page per ADR
  - `concepts/<key-concept>` — key concepts from the spec session
- [ ] Run the skill on a test project. Verify cbrain pages are written correctly.
- [ ] Manually run eval criteria. Fix skill until all criteria pass.

---

### Week 6: `cbrain-session-load` Skill (Second Skill)

- [ ] Write `~/.claude/skills/cbrain/session-load/SKILL.md`
  - On invocation: query cbrain for pages relevant to current working directory / project
  - Surface: recent decisions, active projects, in-progress work, relevant preferences
  - Present summary to user, offer full context or summary mode
  - Write a `sessions/<date>` page to cbrain logging that this session happened
- [ ] Implement `cbrain query <question>`: LLM-assisted structured query
  - Fetch top-10 hybrid search results
  - Pass to LLM with structured prompt: "given these pages, answer this question"
  - Return answer with provenance (which pages were used)
- [ ] Test cold-start: fresh session, no user input, session-load surfaces relevant context from prior skill executions
- [ ] Eval: after 10 prior cbrain skill executions (gather-requirements on 2 projects + some manual writes), does session-load surface the right context for each project? Target: 3/3 relevant for the current project.

---

### Week 7: `cbrain maintain` + `cbrain-decision-log` Skill + Passive Capture (ADR-010)

- [ ] Implement `cbrain maintain`:
  - Stale page detection: pages with `confidence: high` older than 90 days flagged as potentially stale
  - Orphan detection: pages with no backlinks and no outbound links
  - Dead link detection: links where target slug doesn't exist
  - Duplicate detection: pages with similar embeddings (cosine similarity > 0.95)
  - Output: structured report with counts and specific slugs for each issue category
- [ ] Write `~/.claude/skills/cbrain/decision-log/SKILL.md`
  - On invocation: extract current decision from conversation context
  - Write a `decisions/<slug>` page with slug, title, decision text, rationale, linked entities, confidence
  - Optionally write an ADR to `specs/` if the decision is architectural
- [ ] Run `cbrain maintain` on the test brain. Verify it finds real issues.
- [ ] Implement passive capture hooks (ADR-010):
  - `cbrain hook session-end`: checks last-capture timestamp in `~/.cbrain/capture-state.json`, skips if < 30 min ago or < 5 turns, otherwise triggers `cbrain-session-capture` skill
  - `cbrain hook file-written <path>`: checks file against ingestion patterns (`specs/*.md`, `specs/ADR-*.md`, `CHANGELOG.md`, `CLAUDE.md`), auto-ingests matching files
  - `cbrain init` adds Stop + PostToolUse hook entries to `~/.claude/settings.json` (with user consent prompt)
- [ ] Write `~/.claude/skills/cbrain/session-capture/SKILL.md`:
  - Scans current session for: decisions, problems solved, new concepts, files written, entities mentioned
  - Quality filter: "would this be useful in a future cold session?" — discard noise, casual exchanges, dead-end explorations
  - Dedup check: cosine similarity > 0.90 against existing pages → update rather than create
  - Writes: `sessions/<date>-summary`, plus individual `decisions/`, `concepts/` pages as warranted
  - Eval criteria: after 20 auto-captured sessions, > 70% of pages pass "would retrieve this in future session" quality check
- [ ] Test passive capture: run a real session, verify Stop hook fires, verify pages written are signal not noise

---

### Week 8: Hardening + Launch Criteria

- [ ] `cbrain backup`: copy `brain.db` to `~/.cbrain/backups/brain-<timestamp>.db`
- [ ] `cbrain re-embed`: re-embed all pages (for provider switching)
- [ ] Install script: `install.sh` that checks for Bun, clones repo, runs `bun install && bun link`, creates `~/.cbrain/`
- [ ] Error handling: all CLI commands return non-zero exit code with JSON error on failure
- [ ] `cbrain init` is idempotent: safe to run twice
- [ ] `cbrain init` configures Stop + PostToolUse hooks in `~/.claude/settings.json` (passive capture enabled by default)
- [ ] Write `~/.claude/skills/cbrain/RESOLVER.md`: dispatch table for all cbrain skills (which trigger phrases invoke which skill)
- [ ] Final eval pass: 4 skills × eval criteria from their SKILL.md files. All must pass.
- [ ] Passive capture quality eval: run 5 real sessions, verify > 70% of auto-captured pages are signal not noise

**Launch criteria (what must be true before using cbrain in real work):**
- [ ] `cbrain init` completes without errors on a fresh machine, including hook configuration
- [ ] `cbrain-gather-requirements` produces 8+ spec files and 5+ cbrain pages on a real project
- [ ] `cbrain-session-load` surfaces relevant context from a cold session with no user input
- [ ] `cbrain-decision-log` writes a correctly-structured decision page
- [ ] `cbrain-session-capture` fires automatically at session end and writes at least one signal page per non-trivial session
- [ ] `cbrain maintain` runs without crashing and finds at least one real issue in a 20+ page brain
- [ ] `cbrain search "what did I decide about auth"` returns the correct decision page in top-3 results
- [ ] After 3 real sessions with passive capture enabled, cold-start session-load surfaces content from those sessions without user input
- [ ] Total install time on a fresh machine: < 5 minutes

---

## Phase 1: Depth (Weeks 9–16)

- More skills: `cbrain-architecture-review`, `cbrain-memory-enrich`, `cbrain-daily-brief`
- `cbrain serve --stdio`: MCP server exposing all CLI operations as tools
- Per-project source routing: `cbrain search --source <project>` with auto-detection from `cwd`
- Eval framework: `cbrain eval <skill>` runs structured evals defined in SKILL.md
- Richer passive capture: `cbrain hook file-written` expands to watch more file patterns (test files, config changes)
- Passive capture quality dashboard: `cbrain stats --capture` shows auto-vs-manual page ratio, quality score trend

## Phase 2: Scale + Portability (Weeks 17+)

- IVF index for sqlite-vec (when pages > 1,000)
- `cbrain export`: dump all pages as markdown files for gbrain-compatible import
- `cbrain import <path>`: ingest markdown files (meeting notes, prior specs, etc.)
- `cbrain re-embed`: provider migration path (OpenAI → Ollama or vice versa)
- Background enrichment daemon (optional): `cbrain daemon` for cron-style maintenance
- Multi-source: explicit source namespacing with cross-source search
