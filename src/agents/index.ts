import type { AgentInstallOptions, AgentTarget, AgentUninstallOptions } from './common.ts';
import { installClaude, uninstallClaude } from './claude.ts';
import { installCodex, uninstallCodex } from './codex.ts';

export function normalizeTarget(value?: string): AgentTarget {
  if (!value || value === 'all') return 'all';
  if (value === 'claude' || value === 'codex') return value;
  throw new Error(`Unsupported agent target: ${value}. Use all, claude, or codex.`);
}

export function installAgents(opts: AgentInstallOptions): string[] {
  const changes: string[] = [];
  if (opts.target === 'all' || opts.target === 'claude') {
    changes.push(...installClaude({ linkSkills: opts.linkSkills, projectDir: opts.projectDir }));
  }
  if (opts.target === 'all' || opts.target === 'codex') {
    changes.push(...installCodex({ linkSkills: opts.linkSkills, projectDir: opts.projectDir }));
  }
  return changes;
}

export function uninstallAgents(opts: AgentUninstallOptions): string[] {
  const changes: string[] = [];
  if (opts.target === 'all' || opts.target === 'claude') {
    changes.push(...uninstallClaude({ projectDir: opts.projectDir }));
  }
  if (opts.target === 'all' || opts.target === 'codex') {
    changes.push(...uninstallCodex({ projectDir: opts.projectDir }));
  }
  return changes;
}
