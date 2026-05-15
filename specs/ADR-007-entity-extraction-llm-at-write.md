# ADR-007: Entity Extraction — LLM-Based at Write Time

**Status:** Decided
**Date:** 2026-05-15

## Context
gbrain extracts typed entity links (`attended`, `works_at`, `invested_in`, `founded`, `advises`) on every page write with zero LLM calls — it uses a code-based graph pattern (regex + known entity types). This powers its graph traversal and backlink-boosted ranking.

cbrain needs the same capability, but has different constraints:
- Personal scale (< 1,000 pages) makes zero-LLM extraction less critical for performance
- cbrain runs in Claude Code context where an LLM is always available
- Code-based extraction (like gbrain's) requires maintaining a list of entity types, relationship patterns, and name normalization logic — weeks of engineering

Options:
- **Code-based extraction (gbrain approach)**: Fast, zero API cost per write, deterministic. But requires significant engineering to implement and maintain extraction rules.
- **LLM extraction at write time**: One LLM call per page write. Costs ~$0.001/page at Haiku 4.5 rates. Flexible, handles any entity type, no maintenance. But adds latency (~1-2s) and API cost per write.
- **Deferred extraction (background)**: Write page without links, run extraction as a batch. Reduces write latency but means graph is always stale.

## Decision
Use LLM-based extraction at write time via Haiku 4.5. On every `cbrain write`, extract entity mentions and typed relationships from the page content with a structured extraction prompt. Write the extracted links to the `links` table immediately.

## Rationale
- At personal scale, one Haiku call per write costs < $0.001. Monthly cost at 10 writes/day: ~$0.30.
- LLM extraction is more accurate and flexible than code-based extraction for heterogeneous personal knowledge content (meeting notes, technical decisions, project specs).
- cbrain is always running in a context where an LLM call is cheap. This is a different constraint than gbrain, which needed zero-LLM extraction because it runs in production pipelines with thousands of page writes.
- No extraction rule maintenance. The LLM handles new entity types, different content formats, and edge cases without code changes.

## What This Option Does NOT Do Well
- Each write adds ~1-2 seconds of latency for the extraction call.
- LLM extraction is non-deterministic. The same page written twice may produce slightly different links. Mitigation: normalize extracted entities before writing (lowercase, trim, canonical form).
- If cbrain is used offline (no API access), writes fail to extract links. Mitigation: make extraction optional (`--no-extract` flag) so writes still work offline; extraction can be run later via `cbrain maintain`.

## Consequences
- `cbrain write` always makes one LLM API call (Haiku 4.5 by default).
- Extraction prompt must be defined in `src/extraction/prompt.ts` and versioned.
- `cbrain maintain` must include an option to re-run extraction on pages where it failed or was skipped.
- The entity types cbrain supports are defined in the extraction prompt, not in code. Adding a new link type means updating the prompt, not the schema.
