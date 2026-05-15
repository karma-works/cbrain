import { loadConfig } from './config.ts';

export async function embed(text: string): Promise<Float32Array> {
  const config = loadConfig();
  const truncated = text.slice(0, 32000);

  if (config.embedding_provider === 'ollama') {
    return embedOllama(truncated, config.ollama_url, config.embedding_model);
  }
  return embedOpenAI(truncated, config.embedding_model);
}

async function embedOpenAI(text: string, model: string): Promise<Float32Array> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set. Run: cbrain config set embedding_provider ollama');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  return new Float32Array(data.data[0].embedding);
}

async function embedOllama(text: string, baseUrl: string, model: string): Promise<Float32Array> {
  const res = await fetch(`${baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || 'nomic-embed-text', prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as any;
  return new Float32Array(data.embedding);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
