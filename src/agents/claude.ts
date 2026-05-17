import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  installSkills, uninstallSkills, upsertManagedBlock, removeManagedBlock,
  projectInstructionBody, recordInstall,
} from './common.ts';

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const CLAUDE_SKILLS_DIR = join(homedir(), '.claude', 'skills');

export function installClaude(opts: { linkSkills: boolean; projectDir: string }): string[] {
  const changes: string[] = [];
  const skills = installSkills(CLAUDE_SKILLS_DIR, opts.linkSkills);
  if (skills.length) changes.push(`Installed Claude skills: ${CLAUDE_SKILLS_DIR}`);

  if (configureClaudeHooks()) changes.push(`Configured Claude hooks: ${CLAUDE_SETTINGS_PATH}`);
  if (upsertManagedBlock(join(opts.projectDir, 'CLAUDE.md'), projectInstructionBody())) {
    changes.push(`Updated project instructions: ${join(opts.projectDir, 'CLAUDE.md')}`);
  }

  recordInstall({ claude: { skills_dir: CLAUDE_SKILLS_DIR, settings_path: CLAUDE_SETTINGS_PATH } });
  return changes;
}

export function uninstallClaude(opts: { projectDir: string }): string[] {
  const changes: string[] = [];
  const removedSkills = uninstallSkills(CLAUDE_SKILLS_DIR);
  if (removedSkills.length) changes.push(`Removed Claude skills: ${CLAUDE_SKILLS_DIR}`);
  if (removeClaudeHooks()) changes.push(`Removed Claude hooks: ${CLAUDE_SETTINGS_PATH}`);
  if (removeManagedBlock(join(opts.projectDir, 'CLAUDE.md'))) {
    changes.push(`Removed cbrain block: ${join(opts.projectDir, 'CLAUDE.md')}`);
  }
  return changes;
}

function configureClaudeHooks(): boolean {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;
  let settings: any = {};
  try {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'));
  } catch {
    return false;
  }

  if (!settings.hooks) settings.hooks = {};
  let changed = false;

  const stopHook = { type: 'command', command: 'cbrain hook session-end --agent claude' };
  const postToolHook = { type: 'command', command: 'cbrain hook file-written --agent claude' };

  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [{ matcher: '', hooks: [stopHook] }];
    changed = true;
  } else if (!hasCommand(settings.hooks.Stop, 'cbrain hook session-end')) {
    settings.hooks.Stop[0].hooks = [...(settings.hooks.Stop[0].hooks ?? []), stopHook];
    changed = true;
  }

  if (!settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = [{ matcher: 'Write|Edit', hooks: [postToolHook] }];
    changed = true;
  } else if (!hasCommand(settings.hooks.PostToolUse, 'cbrain hook file-written')) {
    settings.hooks.PostToolUse.push({ matcher: 'Write|Edit', hooks: [postToolHook] });
    changed = true;
  }

  if (!changed) return false;
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
}

function removeClaudeHooks(): boolean {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;
  let settings: any = {};
  try {
    settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'));
  } catch {
    return false;
  }
  if (!settings.hooks) return false;

  const before = JSON.stringify(settings);
  for (const event of ['Stop', 'PostToolUse']) {
    if (!Array.isArray(settings.hooks[event])) continue;
    settings.hooks[event] = settings.hooks[event]
      .map((group: any) => ({
        ...group,
        hooks: (group.hooks ?? []).filter((hook: any) => !hook.command?.includes('cbrain hook ')),
      }))
      .filter((group: any) => (group.hooks ?? []).length > 0);
    if (!settings.hooks[event].length) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  if (JSON.stringify(settings) === before) return false;
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return true;
}

function hasCommand(groups: any[], commandPart: string): boolean {
  return groups.some((group: any) => group.hooks?.some((hook: any) => hook.command?.includes(commandPart)));
}
