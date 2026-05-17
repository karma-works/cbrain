import { uninstallAgents, normalizeTarget } from '../agents/index.ts';

export async function runUninstall(opts: { agent?: string; json?: boolean }) {
  const target = normalizeTarget(opts.agent);
  const changes = uninstallAgents({ target, projectDir: process.cwd() });

  if (opts.json) {
    console.log(JSON.stringify({ target, changes }, null, 2));
    return;
  }

  if (!changes.length) {
    console.log('No cbrain agent integration found to remove.');
    return;
  }

  console.log('Removed cbrain agent integration:');
  for (const change of changes) console.log(`  ${change}`);
  console.log('\nBrain data in ~/.cbrain/brain.db was not removed.');
}
