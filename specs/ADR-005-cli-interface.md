# ADR-005: CLI Interface — `cbrain` Command

**Status:** Decided
**Date:** 2026-05-15

## Context
Skills invoke cbrain's storage, search, and enrichment capabilities via Bash. The interface must be scriptable from markdown skill instructions and stable enough that skills don't break when cbrain is updated.

## Decision
Expose all cbrain operations through a single `cbrain` CLI command. Mirror gbrain's operation naming where it adds clarity. Core commands:

```
cbrain init                              # initialize brain, configure embedding provider
cbrain write <slug> [options]            # write page, auto-extract links, embed
cbrain get <slug>                        # retrieve page by slug
cbrain search <query>                    # hybrid search (vector + BM25 + graph)
cbrain query <question>                  # LLM-assisted structured query
cbrain link <from-slug> <type> <to-slug> # add typed link manually
cbrain maintain                          # health check, stale detection, orphan cleanup
cbrain backup [path]                     # copy brain.db to specified path
cbrain re-embed                          # re-embed all pages (use after provider switch)
cbrain stats                             # page count, link count, embedding coverage
cbrain eval <skill-name>                 # run skill evals
```

All commands output JSON to stdout when `--json` flag is set. Default output is human-readable.

## Rationale
- Single command with subcommands is simpler to install (one symlink) and simpler to use from skill instructions.
- JSON output enables skills to parse results programmatically.
- Mirrors gbrain's naming (`search`, `query`, `maintain`) so cbrain documentation and gbrain documentation are mutually intelligible.

## What This Option Does NOT Do Well
- No streaming output. Long-running `cbrain maintain` runs block until completion. Post-MVP: add `--stream` flag with SSE output.
- CLI-only: no programmatic TypeScript API exposed at MVP. Post-MVP: expose `cbrain/src/operations.ts` as a library for advanced use.

## Consequences
- All skills invoke cbrain via `cbrain <command>` in Bash tool calls. Never via direct file manipulation.
- The CLI contract (command names, flag names, JSON output schema) is the public API. Breaking changes require a major version bump and a migration guide.
- `cbrain init` must be idempotent — running it twice does not corrupt the brain.
