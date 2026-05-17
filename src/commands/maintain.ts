import { listPages, getAllLinks, getAllEmbeddings, getPagesNeedingSummary, upsertSummary } from '../db.ts';
import { cosineSimilarity } from '../embed.ts';
import { summarizeContent, estimateTokens } from '../summarize.ts';
import { llmMap } from '../llm-map.ts';
import type { MaintainReport, Page } from '../types.ts';

const STALE_DAYS = 90;
const DUPLICATE_THRESHOLD = 0.96;
const SUMMARY_TARGET_TOKENS = 300;
const SUMMARIZE_CONCURRENCY = 6;

export async function runMaintain(opts: { json?: boolean; fix?: boolean; summarize?: boolean }): Promise<MaintainReport> {
  const pages = listPages();
  const links = getAllLinks();
  const now = Date.now();

  // Stale pages: confidence=high but not updated in STALE_DAYS days
  const stale: string[] = [];
  for (const p of pages) {
    const ageDays = (now - p.updated_at) / (1000 * 60 * 60 * 24);
    if (p.confidence === 'high' && ageDays > STALE_DAYS) {
      stale.push(p.slug);
    }
  }

  // Orphan pages: no incoming or outgoing links, not a session
  const slugsWithLinks = new Set([
    ...links.map(l => l.source_slug),
    ...links.map(l => l.target_slug),
  ]);
  const orphans = pages
    .filter(p => p.type !== 'session' && !slugsWithLinks.has(p.slug))
    .map(p => p.slug);

  // Dead links: target slug doesn't exist
  const allSlugs = new Set(pages.map(p => p.slug));
  const dead_links = links
    .filter(l => !allSlugs.has(l.target_slug))
    .map(l => ({ source: l.source_slug, target: l.target_slug, type: l.link_type }));

  // Duplicate detection via embedding similarity
  const duplicates: Array<{ slug1: string; slug2: string; similarity: number }> = [];
  const embeddings = getAllEmbeddings();
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
      if (sim >= DUPLICATE_THRESHOLD) {
        duplicates.push({ slug1: embeddings[i].slug, slug2: embeddings[j].slug, similarity: sim });
      }
    }
  }

  const report: MaintainReport = { stale, orphans, dead_links, duplicates };

  if (opts.json && !opts.summarize) {
    console.log(JSON.stringify(report));
    return report;
  }

  if (!opts.json) {
    console.log('=== cbrain maintenance report ===\n');
    console.log(`Stale pages (>${STALE_DAYS}d, confidence=high): ${stale.length}`);
    stale.forEach(s => console.log(`  - ${s}`));

    console.log(`\nOrphan pages (no links): ${orphans.length}`);
    orphans.forEach(s => console.log(`  - ${s}`));

    console.log(`\nDead links (target missing): ${dead_links.length}`);
    dead_links.forEach(l => console.log(`  - ${l.source} —[${l.type}]→ ${l.target} (missing)`));

    console.log(`\nPotential duplicates (similarity ≥ ${DUPLICATE_THRESHOLD}): ${duplicates.length}`);
    duplicates.forEach(d => console.log(`  - ${d.slug1} ≈ ${d.slug2} (${(d.similarity * 100).toFixed(1)}%)`));

    const total = stale.length + orphans.length + dead_links.length + duplicates.length;
    console.log(`\nTotal issues: ${total}`);
    if (total === 0) console.log('Brain is healthy ✓');
  }

  if (opts.summarize) {
    await runSummarize(opts.json ?? false);
  }

  if (opts.json) {
    console.log(JSON.stringify(report));
  }

  return report;
}

async function runSummarize(jsonMode: boolean) {
  const needsSummary = getPagesNeedingSummary();

  if (!needsSummary.length) {
    if (!jsonMode) console.log('\nSummaries: all up-to-date ✓');
    return;
  }

  if (!jsonMode) {
    console.log(`\n=== Summarizing ${needsSummary.length} page(s) (concurrency ${SUMMARIZE_CONCURRENCY}) ===`);
  }

  const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  let failed = 0;

  const results = await llmMap<Page, { level: 1 | 2 | 3 } | null>(
    needsSummary,
    async (page) => {
      const text = `${page.title}\n\n${page.content}`.trim();
      if (!text) return null;
      const summary = await summarizeContent(text, SUMMARY_TARGET_TOKENS);
      upsertSummary({
        page_slug: page.slug,
        kind: 'leaf',
        level: summary.level,
        content: summary.text,
        token_count: summary.token_count,
      });
      return { level: summary.level };
    },
    {
      concurrency: SUMMARIZE_CONCURRENCY,
      onProgress: jsonMode ? undefined : (done, total) => {
        process.stderr.write(`\r  ${done}/${total}`);
      },
    },
  );

  for (const r of results) {
    if (r.error) {
      failed++;
      if (!jsonMode) process.stderr.write(`\n  ✗ ${r.item.slug}: ${r.error.message}`);
    } else if (r.result) {
      levelCounts[r.result.level]++;
    }
  }

  if (!jsonMode) {
    process.stderr.write('\n');
    const succeeded = Object.values(levelCounts).reduce((a, b) => a + b, 0);
    const levelNote = [
      levelCounts[1] && `${levelCounts[1]} normal`,
      levelCounts[2] && `${levelCounts[2]} aggressive`,
      levelCounts[3] && `${levelCounts[3]} truncated`,
    ].filter(Boolean).join(', ');
    console.log(`Summaries: ${succeeded} generated (${levelNote}), ${failed} failed`);
  }
}
