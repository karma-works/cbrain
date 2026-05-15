import { listPages, upsertPage } from '../db.ts';
import { embed } from '../embed.ts';
import { loadConfig } from '../config.ts';

export async function runReEmbed(opts: { json?: boolean }) {
  const config = loadConfig();
  const pages = listPages();
  let success = 0, failed = 0;

  for (const page of pages) {
    const text = `${page.title}\n${page.content}`.trim();
    if (!text) continue;
    try {
      const embedding = await embed(text);
      upsertPage({
        ...page,
        embedding,
        embedding_provider: config.embedding_provider,
        embedding_model: config.embedding_model,
      });
      success++;
      if (!opts.json) process.stderr.write(`  ✓ ${page.slug}\n`);
    } catch (e) {
      failed++;
      if (!opts.json) process.stderr.write(`  ✗ ${page.slug}: ${(e as Error).message}\n`);
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ success, failed, total: pages.length }));
  } else {
    console.log(`Re-embed complete: ${success} succeeded, ${failed} failed`);
  }
}
