# ADR-003: Embeddings — OpenAI Default, Ollama Local Fallback

**Status:** Decided
**Date:** 2026-05-15

## Context
Vector search requires embeddings. cbrain needs an embedding provider that:
- Works on the first install without complex setup
- Has acceptable quality for semantic retrieval over personal knowledge pages (mix of technical notes, decisions, meeting summaries, project specs)
- Has a local/offline alternative for users who prefer no external API dependency

Options:
- **OpenAI text-embedding-3-small**: $0.02/1M tokens. 1536 dimensions. High quality. Requires `OPENAI_API_KEY`.
- **OpenAI text-embedding-3-large**: 3072 dimensions, higher quality, 5x the cost. Overkill at personal scale.
- **Ollama + nomic-embed-text**: Local, zero API cost. 768 dimensions. Measurably lower retrieval quality than OpenAI but entirely offline.
- **Anthropic / Voyage**: Voyage AI embeddings are high quality but add another API key dependency.
- **sentence-transformers**: Python dependency. Out because cbrain is Bun/TypeScript.

## Decision
Default to OpenAI `text-embedding-3-small`. Support `CBRAIN_EMBEDDING_PROVIDER=ollama` (with `CBRAIN_OLLAMA_URL` defaulting to `http://localhost:11434`) as a local alternative. Both providers implement the same internal `embed(text: string): Promise<number[]>` interface so they are drop-in swappable.

## Rationale
- text-embedding-3-small costs < $0.01/month at personal scale. Cost is not a constraint.
- Quality matters: better embeddings mean better semantic retrieval. The personal knowledge use case (heterogeneous content types, domain-specific terminology) benefits from a strong general-purpose model.
- Ollama support ensures cbrain is usable offline or in environments where OpenAI keys are not available. nomic-embed-text is the best Ollama embedding model currently (May 2026).
- The provider abstraction is trivial to implement and keeps future providers (Voyage, Gemini, Azure) easy to add.

## What This Option Does NOT Do Well
- Default path requires `OPENAI_API_KEY`. New installs with no API key will fail on first `cbrain write`. Mitigation: `cbrain init` detects missing key, prompts to configure Ollama as fallback, and documents the setup.
- Ollama embeddings are lower quality — users who switch to save cost will see degraded semantic retrieval. Warn them explicitly.
- Embedding dimensions differ between providers (1536 vs 768). The sqlite-vec schema must be provider-specific. Switching providers requires re-embedding all pages. `cbrain re-embed` command must exist before any provider switch.

## Consequences
- `cbrain init` must ask which provider to use and set `~/.cbrain/config.json` accordingly.
- Schema stores `embedding_provider` and `embedding_model` per page so re-embedding can be targeted.
- `cbrain re-embed` command must exist before post-MVP provider switching is supported.
- Never mix embedding providers in the same brain without re-embedding everything first.
