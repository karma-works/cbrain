# Vision

## What It Is

cbrain is a collection of Claude Code skills that gives any agent session access to Christian's accumulated thinking — decisions made, working preferences, domain knowledge, project context — and encodes the cognitive operating procedures (requirements gathering, architecture review, decision logging, knowledge enrichment) as first-class executable skills. Memory is stored as structured markdown pages (slugs, frontmatter, typed entity links) in the project's memory directory. Skills read from and write to this memory. Over time, the agent gets smarter at Christian's specific work without Christian having to re-explain himself.

## What It Is Not

- **Not a database system.** cbrain uses the filesystem. No PGLite, no pgvector, no schema migrations, no MCP server process.
- **Not a generic RAG pipeline.** It does not index arbitrary documents for vector search. The memory it manages is structured and explicitly authored/extracted — not a document dump.
- **Not a replacement for gbrain.** gbrain is production infrastructure for large-scale knowledge (17K pages, 4K people, 700 companies). cbrain is a cognitive OS for one developer. Different scale, different deployment model, different philosophy.
- **Not a note-taking tool.** Notes are passive. cbrain skills are active — they produce structured memory as a side effect of doing real work.
- **Not a general-purpose assistant framework.** cbrain doesn't try to be a platform. It is opinionated about how Christian works and is not designed to be generalized.

## Primary User

**Christian** — a developer who uses Claude Code as a serious daily work tool. He runs multiple sessions per day across multiple projects. He has strong working preferences, an established decision-making style, and accumulated domain knowledge that he doesn't want to re-explain. He is comfortable with the Claude Code skill system and wants his skills to accumulate cognitive capital over time, not just perform isolated tasks.

## Secondary Users

None at MVP. This is explicitly a personal system. Generalization is a post-MVP concern and probably the wrong concern for a long time.

## Success Criteria

1. **Cold-start quality**: A new Claude Code session using cbrain produces responses at the quality level of a session mid-context — without the user pasting any background — for problems cbrain has seen before. Measurable: the user no longer writes "as I mentioned before" or pastes prior context.

2. **Skill coverage for core workflows**: At least 5 cognitive workflows (requirements gathering, architecture review, decision logging, memory enrichment, knowledge query) are covered by cbrain skills that produce structured memory output. Measurable: each workflow has a skill and that skill writes to the memory system.

3. **Memory structure quality**: After 30 days of use, querying "what did I decide about X" returns a specific, correct answer in under 10 seconds. Measurable: the user can answer that question faster using cbrain than by grepping their chat history.

4. **Skill portability**: All cbrain skills work on any Claude Code instance (new machine, new project) by copying `~/.claude/skills/cbrain/` and `~/.claude/projects/.../memory/`. No other setup required.

5. **Memory accumulation**: Each cbrain skill execution produces or updates at least one structured memory page. The memory directory grows with real signal, not noise. Measurable: after 30 sessions, the memory directory contains 20+ distinct pages with frontmatter and slug structure.
