export interface LlmMapResult<TIn, TOut> {
  item: TIn;
  result?: TOut;
  error?: Error;
}

/**
 * Concurrency-limited parallel executor.
 *
 * Processes all items in the input array, running at most `concurrency` at a time.
 * Results preserve input order. Failed items carry the error; they do not abort the batch.
 */
export async function llmMap<TIn, TOut>(
  items: TIn[],
  process: (item: TIn, index: number) => Promise<TOut>,
  opts: {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<LlmMapResult<TIn, TOut>[]> {
  if (items.length === 0) return [];

  const concurrency = Math.min(opts.concurrency ?? 8, items.length);
  const results: LlmMapResult<TIn, TOut>[] = new Array(items.length);
  let nextIndex = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) break;
      try {
        const result = await process(items[idx], idx);
        results[idx] = { item: items[idx], result };
      } catch (e) {
        results[idx] = { item: items[idx], error: e as Error };
      }
      done++;
      opts.onProgress?.(done, items.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
