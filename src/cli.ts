#!/usr/bin/env bun
import { Command } from 'commander';
import { isCbrainInitialized } from './config.ts';

const program = new Command();

program
  .name('cbrain')
  .description("Christian's Brain — personal knowledge OS for agent coding sessions")
  .version('0.1.0');

// init
program
  .command('init')
  .description('Initialize cbrain (creates ~/.cbrain/, installs agent skills and hooks)')
  .option('--embedding-provider <provider>', 'openai or ollama')
  .option('--agent <agent>', 'all, claude, or codex', 'all')
  .option('--link-skills', 'symlink skills instead of copying them')
  .option('--skip-agent-setup', 'only initialize ~/.cbrain, do not install skills/hooks')
  .option('-y, --yes', 'skip prompts')
  .action(async (opts) => {
    const { runInit } = await import('./commands/init.ts');
    await runInit({
      yes: opts.yes,
      embeddingProvider: opts.embeddingProvider,
      agent: opts.agent,
      linkSkills: opts.linkSkills,
      skipAgentSetup: opts.skipAgentSetup,
    });
  });

program
  .command('uninstall')
  .description('Remove cbrain agent skills, hooks, and managed instruction blocks')
  .option('--agent <agent>', 'all, claude, or codex', 'all')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    const { runUninstall } = await import('./commands/uninstall.ts');
    await runUninstall(opts);
  });

// write
program
  .command('write <slug>')
  .description('Write a page to the brain')
  .option('--title <title>', 'page title')
  .option('--type <type>', 'decision|concept|person|project|meeting|note|session')
  .option('--source <source>', 'source/project name')
  .option('--tags <tags>', 'comma-separated tags')
  .option('--confidence <level>', 'high|medium|low')
  .option('--content <text>', 'inline content')
  .option('--file <path>', 'read from markdown file')
  .option('--no-extract', 'skip entity extraction')
  .option('--json', 'JSON output')
  .action(async (slug, opts) => {
    requireInit();
    const { runWrite } = await import('./commands/write.ts');
    await runWrite(slug, { ...opts, noExtract: !opts.extract });
  });

// get
program
  .command('get <slug>')
  .description('Retrieve a page by slug')
  .option('--backlinks', 'show backlinks')
  .option('--json', 'JSON output')
  .action(async (slug, opts) => {
    requireInit();
    const { runGet } = await import('./commands/get.ts');
    runGet(slug, opts);
  });

// search
program
  .command('search <query>')
  .description('Hybrid search (vector + BM25 + graph)')
  .option('--limit <n>', 'max results', '10')
  .option('--source <source>', 'filter by source')
  .option('--type <type>', 'filter by page type')
  .option('--json', 'JSON output')
  .action(async (query, opts) => {
    requireInit();
    const { runSearch } = await import('./commands/search.ts');
    await runSearch(query, { ...opts, limit: parseInt(opts.limit) });
  });

// query
program
  .command('query <question>')
  .description('Ask a question answered from your brain (RAG)')
  .option('--limit <n>', 'pages to retrieve', '8')
  .option('--json', 'JSON output')
  .action(async (question, opts) => {
    requireInit();
    const { runQuery } = await import('./commands/query.ts');
    await runQuery(question, { ...opts, limit: parseInt(opts.limit) });
  });

// link
program
  .command('link <from> <type> <to>')
  .description('Add a typed link between pages')
  .option('--json', 'JSON output')
  .action(async (from, type, to, opts) => {
    requireInit();
    const { runLink } = await import('./commands/link.ts');
    runLink(from, type, to, opts);
  });

// maintain
program
  .command('maintain')
  .description('Run brain health checks (stale, orphans, dead links, duplicates)')
  .option('--json', 'JSON output')
  .option('--summarize', 'generate/refresh LLM summaries for pages missing or stale summaries')
  .action(async (opts) => {
    requireInit();
    const { runMaintain } = await import('./commands/maintain.ts');
    await runMaintain(opts);
  });

// backup
program
  .command('backup [dest]')
  .description('Backup brain.db to a file')
  .option('--json', 'JSON output')
  .action(async (dest, opts) => {
    const { runBackup } = await import('./commands/backup.ts');
    runBackup(dest, opts);
  });

// stats
program
  .command('stats')
  .description('Show brain statistics')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    requireInit();
    const { runStats } = await import('./commands/stats.ts');
    runStats(opts);
  });

// re-embed
program
  .command('re-embed')
  .description('Re-embed all pages (use after switching embedding provider)')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    requireInit();
    const { runReEmbed } = await import('./commands/re-embed.ts');
    await runReEmbed(opts);
  });

// hook
const hookCmd = program.command('hook').description('Internal hook handlers (called by agent hooks)');

hookCmd
  .command('session-end')
  .description('Handle Stop hook — queue session for capture')
  .option('--agent <agent>', 'claude or codex')
  .action(async (opts) => {
    const { runHookSessionEnd } = await import('./commands/hook.ts');
    await runHookSessionEnd(opts);
  });

hookCmd
  .command('session-start')
  .description('Handle session start hook — add cbrain context reminder')
  .option('--agent <agent>', 'codex')
  .action(async (opts) => {
    const { runHookSessionStart } = await import('./commands/hook.ts');
    await runHookSessionStart(opts);
  });

hookCmd
  .command('file-written [path]')
  .description('Handle PostToolUse Write/Edit hook — auto-ingest high-signal files')
  .option('--agent <agent>', 'claude or codex')
  .action(async (path, opts) => {
    if (!isCbrainInitialized()) return;
    const { runHookFileWritten } = await import('./commands/hook.ts');
    await runHookFileWritten(path, opts);
  });

hookCmd
  .command('list-queue')
  .description('List pending session capture queue')
  .action(async () => {
    const { runHookListQueue } = await import('./commands/hook.ts');
    runHookListQueue();
  });

// config (simple get/set)
const configCmd = program.command('config').description('Get or set config values');

configCmd
  .command('get [key]')
  .description('Get config value(s)')
  .action(async (key) => {
    const { loadConfig } = await import('./config.ts');
    const config = loadConfig();
    if (key) {
      console.log((config as any)[key] ?? '(not set)');
    } else {
      console.log(JSON.stringify(config, null, 2));
    }
  });

configCmd
  .command('set <key> <value>')
  .description('Set a config value')
  .action(async (key, value) => {
    const { saveConfig } = await import('./config.ts');
    saveConfig({ [key]: value });
    console.log(`Set ${key} = ${value}`);
  });

function requireInit() {
  if (!isCbrainInitialized()) {
    process.stderr.write('cbrain not initialized. Run: cbrain init\n');
    process.exit(1);
  }
}

program.parse();
