import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DB_PATH, BACKUPS_DIR, ensureDir } from '../config.ts';

export function runBackup(dest?: string, opts: { json?: boolean } = {}) {
  if (!existsSync(DB_PATH)) {
    process.stderr.write('Brain not initialized. Run: cbrain init\n');
    process.exit(1);
  }

  ensureDir(BACKUPS_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = dest ?? join(BACKUPS_DIR, `brain-${timestamp}.db`);

  copyFileSync(DB_PATH, target);

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, path: target }));
  } else {
    console.log(`Backup saved: ${target}`);
  }
}
