import { hybridSearch } from '../search.ts';

export async function runSearch(
  query: string,
  opts: { limit?: number; source?: string; type?: string; json?: boolean }
) {
  const results = await hybridSearch(query, {
    limit: opts.limit ?? 10,
    source: opts.source,
    type: opts.type,
  });

  if (opts.json) {
    console.log(JSON.stringify(results.map(r => ({ ...r, content: r.content.slice(0, 300) }))));
    return;
  }

  if (!results.length) {
    console.log('No results found.');
    return;
  }

  console.log(`${results.length} result(s) for: "${query}"\n`);
  for (const [i, r] of results.entries()) {
    const preview = r.content.slice(0, 150).replace(/\n/g, ' ');
    const scoreStr = r.score.toFixed(4);
    console.log(`${i + 1}. ${r.slug} (${r.type}, ${r.confidence}) [score: ${scoreStr}]`);
    console.log(`   ${r.title}`);
    if (preview) console.log(`   ${preview}…`);
    console.log();
  }
}
