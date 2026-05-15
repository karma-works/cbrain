# ADR-006: MCP Server — Deferred to Post-MVP

**Status:** Decided (deferred)
**Date:** 2026-05-15

## Context
gbrain exposes 30+ MCP tools via stdio, enabling any MCP-compatible client (Claude Code, Cursor, Windsurf, Claude Desktop) to call brain operations as tools rather than CLI commands. Should cbrain do the same at MVP?

## Decision
Do not implement an MCP server at MVP. Skills invoke cbrain via CLI (`cbrain search`, `cbrain write`, etc.) through Bash tool calls.

## Rationale
- MCP adds a persistent server process that must be configured in each client's settings. For a personal tool, this is friction.
- Skills using Bash + CLI are sufficient for MVP use cases and simpler to debug.
- The CLI interface (ADR-005) provides the same operations as MCP tools would. MCP is an alternative transport, not additional capability.
- Building MCP properly (with correct `inputSchema`, error codes, streaming) takes ~1 week of work that delays the first skill going live.

## What This Option Does NOT Do Well
- Without MCP, cbrain operations cannot be invoked as native tools in the agent's tool loop. They require a Bash tool call, which is slightly less ergonomic and adds one indirection.
- Some agent platforms (non-Claude Code) may not support Bash tool use, making cbrain skills non-portable to those platforms.

## Consequences
- Post-MVP: implement `cbrain serve` (stdio MCP server) as a drop-in addition. The CLI operations defined in ADR-005 map 1:1 to MCP tool definitions. No CLI refactoring required.
- Track as post-MVP: `cbrain serve --stdio` exposing all CLI commands as MCP tools.
