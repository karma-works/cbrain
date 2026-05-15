import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const CBRAIN_DIR = join(homedir(), '.cbrain');
export const DB_PATH = join(CBRAIN_DIR, 'brain.db');
export const CONFIG_PATH = join(CBRAIN_DIR, 'config.json');
export const SESSION_QUEUE_DIR = join(CBRAIN_DIR, 'session-queue');
export const CAPTURE_STATE_PATH = join(CBRAIN_DIR, 'capture-state.json');
export const BACKUPS_DIR = join(CBRAIN_DIR, 'backups');

export interface CbrainConfig {
  embedding_provider: 'openai' | 'ollama';
  embedding_model: string;
  ollama_url: string;
  extraction_model: string;
  query_model: string;
  capture_enabled: boolean;
  capture_debounce_minutes: number;
  capture_min_turns: number;
}

const DEFAULTS: CbrainConfig = {
  embedding_provider: 'openai',
  embedding_model: 'text-embedding-3-small',
  ollama_url: 'http://localhost:11434',
  extraction_model: 'claude-haiku-4-5-20251001',
  query_model: 'claude-haiku-4-5-20251001',
  capture_enabled: true,
  capture_debounce_minutes: 30,
  capture_min_turns: 5,
};

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): CbrainConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Partial<CbrainConfig>) {
  ensureDir(CBRAIN_DIR);
  const current = loadConfig();
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, ...config }, null, 2));
}

export function isCbrainInitialized(): boolean {
  return existsSync(DB_PATH);
}
