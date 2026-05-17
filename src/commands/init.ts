import {
  CBRAIN_DIR, DB_PATH, CONFIG_PATH, SESSION_QUEUE_DIR, BACKUPS_DIR,
  ensureDir, loadConfig, saveConfig, isCbrainInitialized,
} from '../config.ts';
import { getDb, closeDb } from '../db.ts';
import { installAgents, normalizeTarget } from '../agents/index.ts';

export async function runInit(opts: { yes?: boolean; embeddingProvider?: string; agent?: string; linkSkills?: boolean; skipAgentSetup?: boolean }) {
  const reinit = isCbrainInitialized();
  if (reinit) {
    console.log('cbrain already initialized. Running migrations and updating config...');
  }

  ensureDir(CBRAIN_DIR);
  ensureDir(SESSION_QUEUE_DIR);
  ensureDir(BACKUPS_DIR);

  // Initialize database (schema runs on first open)
  const db = getDb();
  closeDb();
  console.log(`Database ready: ${DB_PATH}`);

  // Configure embedding provider
  const provider = opts.embeddingProvider as 'openai' | 'ollama' | undefined;
  if (provider) {
    const model = provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-3-small';
    saveConfig({ embedding_provider: provider, embedding_model: model });
    console.log(`Embedding provider: ${provider} (${model})`);
  } else if (!reinit) {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    if (hasOpenAI) {
      saveConfig({ embedding_provider: 'openai', embedding_model: 'text-embedding-3-small' });
      console.log('Embedding provider: openai (text-embedding-3-small) — OPENAI_API_KEY found');
    } else {
      console.log('Warning: OPENAI_API_KEY not set. cbrain will store pages without embeddings.');
      console.log('Set OPENAI_API_KEY or run: cbrain init --embedding-provider ollama');
      saveConfig({ embedding_provider: 'openai', embedding_model: 'text-embedding-3-small' });
    }
  }

  if (!opts.skipAgentSetup) {
    const target = normalizeTarget(opts.agent);
    const changes = installAgents({
      target,
      linkSkills: opts.linkSkills ?? false,
      projectDir: process.cwd(),
    });
    if (changes.length) {
      console.log('\nAgent integration updated:');
      for (const change of changes) console.log(`  ${change}`);
    } else {
      console.log('\nAgent integration already up to date.');
    }
  }

  const config = loadConfig();
  console.log('\ncbrain initialized successfully.');
  console.log(`  Brain: ${DB_PATH}`);
  console.log(`  Config: ${CONFIG_PATH}`);
  console.log(`  Embedding: ${config.embedding_provider}/${config.embedding_model}`);
  console.log(`  Passive capture: ${config.capture_enabled ? 'enabled' : 'disabled'}`);
  console.log('\nNext steps:');
  console.log('  cbrain write <slug>        Write your first page');
  console.log('  cbrain search <query>      Search your brain');
  console.log('  cbrain-session-load        Load context at session start');
}
