import { upsertLink, getPage } from '../db.ts';

export function runLink(
  fromSlug: string, linkType: string, toSlug: string,
  opts: { json?: boolean }
) {
  if (!getPage(fromSlug)) {
    process.stderr.write(`Source page not found: ${fromSlug}\n`);
    process.exit(1);
  }

  upsertLink({ source_slug: fromSlug, target_slug: toSlug, link_type: linkType });

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, from: fromSlug, type: linkType, to: toSlug }));
  } else {
    console.log(`✓ ${fromSlug} —[${linkType}]→ ${toSlug}`);
  }
}
