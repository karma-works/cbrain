import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  CBRAIN_DIR, DB_PATH, CONFIG_PATH, SESSION_QUEUE_DIR, BACKUPS_DIR,
  ensureDir, loadConfig, saveConfig, isCbrainInitialized,
} from '../config.ts';
import { getDb, closeDb } from '../db.ts';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

export async function runInit(opts: { yes?: boolean; embeddingProvider?: string }) {
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

  // Configure Claude Code hooks
  if (!reinit || opts.yes) {
    configureHooks(opts.yes ?? false);
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
  console.log('  /cbrain-session-load       Load context at session start');
}

function configureHooks(skipPrompt: boolean) {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    console.log(`\nClaude Code settings not found at ${CLAUDE_SETTINGS_PATH}. Skipping hook setup.`);
    return;
  }

  let settings: any = {};
  try {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'));
  } catch {
    console.log('Could not parse Claude Code settings. Skipping hook setup.');
    return;
  }

  if (!settings.hooks) settings.hooks = {};

  // Stop hook for session-end capture
  const stopHook = { type: 'command', command: 'cbrain hook session-end' };
  const postToolHook = { type: 'command', command: 'cbrain hook file-written' };

  let changed = false;

  // Add Stop hook
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [{ matcher: '', hooks: [stopHook] }];
    changed = true;
  } else {
    const alreadyHas = settings.hooks.Stop.some((h: any) =>
      h.hooks?.some((hh: any) => hh.command?.includes('cbrain hook session-end'))
    );
    if (!alreadyHas) {
      settings.hooks.Stop[0].hooks = [...(settings.hooks.Stop[0].hooks ?? []), stopHook];
      changed = true;
    }
  }

  // Add PostToolUse hook for Write/Edit
  if (!settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = [{ matcher: 'Write|Edit', hooks: [postToolHook] }];
    changed = true;
  } else {
    const alreadyHas = settings.hooks.PostToolUse.some((h: any) =>
      h.hooks?.some((hh: any) => hh.command?.includes('cbrain hook file-written'))
    );
    if (!alreadyHas) {
      settings.hooks.PostToolUse.push({ matcher: 'Write|Edit', hooks: [postToolHook] });
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log('\nClaude Code hooks configured:');
    console.log('  Stop hook → cbrain hook session-end (passive session capture)');
    console.log('  PostToolUse hook → cbrain hook file-written (file event ingestion)');
  } else {
    console.log('\nClaude Code hooks already configured.');
  }
}
