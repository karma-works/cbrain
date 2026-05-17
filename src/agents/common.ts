import {
  existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync,
  readFileSync, writeFileSync, symlinkSync, lstatSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { CBRAIN_DIR, ensureDir } from '../config.ts';

export type AgentTarget = 'all' | 'claude' | 'codex';

export interface AgentInstallOptions {
  target: AgentTarget;
  linkSkills: boolean;
  projectDir: string;
}

export interface AgentUninstallOptions {
  target: AgentTarget;
  projectDir: string;
}

export const SKILL_NAMES = [
  'cbrain-gather-requirements',
  'cbrain-session-load',
  'cbrain-decision-log',
  'cbrain-session-capture',
  'cbrain-resolver',
];

export const CBRAIN_BEGIN = '<!-- BEGIN CBRAIN -->';
export const CBRAIN_END = '<!-- END CBRAIN -->';

export function repoRoot(): string {
  return resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
}

export function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

export function installSkills(destDir: string, linkSkills: boolean): string[] {
  const installed: string[] = [];
  ensureDir(destDir);
  const skillsRoot = findSkillsRoot();
  if (!skillsRoot) return installed;

  for (const skill of SKILL_NAMES) {
    const src = join(skillsRoot, skill);
    if (!existsSync(src)) continue;
    const dest = join(destDir, skill);
    removeInstalledPath(dest);
    if (linkSkills) {
      symlinkSync(src, dest, 'dir');
    } else {
      copyDir(src, dest);
    }
    installed.push(dest);
  }

  return installed;
}

function findSkillsRoot(): string | null {
  const candidates = [
    process.env.CBRAIN_SKILLS_DIR,
    join(process.cwd(), 'skills'),
    join(repoRoot(), 'skills'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'cbrain-session-load'))) return candidate;
  }
  return null;
}

export function uninstallSkills(destDir: string): string[] {
  const removed: string[] = [];
  for (const skill of SKILL_NAMES) {
    const dest = join(destDir, skill);
    if (!existsSync(dest)) continue;
    removeInstalledPath(dest);
    removed.push(dest);
  }
  return removed;
}

export function upsertManagedBlock(filePath: string, body: string): boolean {
  ensureDir(dirname(filePath));
  const block = `${CBRAIN_BEGIN}\n${body.trim()}\n${CBRAIN_END}\n`;
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const pattern = new RegExp(`${escapeRegExp(CBRAIN_BEGIN)}[\\s\\S]*?${escapeRegExp(CBRAIN_END)}\\n?`, 'm');
  const next = pattern.test(current)
    ? current.replace(pattern, block)
    : `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${block}`;
  if (next === current) return false;
  writeFileSync(filePath, next);
  return true;
}

export function removeManagedBlock(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const current = readFileSync(filePath, 'utf8');
  const pattern = new RegExp(`\\n?${escapeRegExp(CBRAIN_BEGIN)}[\\s\\S]*?${escapeRegExp(CBRAIN_END)}\\n?`, 'm');
  const next = current.replace(pattern, current.includes('\n\n') ? '\n' : '').replace(/\n{3,}/g, '\n\n');
  if (next === current) return false;
  if (next.trim()) {
    writeFileSync(filePath, `${next.trimEnd()}\n`);
  } else {
    rmSync(filePath, { force: true });
  }
  return true;
}

export function projectInstructionBody(): string {
  return [
    '## cbrain',
    '',
    'Use cbrain as the persistent memory layer for this project.',
    '',
    '- At the start of substantial work, run `cbrain-session-load` or `cbrain search "<project> recent decisions"` to restore context.',
    '- When a durable decision is made, use `cbrain-decision-log` or run `cbrain write` with a `decisions/...` slug.',
    '- At the end of substantial work, use `cbrain-session-capture` to store useful decisions, solved problems, and next steps.',
    '- Prefer `cbrain get <slug>` before asking the user to re-explain prior project context.',
  ].join('\n');
}

export function recordInstall(values: Record<string, unknown>) {
  ensureDir(CBRAIN_DIR);
  const path = join(CBRAIN_DIR, 'install-manifest.json');
  const current = existsSync(path) ? safeJson(path) : {};
  writeFileSync(path, JSON.stringify({ ...current, ...values, updated_at: new Date().toISOString() }, null, 2));
}

function safeJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) {
      copyDir(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function removeInstalledPath(path: string) {
  if (!existsSync(path)) return;
  const info = lstatSync(path);
  if (info.isSymbolicLink() || info.isDirectory()) {
    rmSync(path, { recursive: true, force: true });
  } else {
    rmSync(path, { force: true });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
