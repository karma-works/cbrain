import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.ts';

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface SummarizeResult {
  text: string;
  level: 1 | 2 | 3;
  token_count: number;
}

/**
 * Three-level escalation — guaranteed to converge regardless of model behavior.
 *
 * Level 1: LLM summarize, preserve details.
 * Level 2: LLM summarize, aggressive bullet-points at half target tokens.
 * Level 3: Deterministic truncation — no LLM, always succeeds.
 */
export async function summarizeContent(
  content: string,
  targetTokens: number = 300,
): Promise<SummarizeResult> {
  const inputTokens = estimateTokens(content);

  if (inputTokens <= targetTokens) {
    return { text: content, level: 1, token_count: inputTokens };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return deterministicTruncate(content, targetTokens);
  }

  const config = loadConfig();
  const client = new Anthropic({ apiKey });

  // Level 1: normal summarization
  const l1 = await tryLlmSummarize(client, config.extraction_model, content, targetTokens, 'normal');
  if (l1 !== null && estimateTokens(l1) < inputTokens) {
    return { text: l1, level: 1, token_count: estimateTokens(l1) };
  }

  // Level 2: aggressive bullet-points at half the target
  const l2 = await tryLlmSummarize(client, config.extraction_model, content, Math.floor(targetTokens / 2), 'aggressive');
  if (l2 !== null && estimateTokens(l2) < inputTokens) {
    return { text: l2, level: 2, token_count: estimateTokens(l2) };
  }

  // Level 3: deterministic — always converges
  return deterministicTruncate(content, targetTokens);
}

async function tryLlmSummarize(
  client: Anthropic,
  model: string,
  content: string,
  targetTokens: number,
  mode: 'normal' | 'aggressive',
): Promise<string | null> {
  const targetWords = Math.floor(targetTokens * 0.75);
  const prompt = mode === 'normal'
    ? `Summarize the following in approximately ${targetWords} words. Preserve key decisions, facts, entities, and reasoning. Return only the summary, no preamble.\n\n${content.slice(0, 16000)}`
    : `Summarize the following as concise bullet points in at most ${targetWords} words. Only the most critical facts. Return only the bullets, no preamble.\n\n${content.slice(0, 16000)}`;

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: Math.max(targetTokens + 64, 128),
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content[0].type === 'text' ? msg.content[0].text.trim() : null;
  } catch {
    return null;
  }
}

function deterministicTruncate(content: string, targetTokens: number): SummarizeResult {
  const maxChars = Math.max(targetTokens * CHARS_PER_TOKEN, 512 * CHARS_PER_TOKEN);
  const text = content.length > maxChars
    ? content.slice(0, maxChars - 3) + '...'
    : content;
  return { text, level: 3, token_count: estimateTokens(text) };
}
