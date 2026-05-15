# ADR-008: Memory Namespace — `~/.cbrain/`

**Status:** Decided
**Date:** 2026-05-15

## Context
Where does cbrain store its data? Options:
- **Claude Code project paths** (`~/.claude/projects/[hash]/memory/`): Already used by Claude Code's native memory system. But project-scoped — not portable across projects. The hash changes per project. The format is not a stable API.
- **Project-local** (`./.cbrain/` in the working directory): Per-project brain. Each project has isolated memory. But "Christian's brain" should be global — decisions and preferences apply across projects.
- **Global home directory** (`~/.cbrain/`): Single global brain. All cbrain sessions across all projects share the same memory. Portable: copy `~/.cbrain/` to a new machine.

## Decision
Use `~/.cbrain/` as the root for all cbrain data:
```
~/.cbrain/
  brain.db          # SQLite database (pages, links, embeddings, FTS index)
  config.json       # embedding provider, model preferences, skill config
  backups/          # cbrain backup outputs
  skills/           # symlink target for cbrain skill SKILL.md files (read by Claude Code from ~/.claude/skills/)
```

cbrain skills are installed to `~/.claude/skills/cbrain/` (where Claude Code reads them), NOT inside `~/.cbrain/`. The `~/.cbrain/` directory is data only.

## Rationale
- A personal knowledge OS should be global, not project-scoped. Decisions about authentication, working style, and domain knowledge apply everywhere Christian works.
- `~/.cbrain/` is completely independent of Claude Code internals. cbrain does not break when Claude Code changes its internal paths.
- Single file to back up, sync, or copy to a new machine: `~/.cbrain/brain.db`.
- Avoids polluting project directories with brain data that shouldn't be committed to git.

## What This Option Does NOT Do Well
- No per-project memory isolation at MVP. All projects share one brain. If cbrain accumulates contradictory context from different projects, retrieval quality suffers.
- Mitigation: use `source` field in page frontmatter (same concept as gbrain's Source axis) to namespace pages by project. `cbrain search --source myproject` scopes to that project's pages.

## Consequences
- `cbrain init` creates `~/.cbrain/` and initializes `brain.db` and `config.json`.
- All cbrain CLI commands read config from `~/.cbrain/config.json`.
- Skills must not write directly to `~/.cbrain/` — they must go through the `cbrain` CLI.
- The `source` field is required frontmatter on every page. Skills must set it. Default: inferred from the current working directory's project name.
- `cbrain backup` copies `brain.db` to `~/.cbrain/backups/brain-<timestamp>.db`. Document this clearly — losing `brain.db` means losing all memory.
