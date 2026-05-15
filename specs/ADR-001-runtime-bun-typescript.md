# ADR-001: Runtime — Bun + TypeScript

**Status:** Decided
**Date:** 2026-05-15

## Context
cbrain needs a CLI (`cbrain`) that skills invoke via Bash. The CLI must start fast — skills run inside interactive Claude Code sessions where every 200ms of latency is noticeable. It must speak to SQLite, call HTTP APIs (embeddings), and handle JSON. Three viable runtimes: Node.js, Bun, Python.

## Decision
Use Bun as the runtime with TypeScript as the language.

## Rationale
- Bun startup: ~25ms. Node: ~80-150ms. Python: ~300ms. Skills invoke the CLI repeatedly; this gap compounds.
- `bun:sqlite` is the fastest SQLite driver available in any JS/TS runtime.
- TypeScript gives a typed page schema — mistakes in frontmatter shape are caught at compile time, not at 11pm when a skill writes a malformed page.
- Same runtime as gbrain — patterns, idioms, and structure can be read across for reference without copying code.
- Single binary install: `bun link` creates a global `cbrain` command.

## What This Option Does NOT Do Well
Bun is not universally pre-installed. The install script must handle the `curl -fsSL https://bun.sh/install | bash` step. On some corporate or locked-down machines this may fail.

## Consequences
- Install script must check for and install Bun if absent.
- All cbrain source code is TypeScript.
- Dependencies must be Bun-compatible (most npm packages are, but verify before adding any).
- CI must run on Bun, not Node.
