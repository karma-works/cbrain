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

cbrain's constraint is different: it runs inside Claude Code sessions. There is no persistent daemon, no cron scheduler, no access to session transcripts from outside.

**What cbrain does have:**
- Claude Code's `Stop` hook: a shell command that fires when Claude Code stops responding (end of turn or session end)
- Claude Code's `PostToolUse` hook: fires after specific tools run
- Claude Code's `Notification` hook: fires on agent notifications
- An LLM (Claude itself) that observes the session in real-time

**The constraint that matters:** Claude Code's Stop hook fires a shell command but does not pass the session transcript to that command. cbrain cannot post-process the transcript the way gbrain does. What it CAN do: invoke a cbrain skill at session end, and that skill — running inside Claude Code — has access to the current conversation context.

This is the key insight: **passive capture in cbrain is not a shell script reading a log file. It is a skill that runs at session end with full access to the conversation, extracts knowledge, and writes pages.**

## Decision

Implement passive capture through two mechanisms:

### Mechanism 1: Session-End Capture (Stop Hook → `cbrain-session-capture` skill)

Configure Claude Code's `Stop` hook to trigger the `cbrain-session-capture` skill after every session. The skill runs inside Claude Code with access to the conversation context and:

1. Scans the session for: decisions made, problems solved, concepts discussed, files written, patterns observed
2. Applies a quality filter: only captures content that passes a "would this be useful in a future cold session?" test
3. Writes structured pages to cbrain (decisions, session summary, new concepts)
4. Does NOT write noise: casual exchanges, clarifying questions, exploratory dead-ends

**Hook configuration** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cbrain hook session-end"
          }
        ]
      }
    ]
  }
}
```

`cbrain hook session-end` is a CLI command that triggers the `cbrain-session-capture` skill invocation. It does not process the transcript itself — it signals Claude Code to run the skill.

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

Configure Claude Code's `PostToolUse` hook to auto-ingest specific file types when they are written:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "cbrain hook file-written \"$CBRAIN_TOOL_INPUT_FILE_PATH\""
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

Files that don't match any pattern are ignored. This is not bulk ingestion — it is targeted capture of high-signal file types that cbrain cares about.

## Why This Beats the Alternatives

**Alternative: cron-based daemon (like gbrain)**
Would require a persistent process. Not portable, not Claude Code-native, requires daemon management. The Stop hook achieves the same session-end capture without any daemon.

**Alternative: user-triggered capture (current plan)**
Requires human discipline. Fails exactly when sessions are most productive (fast-moving sessions where you'd forget to trigger a skill). Deferred to post-MVP was wrong.

**Alternative: transcript file watch**
Claude Code writes session transcripts to disk (in `~/.claude/projects/[hash]/conversations/`). A file watcher could process these. But: the format is not a stable API, the files are project-scoped, and processing a full transcript reliably requires significant prompt engineering. The Stop hook + skill approach is more reliable because it runs in the session context where the model already has the conversation loaded.

## What This Does NOT Do Well

- Stop hook fires at the end of *every* turn, not just session end. If the hook runs on every stop, it will fire constantly during long multi-turn sessions. Mitigation: `cbrain hook session-end` checks a "last capture timestamp" in `~/.cbrain/capture-state.json` and skips if the last capture was < 30 minutes ago. It also checks if the conversation has >= 5 turns before capturing (short exchanges aren't worth capturing).

- Quality of captured pages depends entirely on the extraction prompt. A bad prompt produces noise. This needs a dedicated eval: after 20 auto-captured sessions, what percentage of pages are "would retrieve this in a future session" quality? Target: > 70%.

- If Claude Code crashes or the session is force-quit, the Stop hook may not fire. Mitigation: the `cbrain-session-load` skill on next session checks if there's an uncaptured recent session and offers to capture it.

## Consequences

- `cbrain hook session-end` and `cbrain hook file-written` are new CLI commands (added to Phase 0 Week 7).
- `cbrain-session-capture` is a new skill (added to Phase 0 Week 7, alongside `cbrain maintain` and `cbrain-decision-log`).
- Claude Code hook configuration is part of `cbrain init` — it modifies `~/.claude/settings.json` with the user's consent.
- The `cbrain-session-capture` skill must include dedup logic: before writing any page, check if a page with a similar embedding already exists (cosine similarity > 0.90). If so, update the existing page rather than creating a duplicate.
- Passive capture must be opt-out, not opt-in. `cbrain init` enables it by default. `cbrain config set capture.enabled false` disables it.
- Add to Phase 0 Week 7 (not post-MVP).
