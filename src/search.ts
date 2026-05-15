import { getAllEmbeddings, bm25Search, graphNeighbors, listPages } from './db.ts';
import { embed, cosineSimilarity } from './embed.ts';
import type { SearchResult } from './types.ts';

const RRF_K = 60;

interface RankedSlug { slug: string; rank: number; score: number }

function rrf(lists: RankedSlug[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (const { slug, rank } of list) {
      scores.set(slug, (scores.get(slug) ?? 0) + 1 / (RRF_K + rank + 1));
    }
  }
  return scores;
}

export async function hybridSearch(
  query: string,
  opts: { limit?: number; source?: string; type?: string } = {}
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 10;

  // 1. Vector search
  let vectorList: RankedSlug[] = [];
  try {
    const queryEmbedding = await embed(query);
    const allEmbs = getAllEmbeddings();
    const scored = allEmbs.map(({ slug, embedding }) => ({
      slug,
      score: cosineSimilarity(queryEmbedding, embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    vectorList = scored.slice(0, 40).map(({ slug, score }, rank) => ({ slug, rank, score }));
  } catch {
    // embedding may fail if no API key — fall through to BM25 only
  }

  // 2. BM25 search
  const bm25Raw = bm25Search(query, 40);
  const bm25List: RankedSlug[] = bm25Raw.map(({ slug, score }, rank) => ({ slug, rank, score }));

  // 3. Graph expansion from top BM25 + vector hits
  const seedSlugs = [
    ...vectorList.slice(0, 5).map(r => r.slug),
    ...bm25List.slice(0, 5).map(r => r.slug),
  ];
  const graphSlugs = graphNeighbors([...new Set(seedSlugs)], 1);
  const graphList: RankedSlug[] = graphSlugs.slice(0, 20).map((slug, rank) => ({ slug, rank, score: 0 }));

  // 4. RRF merge
  const rrfScores = rrf([vectorList, bm25List, graphList]);

  // 5. Load pages and apply optional filters
  const all = listPages({ source: opts.source, type: opts.type });
  const pageMap = new Map(all.map(p => [p.slug, p]));

  // Include all pages that appear in any list
  const candidates = new Set([
    ...vectorList.map(r => r.slug),
    ...bm25List.map(r => r.slug),
    ...graphList.map(r => r.slug),
  ]);

  const results: SearchResult[] = [];
  for (const slug of candidates) {
    const page = pageMap.get(slug);
    if (!page) continue;
    if (opts.source && page.source !== opts.source) continue;
    if (opts.type && page.type !== opts.type) continue;

    const vectorScore = vectorList.find(r => r.slug === slug)?.score ?? 0;
    const bm25Score = bm25List.find(r => r.slug === slug)?.score ?? 0;

    results.push({
      slug: page.slug,
      title: page.title,
      type: page.type,
      source: page.source,
      date: page.date,
      tags: page.tags,
      confidence: page.confidence,
      content: page.content,
      score: rrfScores.get(slug) ?? 0,
      scores: { vector: vectorScore, bm25: bm25Score },
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
