import { readFileSync } from 'fs';
import matter from 'gray-matter';
import { upsertPage, getPage, upsertLink, deleteLinksFrom } from '../db.ts';
import { embed } from '../embed.ts';
import { extractLinks } from '../extract.ts';
import { loadConfig } from '../config.ts';
import type { PageType, Confidence } from '../types.ts';

export interface WriteOptions {
  title?: string;
  type?: string;
  source?: string;
  tags?: string;
  confidence?: string;
  content?: string;
  file?: string;
  noExtract?: boolean;
  json?: boolean;
}

export async function runWrite(slug: string, opts: WriteOptions) {
  let content = '';
  let frontmatter: Partial<any> = {};

  if (opts.file) {
    const raw = readFileSync(opts.file, 'utf8');
    const parsed = matter(raw);
    content = parsed.content.trim();
    frontmatter = parsed.data;
  } else if (opts.content) {
    content = opts.content;
  } else if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw.trim().startsWith('---')) {
      const parsed = matter(raw);
      content = parsed.content.trim();
      frontmatter = parsed.data;
    } else {
      content = raw.trim();
    }
  }

  const effectiveSlug = frontmatter.slug ?? slug;
  const title = opts.title ?? frontmatter.title ?? effectiveSlug.split('/').pop()?.replace(/-/g, ' ') ?? effectiveSlug;
  const type = (opts.type ?? frontmatter.type ?? 'note') as PageType;
  const source = opts.source ?? frontmatter.source ?? inferSource();
  const tags: string[] = opts.tags ? opts.tags.split(',').map(t => t.trim()) : (frontmatter.tags ?? []);
  const confidence = (opts.confidence ?? frontmatter.confidence ?? 'medium') as Confidence;
  const date = frontmatter.date ?? new Date().toISOString().split('T')[0];

  const existing = getPage(effectiveSlug);
  if (existing && !opts.json) {
    process.stderr.write(`Updating existing page: ${existing.title}\n`);
  }

  // Generate embedding
  const config = loadConfig();
  let embedding: Float32Array | undefined;
  const embeddableText = `${title}\n${content}`.trim();
  if (embeddableText) {
    try {
      embedding = await embed(embeddableText);
    } catch (e) {
      if (!opts.json) process.stderr.write(`Warning: embedding failed (${(e as Error).message}). Page saved without embedding.\n`);
    }
  }

  upsertPage({
    slug: effectiveSlug, title, type, source, date, tags, confidence,
    schema_version: 1, content,
    embedding,
    embedding_provider: embedding ? config.embedding_provider : undefined,
    embedding_model: embedding ? config.embedding_model : undefined,
  });

  // Entity extraction
  if (!opts.noExtract && content) {
    try {
      const links = await extractLinks(effectiveSlug, title, content);
      // Replace all auto-extracted links from this source
      deleteLinksFrom(effectiveSlug);
      // Re-add manual links from frontmatter
      for (const link of (frontmatter.links ?? [])) {
        upsertLink({ source_slug: effectiveSlug, target_slug: link.target, link_type: link.type });
      }
      for (const link of links) {
        upsertLink({ source_slug: effectiveSlug, target_slug: link.target_slug, link_type: link.link_type });
      }
      if (!opts.json && links.length > 0) {
        process.stderr.write(`Extracted ${links.length} link(s): ${links.map(l => `${l.link_type}→${l.target_slug}`).join(', ')}\n`);
      }
    } catch (e) {
      if (!opts.json) process.stderr.write(`Warning: extraction failed (${(e as Error).message}).\n`);
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, slug: effectiveSlug, title, embedded: !!embedding }));
  } else {
    console.log(`✓ ${effectiveSlug} — ${title}`);
  }
}

function inferSource(): string {
  try {
    const cwd = process.cwd();
    const parts = cwd.split('/');
    return parts[parts.length - 1] || 'cbrain';
  } catch {
    return 'cbrain';
  }
}
