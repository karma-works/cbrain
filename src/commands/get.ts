import { getPage, getLinksFrom, getLinksTo } from '../db.ts';

export function runGet(slug: string, opts: { json?: boolean; backlinks?: boolean }) {
  const page = getPage(slug);
  if (!page) {
    process.stderr.write(`Page not found: ${slug}\n`);
    process.exit(1);
  }

  if (opts.json) {
    const links = getLinksFrom(slug);
    const backlinks = opts.backlinks ? getLinksTo(slug) : [];
    console.log(JSON.stringify({ ...page, embedding: undefined, links, backlinks }));
    return;
  }

  // Human-readable output as markdown with frontmatter
  const tags = page.tags.join(', ');
  const linksFrom = getLinksFrom(slug);
  const linksArr = linksFrom.map(l => `  - target: ${l.target_slug}\n    type: ${l.link_type}`).join('\n');

  console.log(`---`);
  console.log(`slug: ${page.slug}`);
  console.log(`title: ${page.title}`);
  console.log(`type: ${page.type}`);
  console.log(`source: ${page.source}`);
  console.log(`date: ${page.date}`);
  console.log(`tags: [${tags}]`);
  console.log(`confidence: ${page.confidence}`);
  console.log(`schema_version: ${page.schema_version}`);
  if (linksFrom.length) console.log(`links:\n${linksArr}`);
  console.log(`---`);
  console.log();
  console.log(page.content);

  if (opts.backlinks) {
    const backlinks = getLinksTo(slug);
    if (backlinks.length) {
      console.log('\n---\nBacklinks:');
      for (const l of backlinks) console.log(`  ← ${l.source_slug} (${l.link_type})`);
    }
  }
}
