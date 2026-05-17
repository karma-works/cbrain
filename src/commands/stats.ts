import { getStats } from '../db.ts';
import { loadConfig, DB_PATH } from '../config.ts';
import { statSync, existsSync } from 'fs';

export function runStats(opts: { json?: boolean }) {
  const stats = getStats();
  const config = loadConfig();
  const dbSize = existsSync(DB_PATH) ? statSync(DB_PATH).size : 0;

  if (opts.json) {
    console.log(JSON.stringify({ ...stats, dbSizeBytes: dbSize, config }));
    return;
  }

  console.log('=== cbrain stats ===\n');
  console.log(`Pages:          ${stats.pages}`);
  console.log(`Links:          ${stats.links}`);
  console.log(`Embedded:       ${stats.withEmbedding} / ${stats.pages}`);
  console.log(`Summarized:     ${stats.withSummary} / ${stats.pages}${stats.staleSummaries > 0 ? ` (${stats.staleSummaries} stale — run: cbrain maintain --summarize)` : ''}`);
  console.log(`DB size:        ${(dbSize / 1024).toFixed(1)} KB`);
  console.log(`\nBy type:`);
  for (const { type, n } of stats.byType) {
    console.log(`  ${type.padEnd(12)} ${n}`);
  }
  console.log(`\nEmbedding:      ${config.embedding_provider}/${config.embedding_model}`);
  console.log(`Capture:        ${config.capture_enabled ? 'enabled' : 'disabled'}`);
}
