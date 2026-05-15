import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from './config.ts';

export interface ExtractedLink {
  target_slug: string;
  link_type: string;
}

const LINK_TYPES = [
  'implements', 'references', 'authored_by', 'attended', 'part_of',
  'depends_on', 'contradicts', 'supersedes', 'related_to', 'worked_with',
  'decided_by', 'member_of', 'founded', 'invested_in', 'advises',
];

const EXTRACTION_PROMPT = `Extract entities and typed relationships from the page below.
Return ONLY a JSON array (no markdown, no explanation) of up to 5 high-confidence links.

Each link: { "target_slug": "<type>/<kebab-name>", "link_type": "<type>" }

Slug types: decision, concept, person, project, meeting, note, session
Link types: ${LINK_TYPES.join(', ')}

Rules:
- Only extract relationships you are confident about
- Normalize names to kebab-case (e.g. "Christian Haegele" → "people/christian-haegele")
- Skip self-references
- If no clear relationships exist, return []

Page slug: {SLUG}
Page title: {TITLE}

Content:
{CONTENT}`;

export async function extractLinks(slug: string, title: string, content: string): Promise<ExtractedLink[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const config = loadConfig();
  const client = new Anthropic({ apiKey });

  const prompt = EXTRACTION_PROMPT
    .replace('{SLUG}', slug)
    .replace('{TITLE}', title)
    .replace('{CONTENT}', content.slice(0, 8000));

  try {
    const msg = await client.messages.create({
      model: config.extraction_model,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const jsonText = text.startsWith('[') ? text : text.match(/\[[\s\S]*\]/)?.[0] ?? '[]';
    const raw = JSON.parse(jsonText) as any[];

    return raw
      .filter(l => l.target_slug && l.link_type && LINK_TYPES.includes(l.link_type))
      .filter(l => l.target_slug !== slug)
      .map(l => ({ target_slug: String(l.target_slug), link_type: String(l.link_type) }))
      .slice(0, 5);
  } catch {
    return [];
  }
}
