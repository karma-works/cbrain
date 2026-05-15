# Challenges

## Challenge 1: Memory Accumulation vs. Memory Noise
**Assumption:** Skills will write high-quality, signal-rich memory pages that improve future sessions.

**Most likely failure mode:** Skills write too much or write poorly structured content. After 60 days, the memory directory has 200 pages of varying quality, many redundant, some contradicting each other. Query results become noisy. The brain becomes a liability, not an asset.

**Failure consequence:** The user stops trusting memory queries. cbrain becomes another abandoned productivity system.

**Counter-evidence strength:** Strong. This is the exact failure mode of every personal knowledge management system ever built. Notion graveyards. Roam databases no one reads. The average knowledge worker has abandoned 3+ PKM tools.

**Resolution:** Enforce a memory schema from day one. Every page requires: slug, date, type, tags, confidence score. Skills must follow the schema — no freeform dumps. Build the enrichment/consolidation skill early (not post-MVP as currently planned) to handle noise before it compounds.

---

## Challenge 2: Skills Get Stale, Context Drifts
**Assumption:** cbrain skills remain accurate representations of how Christian works over time.

**Most likely failure mode:** Working style, preferences, and domain knowledge change. A skill written in May 2026 fires in November 2026 with stale assumptions. It gives confident but wrong context.

**Failure consequence:** False confidence is worse than no memory. Stale "context" misleads rather than helps.

**Counter-evidence strength:** Medium. Working style does change, but slower than technical knowledge. Preferences about communication, process, and decision-making are relatively stable over months.

**Resolution:** Every memory page needs a `last-validated` date. Skills should surface stale pages (>90 days without validation) as uncertain rather than confident. The enrichment skill should flag stale pages for review.

---

## Challenge 3: File-Based Memory Has No Retrieval Semantics
**Assumption:** File-based memory with slugs and frontmatter is sufficient for retrieval.

**Most likely failure mode:** As memory grows past ~50 pages, linear scan becomes slow and imprecise. "What did I decide about auth" requires reading every file. The agent starts missing relevant pages because grep-based matching doesn't handle semantic similarity.

**Failure consequence:** Retrieval quality degrades at scale. cbrain either stays small (low value) or grows large but becomes hard to query (low value).

**Counter-evidence strength:** Strong. This is exactly why gbrain uses vector embeddings + graph traversal. File-based retrieval doesn't scale semantically. The current plan explicitly defers vector search, which means this problem is known and accepted.

**Resolution:** Explicitly cap MVP memory at ~100 pages and build in a "this is a known limitation" escape hatch. Plan the vector/embedding upgrade path early so it doesn't require a schema rewrite later. The slug + frontmatter schema must be designed to be embedding-compatible from day one.

---

## Challenge 4: The First Skill Is Both Product and Meta-Product
**Assumption:** Building the requirements-gathering skill as the first cbrain skill is a clean way to bootstrap.

**Most likely failure mode:** The requirements-gathering skill is designed for an audience of one (Christian), in a specific cognitive style, right now. Other cbrain skills inherit its patterns. When those patterns turn out to be wrong, refactoring is expensive because memory pages written by the skill have the wrong structure.

**Failure consequence:** Early structural decisions (memory page format, link syntax, frontmatter schema) are baked in by the first skill and become expensive to change later.

**Counter-evidence strength:** Medium. This is a real risk but manageable. The fix is to treat v0.1 memory schema as explicitly provisional and plan one breaking migration before "locking" the schema.

**Resolution:** Version the memory schema explicitly from the start (schema_version: 1 in frontmatter). Write a migration script before building the third skill.

---

## Challenge 5: "Skill-First" May Be the Wrong Abstraction
**Assumption:** Encoding cognitive procedures as skills is the right way to build a personal knowledge OS.

**Most likely failure mode:** Skills are stateless execution units. They fire, produce output, and end. A brain needs persistent state, background processes, and ongoing enrichment. By being skill-first and avoiding infrastructure, cbrain may be solving a different problem than "session amnesia" — it may produce good outputs per session but not accumulate intelligently between sessions.

**Failure consequence:** cbrain becomes a collection of well-documented workflows rather than a true cognitive OS. Better than nothing, but not the compounding system described in the vision.

**Counter-evidence strength:** Medium. Depends entirely on how disciplined the skill execution is. If every skill consistently writes to memory in a structured way, and if the session-load skill consistently reads from memory, compounding can happen without infrastructure.

**Resolution:** This is the critical hypothesis. Design a specific test: after 10 cbrain skill executions, can the session-load skill reconstruct meaningful context without the user providing any input? If yes, the abstraction works. If no, gbrain-style infrastructure may be necessary.

---

## Challenge 6: Portability vs. Memory Persistence
**Assumption:** Copying `~/.claude/skills/cbrain/` + memory files is sufficient for full portability.

**Most likely failure mode:** Memory accumulates in project-specific paths (`~/.claude/projects/[project-hash]/memory/`). When moving to a new machine or new project, the memory is not automatically available. Skills that assume memory exists get confused when it doesn't.

**Failure consequence:** Portability claim is false. cbrain works well in one project on one machine, but starting a new project feels like a cold start anyway.

**Counter-evidence strength:** Medium. This depends on how Claude Code manages project-specific vs. global memory, which is an implementation detail that could be solved with a careful file layout.

**Resolution:** Define a global cbrain memory root (e.g., `~/.cbrain/memory/`) that is project-agnostic, plus per-project extensions. Skills always check global memory first. This is an ADR decision that must be made before building any skill.

---

## Challenge 7: Typed Entity Links Without an Entity Extraction Engine
**Assumption:** cbrain can use gbrain's approach to typed entity links (person → organization, decision → architecture, etc.) without gbrain's auto-extraction engine.

**Most likely failure mode:** Without auto-extraction, entity links are only created when the user or skill explicitly authors them. In practice, skills write prose and skip linking. The graph never materializes. Memory pages are isolated blobs, not a network.

**Failure consequence:** Retrieval quality stays low. The graph-based "who works at Acme" type queries that make gbrain powerful are never possible. cbrain is just a structured note-taking system.

**Counter-evidence strength:** Strong. Auto-extraction is what makes gbrain's graph valuable. Manual linking is the Achilles heel of every wiki-style knowledge system. This is a known hard problem.

**Resolution:** Accept that v1 cbrain has no graph traversal. The link schema exists in frontmatter as a forward-compatibility placeholder. Don't promise graph-based retrieval in the vision or MVP. Revisit with an LLM-based extraction pass as post-MVP.

---

## Challenge 8: The Author Is Also the System Designer
**Assumption:** Christian can objectively design a system for his own cognition.

**Most likely failure mode:** He builds a system that reflects how he *thinks* he works, not how he *actually* works. The skills encode idealized workflows. The memory schema encodes what he *wants* to remember, not what actually surfaces in his sessions.

**Failure consequence:** Mismatch between system design and actual usage. Low adoption of the system's own mechanisms. Skills get skipped. Memory pages don't get written.

**Counter-evidence strength:** Medium. This is the classic trap of personal productivity systems. The only way around it is empirical: use the system, observe friction, iterate.

**Resolution:** Build a feedback loop from day one. Every skill should include a prompt to the user: "Was this skill useful? What was missing?" Store the answers as memory pages. Treat cbrain as a living system that adapts, not a spec to be executed.

---

## Challenge 9: Skill Triggering Reliability
**Assumption:** Skills will be invoked consistently, building memory over time.

**Most likely failure mode:** Skill invocation depends on the user (or agent) remembering to trigger the skill. Requirements gathering requires `/cbrain-gather-requirements`. Decision logging requires `/cbrain-log-decision`. In practice, these get skipped in fast-moving sessions. Memory accumulation is sporadic.

**Failure consequence:** Memory grows slowly and unevenly. Sessions that skip skills contribute nothing to the brain. The compounding effect never materializes because the data is too sparse.

**Counter-evidence strength:** Strong. This is why gbrain uses cron jobs and auto-enrichment — you can't rely on humans to consistently trigger knowledge capture.

**Resolution (updated 2026-05-15 — promoted to Phase 0):** Passive capture via Claude Code hooks. Two mechanisms:
1. `Stop` hook → `cbrain-session-capture` skill fires at end of every session. Captures decisions, problems solved, new concepts automatically. No manual trigger required.
2. `PostToolUse` hook on Write/Edit → `cbrain hook file-written` auto-ingests high-signal file types (specs, ADRs, CLAUDE.md).

The new risk is capture quality, not capture frequency. See ADR-010 for the full design and quality threshold. The critical eval: > 70% of auto-captured pages are signal, not noise. If this fails, the failure mode shifts from "sparse brain" to "noisy brain" — different problem, same bad outcome.

---

## Challenge 10: Memory Schema Compatibility Across Claude Code Versions
**Assumption:** The Claude Code memory system stays stable enough that cbrain's file layout remains valid.

**Most likely failure mode:** Anthropic changes how `~/.claude/projects/` memory paths are structured, or Claude Code gains native memory features that conflict with cbrain's approach.

**Failure consequence:** cbrain's file layout breaks or becomes redundant.

**Counter-evidence strength:** Low to medium. Claude Code is in active development. The memory path conventions are not formally documented as a stable API.

**Resolution:** Isolate cbrain's memory from Claude Code's native memory system. Use a `~/.cbrain/` root that cbrain controls completely and Claude Code doesn't touch. The Claude Code auto-memory system (MEMORY.md, per-project files) is separate from cbrain's structured pages. Write skills to never depend on Claude Code internal paths.

---

## Challenge 11: The Requirements-Gathering Skill Is Heavyweight
**Assumption:** A requirements-gathering skill that takes 15+ interactive steps is the right first skill.

**Most likely failure mode:** The skill is the most complex possible starting point. It requires multi-turn interaction, writes 8+ files, and covers a broad workflow. It is a bad representation of what a typical cbrain skill looks like — most skills will be lighter, more focused, more composable.

**Failure consequence:** The skill establishes patterns (interaction style, file output structure, memory writing conventions) that are too heavyweight for simpler skills. Over-engineering the skill interface from day one.

**Counter-evidence strength:** Medium. The requirements-gathering skill has external precedent (this exact skill exists in gstack as `gather-requirements`) and is known to produce value. The risk is that it becomes the template for all skills, which would be wrong.

**Resolution:** Explicitly document that the requirements-gathering skill is an outlier in scope and complexity. Write the second skill (memory query or decision logging) as a deliberately minimal contrast. Define a "lightweight skill" pattern as part of the cbrain skill spec.

---

## Challenge 12: No Tests, No Evals, No Validation
**Assumption:** cbrain skills will work correctly without formal evaluation.

**Most likely failure mode:** Skills produce memory pages that look correct but are low quality — missing links, wrong frontmatter, inaccurate summaries. Without evals, there's no signal that quality is degrading. The brain accumulates noise with high confidence.

**Failure consequence:** Garbage in, garbage out. The system appears to work (pages get written) but doesn't actually improve session quality.

**Counter-evidence strength:** Strong. gbrain has BrainBench and LongMemEval precisely because eval-less memory systems degrade silently. This is a well-documented failure mode.

**Resolution:** Define minimum eval criteria before shipping the first skill: given a sample session, can cbrain correctly answer 3 specific questions from memory? Run this manually after every significant skill addition. Automate it post-MVP.

---

## Verbal Summary for Review

**Three biggest risks:**

1. **Memory noise accumulation** (Challenge 1): Without strong schema enforcement and early consolidation, cbrain becomes an abandoned PKM graveyard. This has happened to every personal knowledge management system ever built by smart people.

2. **No graph, no real retrieval** (Challenges 3 & 7): File-based retrieval doesn't scale semantically, and typed entity links without auto-extraction are just decoration. The retrieval story is the weakest part of this design.

3. **Passive capture quality** (Challenge 9, revised): The Stop hook solves *triggering* — the brain now captures automatically at session end. The new risk is capture *quality*: if the session-capture skill writes noise, the brain fills with low-signal pages and retrieval degrades. The failure mode shifted from "sparse brain" to "noisy brain." The 70% quality threshold eval (defined in ADR-010) must be taken seriously.

**Critical assumption that, if wrong, kills the project:**

> "Passive session capture produces signal-dense pages, not noise. The session-capture skill's quality filter correctly distinguishes decisions and knowledge worth retaining from conversational filler."

If this is wrong — if the capture prompt writes everything or writes the wrong things — the brain fills with noise faster than the maintain skill can clean it up. Validate the capture quality eval (> 70% signal) after the first 5 real sessions before trusting any session-load results.

**What to validate before writing more code:**

Run 5 real sessions with passive capture enabled. Then: (1) inspect every auto-captured page — what percentage would you actually want to retrieve in a future session? (2) Open a cold session, run session-load, verify it surfaces content from those 5 sessions accurately. Both must pass before adding more skills.
