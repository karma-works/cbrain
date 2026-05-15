import Anthropic from '@anthropic-ai/sdk';
import { hybridSearch } from '../search.ts';
import { loadConfig } from '../config.ts';

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

  const context = results.map(r =>
    `[${r.slug}] ${r.title} (${r.date}, confidence: ${r.confidence})\n${r.content.slice(0, 600)}`
  ).join('\n\n---\n\n');

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
