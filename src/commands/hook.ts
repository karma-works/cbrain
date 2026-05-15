import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import {
  CAPTURE_STATE_PATH, SESSION_QUEUE_DIR, ensureDir, loadConfig,
} from '../config.ts';
import { upsertPage, upsertLink } from '../db.ts';
import { embed } from '../embed.ts';
import { extractLinks } from '../extract.ts';

const INGEST_PATTERNS = [
  /specs\/.*\.md$/,
  /specs\/ADR-.*\.md$/,
  /CLAUDE\.md$/,
  /AGENTS\.md$/,
  /CHANGELOG\.md$/,
  /README\.md$/,
];

export async function runHookSessionEnd() {
  const config = loadConfig();
  if (!config.capture_enabled) return;

  // Read hook event data from stdin (Claude Code sends JSON)
  let hookData: any = {};
  try {
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of Bun.stdin.stream()) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw) hookData = JSON.parse(raw);
    }
  } catch { /* ignore parse errors */ }

  const numTurns = hookData.num_turns ?? hookData.numTurns ?? 99;
  if (numTurns < config.capture_min_turns) return;

  // Debounce check
  const lastCapture = loadCaptureState();
  const now = Date.now();
  if (lastCapture && (now - lastCapture) < config.capture_debounce_minutes * 60 * 1000) return;

  // Write to session queue so session-load picks it up next time
  ensureDir(SESSION_QUEUE_DIR);
  const entry = {
    timestamp: now,
    session_id: hookData.session_id ?? 'unknown',
    num_turns: numTurns,
    cwd: process.cwd(),
    captured: false,
  };
  writeFileSync(
    join(SESSION_QUEUE_DIR, `${now}.json`),
    JSON.stringify(entry, null, 2)
  );
  saveCaptureState(now);

  // Output message for Claude Code to show — prompts the agent to run session capture
  // (only output if this appears to be an interactive session, not a sub-process)
  if (numTurns >= config.capture_min_turns) {
    process.stdout.write('cbrain: Session queued for capture. Run /cbrain-session-capture to save this session to your brain.\n');
  }
}

export async function runHookFileWritten(filePath?: string) {
  // Try to get file path from argument, env vars, or stdin JSON
  const path = filePath
    ?? process.env.TOOL_INPUT_FILE_PATH
    ?? process.env.FILE_PATH
    ?? (() => {
      try {
        const raw = readFileSync('/dev/stdin', 'utf8').trim();
        if (raw.startsWith('{')) return JSON.parse(raw)?.tool_input?.file_path;
      } catch { return undefined; }
    })();

  if (!path) return;

  const shouldIngest = INGEST_PATTERNS.some(pat => pat.test(path));
  if (!shouldIngest) return;
  if (!existsSync(path)) return;

  const raw = readFileSync(path, 'utf8');
  let content = raw;
  let frontmatter: any = {};

  if (raw.trim().startsWith('---')) {
    const parsed = matter(raw);
    content = parsed.content.trim();
    frontmatter = parsed.data;
  }

  if (!content.trim()) return;

  const pathParts = path.split('/');
  const filename = pathParts[pathParts.length - 1].replace('.md', '');
  const isADR = /ADR-\d+/.test(filename);
  const type = isADR ? 'decision' : 'note';
  const slug = `${type}s/${filename.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const title = frontmatter.title ?? filename.replace(/[-_]/g, ' ');
  const source = inferSourceFromPath(path);

  const config = loadConfig();
  let embedding: Float32Array | undefined;
  try {
    embedding = await embed(`${title}\n${content.slice(0, 8000)}`);
  } catch { /* non-fatal */ }

  upsertPage({
    slug, title, type, source,
    date: new Date().toISOString().split('T')[0],
    tags: isADR ? ['architecture', 'decision'] : ['auto-ingested'],
    confidence: 'medium',
    schema_version: 1,
    content: content.slice(0, 50000),
    embedding,
    embedding_provider: embedding ? config.embedding_provider : undefined,
    embedding_model: embedding ? config.embedding_model : undefined,
  });

  try {
    const links = await extractLinks(slug, title, content);
    for (const l of links) upsertLink({ source_slug: slug, target_slug: l.target_slug, link_type: l.link_type });
  } catch { /* non-fatal */ }
}

export function runHookListQueue(): void {
  if (!existsSync(SESSION_QUEUE_DIR)) { console.log('No pending sessions.'); return; }
  const files = readdirSync(SESSION_QUEUE_DIR).filter(f => f.endsWith('.json'));
  if (!files.length) { console.log('No pending sessions.'); return; }
  for (const f of files) {
    const entry = JSON.parse(readFileSync(join(SESSION_QUEUE_DIR, f), 'utf8'));
    console.log(`${new Date(entry.timestamp).toISOString()}  turns:${entry.num_turns}  cwd:${entry.cwd}  captured:${entry.captured}`);
  }
}

export function getPendingSessions(): any[] {
  if (!existsSync(SESSION_QUEUE_DIR)) return [];
  return readdirSync(SESSION_QUEUE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(SESSION_QUEUE_DIR, f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean)
    .filter((e: any) => !e.captured)
    .sort((a: any, b: any) => b.timestamp - a.timestamp);
}

export function markSessionCaptured(timestamp: number) {
  const path = join(SESSION_QUEUE_DIR, `${timestamp}.json`);
  if (!existsSync(path)) return;
  const entry = JSON.parse(readFileSync(path, 'utf8'));
  entry.captured = true;
  writeFileSync(path, JSON.stringify(entry, null, 2));
}

function loadCaptureState(): number | null {
  try {
    if (!existsSync(CAPTURE_STATE_PATH)) return null;
    return JSON.parse(readFileSync(CAPTURE_STATE_PATH, 'utf8')).last_capture ?? null;
  } catch { return null; }
}

function saveCaptureState(ts: number) {
  writeFileSync(CAPTURE_STATE_PATH, JSON.stringify({ last_capture: ts }));
}

function inferSourceFromPath(filePath: string): string {
  const parts = filePath.split('/');
  // Walk up from file to find project root (contains package.json or .git)
  for (let i = parts.length - 1; i >= 0; i--) {
    const dir = parts.slice(0, i).join('/');
    if (existsSync(join(dir, 'package.json')) || existsSync(join(dir, '.git'))) {
      return parts[i - 1] || 'cbrain';
    }
  }
  return parts[parts.length - 2] || 'cbrain';
}
