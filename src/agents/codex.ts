import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ensureDir } from '../config.ts';
import {
  installSkills, uninstallSkills, upsertManagedBlock, removeManagedBlock,
  projectInstructionBody, recordInstall,
} from './common.ts';

const CODEX_DIR = join(homedir(), '.codex');
const CODEX_HOOKS_PATH = join(CODEX_DIR, 'hooks.json');
const CODEX_SKILLS_DIR = join(CODEX_DIR, 'skills');
const AGENTS_SKILLS_DIR = join(homedir(), '.agents', 'skills');

export function installCodex(opts: { linkSkills: boolean; projectDir: string }): string[] {
  const changes: string[] = [];
  const codexSkills = installSkills(CODEX_SKILLS_DIR, opts.linkSkills);
  const agentsSkills = installSkills(AGENTS_SKILLS_DIR, opts.linkSkills);
  if (codexSkills.length) changes.push(`Installed Codex skills: ${CODEX_SKILLS_DIR}`);
  if (agentsSkills.length) changes.push(`Installed shared agent skills: ${AGENTS_SKILLS_DIR}`);
  if (configureCodexHooks()) changes.push(`Configured Codex hooks: ${CODEX_HOOKS_PATH}`);
  if (upsertManagedBlock(join(opts.projectDir, 'AGENTS.md'), projectInstructionBody())) {
    changes.push(`Updated project instructions: ${join(opts.projectDir, 'AGENTS.md')}`);
  }

  recordInstall({
    codex: {
      hooks_path: CODEX_HOOKS_PATH,
      skills_dirs: [CODEX_SKILLS_DIR, AGENTS_SKILLS_DIR],
    },
  });
  return changes;
}

export function uninstallCodex(opts: { projectDir: string }): string[] {
  const changes: string[] = [];
  const removedCodex = uninstallSkills(CODEX_SKILLS_DIR);
  const removedAgents = uninstallSkills(AGENTS_SKILLS_DIR);
  if (removedCodex.length) changes.push(`Removed Codex skills: ${CODEX_SKILLS_DIR}`);
  if (removedAgents.length) changes.push(`Removed shared agent skills: ${AGENTS_SKILLS_DIR}`);
  if (removeCodexHooks()) changes.push(`Removed Codex hooks: ${CODEX_HOOKS_PATH}`);
  if (removeManagedBlock(join(opts.projectDir, 'AGENTS.md'))) {
    changes.push(`Removed cbrain block: ${join(opts.projectDir, 'AGENTS.md')}`);
  }
  return changes;
}

function configureCodexHooks(): boolean {
  ensureDir(CODEX_DIR);
  const hooks = readHooks();
  if (!hooks.hooks) hooks.hooks = {};
  let changed = false;

  changed = addHook(hooks.hooks, 'SessionStart', {
    matcher: 'startup|resume',
    hooks: [{
      type: 'command',
      command: 'cbrain hook session-start --agent codex',
      timeout: 30,
      statusMessage: 'Loading cbrain context',
    }],
  }) || changed;

  changed = addHook(hooks.hooks, 'PostToolUse', {
    matcher: 'Edit|Write|apply_patch',
    hooks: [{
      type: 'command',
      command: 'cbrain hook file-written --agent codex',
      timeout: 30,
      statusMessage: 'Updating cbrain file memory',
    }],
  }) || changed;

  changed = addHook(hooks.hooks, 'Stop', {
    hooks: [{
      type: 'command',
      command: 'cbrain hook session-end --agent codex',
      timeout: 30,
      statusMessage: 'Queueing cbrain capture',
    }],
  }) || changed;

  if (!changed) return false;
  writeFileSync(CODEX_HOOKS_PATH, JSON.stringify(hooks, null, 2));
  return true;
}

function removeCodexHooks(): boolean {
  if (!existsSync(CODEX_HOOKS_PATH)) return false;
  const hooks = readHooks();
  if (!hooks.hooks) return false;
  const before = JSON.stringify(hooks);

  for (const event of ['SessionStart', 'PostToolUse', 'Stop']) {
    if (!Array.isArray(hooks.hooks[event])) continue;
    hooks.hooks[event] = hooks.hooks[event]
      .map((group: any) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook: any) => !hook.command?.includes('cbrain hook ')),
      }))
      .filter((group: any) => (group.hooks ?? []).length > 0);
    if (!hooks.hooks[event].length) delete hooks.hooks[event];
  }
  if (Object.keys(hooks.hooks).length === 0) delete hooks.hooks;
  if (JSON.stringify(hooks) === before) return false;
  if (Object.keys(hooks).length === 0) {
    rmSync(CODEX_HOOKS_PATH, { force: true });
  } else {
    writeFileSync(CODEX_HOOKS_PATH, JSON.stringify(hooks, null, 2));
  }
  return true;
}

function addHook(root: Record<string, any[]>, event: string, group: any): boolean {
  if (!Array.isArray(root[event])) root[event] = [];
  const command = group.hooks[0].command;
  const exists = root[event].some((existing: any) =>
    existing.hooks?.some((hook: any) => hook.command === command || hook.command?.includes(command))
  );
  if (exists) return false;
  root[event].push(group);
  return true;
}

function readHooks(): any {
  if (!existsSync(CODEX_HOOKS_PATH)) return { hooks: {} };
  try {
    return JSON.parse(readFileSync(CODEX_HOOKS_PATH, 'utf8'));
  } catch {
    return { hooks: {} };
  }
}
