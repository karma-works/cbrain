import Anthropic from '@anthropic-ai/sdk';
import { hybridSearch } from '../search.ts';
import { getSummariesForSlugs } from '../db.ts';
import { loadConfig } from '../config.ts';
import type { SearchResult } from '../types.ts';

const RECENT_DAYS = 7;
const RAW_CONTENT_MAX = 600;
const SUMMARY_CONTENT_MAX = 800;
const LONG_PAGE_THRESHOLD = 1000;

export async function runQuery(question: string, opts: { limit?: number; json?: boolean }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write('ANTHROPIC_API_KEY not set.\n');
    process.exit(1);
  }

  const results = await hybridSearch(question, { limit: opts.limit ?? 8 });
  if (!results.length) {
    console.log('No relevant pages found in brain.');
    return;
  }

  const summaryMap = await getSummariesForSlugs(results.map(r => r.slug));
  const now = Date.now();
  const recentMs = RECENT_DAYS * 24 * 60 * 60 * 1000;

  const context = results.map(r => {
    const body = pickBody(r, summaryMap, now, recentMs);
    return `[${r.slug}] ${r.title} (${r.date}, confidence: ${r.confidence})\n${body}`;
  }).join('\n\n---\n\n');

  const config = loadConfig();
  const client = new Anthropic({ apiKey });

  const prompt = `You are answering a question based on a personal knowledge brain.
Use ONLY the pages provided. If the answer isn't in the pages, say so.
Always cite which page(s) you used.

Pages from brain:
${context}

Question: ${question}`;

  const msg = await client.messages.create({
    model: config.query_model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const answer = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const sources = results.map(r => r.slug);

  if (opts.json) {
    console.log(JSON.stringify({ answer, sources }));
  } else {
    console.log(answer);
    console.log('\nSources: ' + sources.join(', '));
  }
}

function pickBody(
  result: SearchResult,
  summaryMap: Map<string, { content: string }>,
  now: number,
  recentMs: number,
): string {
  const isRecent = (now - new Date(result.date).getTime()) < recentMs;

  // For recent or short pages, truncated raw content is better signal
  if (isRecent || result.content.length <= LONG_PAGE_THRESHOLD) {
    return result.content.slice(0, RAW_CONTENT_MAX);
  }

  // For older, long pages: use summary if available (denser signal than first 600 chars)
  const summary = summaryMap.get(result.slug);
  if (summary) {
    return summary.content.slice(0, SUMMARY_CONTENT_MAX);
  }

  return result.content.slice(0, RAW_CONTENT_MAX);
}
