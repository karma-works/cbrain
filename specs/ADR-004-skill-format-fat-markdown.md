# ADR-004: Skill Format — Fat Markdown Files

**Status:** Decided
**Date:** 2026-05-15

## Context
cbrain skills are cognitive operating procedures — requirements gathering, decision logging, session context loading, etc. They need to be:
- Executable by Claude Code (and future agent platforms)
- Human-readable and maintainable
- Portable — copy to a new machine and it works
- Not tied to a specific tool's API

Options:
- **Fat markdown files**: YAML frontmatter with metadata. Markdown body with instructions, contracts, phases. Same format as gbrain and gstack skills.
- **Code-based skill scripts**: Python/TypeScript files with a specific entry point. More testable, less portable across agent platforms.
- **OpenAI function / tool definitions**: JSON schema. Structured but not human-readable or maintainable.

## Decision
Use fat markdown files. Each cbrain skill lives at `~/.claude/skills/cbrain/<skill-name>/SKILL.md`. YAML frontmatter defines: `name`, `version`, `description`, `triggers`, `tools`, `mutating`. The markdown body defines the skill's contract, phases, and instructions.

## Rationale
- Same format as gbrain/gstack: patterns are established, the format is battle-tested.
- Claude Code reads markdown files natively. No compilation, no build step.
- Tool-agnostic: the same SKILL.md file works in Claude Code, Cursor, Windsurf, or any agent platform that supports markdown-based skills.
- Human-readable: a developer can read a skill and understand what it does without running it.
- The `triggers` field in frontmatter allows natural-language invocation (user types "gather requirements for this project" → agent matches the trigger and fires the skill).

## What This Option Does NOT Do Well
- Cannot be unit-tested like code. A skill can only be validated by running it end-to-end.
- No static type-checking of skill logic. Errors surface at runtime, not at authoring time.
- Mitigation: define eval criteria per skill as a section in the SKILL.md file itself. Evals run via `cbrain eval <skill-name>`.

## Consequences
- Each skill must include: YAML frontmatter, contract section, phases, memory output spec (what pages the skill writes to cbrain), and eval criteria.
- Skills must not contain hardcoded paths. All paths relative to `~/.cbrain/` or resolved via `cbrain` CLI.
- Skills must not assume which LLM model is active. Write instructions that work across Haiku, Sonnet, and Opus.
- Skill versioning: increment `version` in frontmatter on any breaking change. Old memory pages authored by prior skill versions are not automatically migrated.
