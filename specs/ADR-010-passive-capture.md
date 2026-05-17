# ADR-010: Passive Capture — Hook-Based Session Capture + File-Event Ingestion

**Status:** Decided (promoted from post-MVP)
**Date:** 2026-05-15

## Context

The original plan deferred all passive capture to post-MVP. This is wrong. Without passive capture, cbrain's brain grows only as fast as Christian remembers to trigger skills explicitly. That failure mode is well-documented (Challenge 9): it's why gbrain uses 21 cron jobs and why every PKM system that relies on manual capture eventually becomes a ghost town.

gbrain solves passive capture with:
- Session transcript ingestion (processes full conversation transcripts)
- Cron-based enrichment pipelines
- `idea-ingest` for quick capture
- `ingest` for bulk import

cbrain's constraint is different: it runs inside Claude Code and Codex sessions. There is no persistent daemon, no cron scheduler, no stable cross-agent transcript API that cbrain should rely on.

**What cbrain does have:**
- Claude Code's `Stop` hook: a shell command that fires when Claude Code stops responding (end of turn or session end)
- Claude Code's `PostToolUse` hook: fires after specific tools run
- Codex's `SessionStart`, `PostToolUse`, and `Stop` hooks
- An LLM agent that observes the session in real-time

**The constraint that matters:** agent hooks are deterministic shell commands, but cbrain should not rely on a transcript file format as the primary memory extraction API. What it CAN do: queue a cbrain skill at session end, and that skill — running inside the agent — has access to the current conversation context.

This is the key insight: **passive capture in cbrain is not a shell script reading a log file. It is a skill that runs at session end with full access to the conversation, extracts knowledge, and writes pages.**

## Decision

Implement passive capture through two mechanisms:

### Mechanism 1: Session-End Capture (Stop Hook → `cbrain-session-capture` skill)

Configure Claude Code and Codex `Stop` hooks to queue `cbrain-session-capture` after every substantial session. The skill runs inside the agent with access to the conversation context and:

1. Scans the session for: decisions made, problems solved, concepts discussed, files written, patterns observed
2. Applies a quality filter: only captures content that passes a "would this be useful in a future cold session?" test
3. Writes structured pages to cbrain (decisions, session summary, new concepts)
4. Does NOT write noise: casual exchanges, clarifying questions, exploratory dead-ends

**Claude hook configuration** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cbrain hook session-end --agent claude"
          }
        ]
      }
    ]
  }
}
```

**Codex hook configuration** (`~/.codex/hooks.json`):
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cbrain hook session-end --agent codex",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

`cbrain hook session-end --agent <agent>` queues the capture. It does not extract memory itself — it signals the agent to run the skill.

**What the skill captures (explicit inclusion list):**
- Explicit decisions (anything phrased as a choice between alternatives)
- Architectural or design decisions
- New files or specs written during the session
- Problems that were solved (with the solution)
- People or entities mentioned in a work context
- In-progress work that should be resumed

**What the skill explicitly does NOT capture:**
- Conversational filler
- Questions the user asked and Claude answered (unless the answer was novel)
- Failed approaches (unless the failure is instructive — then capture as a `decisions/<slug>` with `confidence: low`)
- Anything already in cbrain (dedup check before write)

### Mechanism 2: File-Event Ingestion (PostToolUse Hook)

Configure Claude Code's `PostToolUse` hook and Codex's `PostToolUse` hook to auto-ingest specific file types when they are written:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "cbrain hook file-written --agent claude"
          }
        ]
      }
    ]
  }
}
```

`cbrain hook file-written <path>` checks if the written file matches an ingestion pattern:
- `specs/*.md` → ingest as a project spec page
- `specs/ADR-*.md` → ingest as a decision page
- `**/CHANGELOG.md` → ingest as a project update
- `**/CLAUDE.md` → ingest as project context
- `**/AGENTS.md` → ingest as project context

Files that don't match any pattern are ignored. This is not bulk ingestion — it is targeted capture of high-signal file types that cbrain cares about.

## Why This Beats the Alternatives

**Alternative: cron-based daemon (like gbrain)**
Would require a persistent process. Not portable, not Claude Code-native, requires daemon management. The Stop hook achieves the same session-end capture without any daemon.

**Alternative: user-triggered capture (current plan)**
Requires human discipline. Fails exactly when sessions are most productive (fast-moving sessions where you'd forget to trigger a skill). Deferred to post-MVP was wrong.

**Alternative: transcript file watch**
Claude Code and Codex may expose transcript paths, but the transcript format is not a stable cross-agent API. Processing a full transcript reliably also requires significant prompt engineering. The Stop hook + skill approach is more reliable because it runs in the session context where the model already has the conversation loaded.

## What This Does NOT Do Well

- Stop hook fires at the end of *every* turn, not just session end. If the hook runs on every stop, it will fire constantly during long multi-turn sessions. Mitigation: `cbrain hook session-end` checks a "last capture timestamp" in `~/.cbrain/capture-state.json` and skips if the last capture was < 30 minutes ago. It also checks if the conversation has >= 5 turns before capturing (short exchanges aren't worth capturing).

- Quality of captured pages depends entirely on the extraction prompt. A bad prompt produces noise. This needs a dedicated eval: after 20 auto-captured sessions, what percentage of pages are "would retrieve this in a future session" quality? Target: > 70%.

- If the agent crashes or the session is force-quit, the Stop hook may not fire. Mitigation: the `cbrain-session-load` skill on next session checks if there's an uncaptured recent session and offers to capture it.

## Consequences

- `cbrain hook session-end` and `cbrain hook file-written` are new CLI commands (added to Phase 0 Week 7).
- `cbrain-session-capture` is a new skill (added to Phase 0 Week 7, alongside `cbrain maintain` and `cbrain-decision-log`).
- Agent hook configuration is part of `cbrain init` — it modifies `~/.claude/settings.json` when present and `~/.codex/hooks.json` for Codex.
- The `cbrain-session-capture` skill must include dedup logic: before writing any page, check if a page with a similar embedding already exists (cosine similarity > 0.90). If so, update the existing page rather than creating a duplicate.
- Passive capture must be opt-out, not opt-in. `cbrain init` enables it by default. `cbrain config set capture.enabled false` disables it.
- Add to Phase 0 Week 7 (not post-MVP).
