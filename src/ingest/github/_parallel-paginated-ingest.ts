import type { GitHubScanLogger } from "./_shared.js";

export interface ParallelPaginatedIngestOptions<T> {
  loadPage(page: number): Promise<T[]>;
  writePage(pageItems: T[], page: number): Promise<void> | void;
  logger?: GitHubScanLogger;
  progressLabel: string;
  pageSize?: number;
  progressIntervalPages?: number;
  concurrency: number;
}

export interface ParallelPaginatedIngestResult {
  pages: number;
  items: number;
}

export async function ingestParallelPaginated<T>(
  options: ParallelPaginatedIngestOptions<T>,
): Promise<ParallelPaginatedIngestResult> {
  const pageSize = options.pageSize ?? 100;
  const progressIntervalPages = options.progressIntervalPages ?? 10;
  const firstPageItems = await options.loadPage(1);
  let pages = 0;
  let items = 0;
  let lastLoggedPage = 0;

  if (firstPageItems.length === 0) {
    return { pages: 0, items: 0 };
  }

  await options.writePage(firstPageItems, 1);
  pages = 1;
  items = firstPageItems.length;
  options.logger?.info(`Loaded ${options.progressLabel} 1 (${items} items total)`);
  lastLoggedPage = 1;

  if (firstPageItems.length < pageSize) {
    return { pages, items };
  }

  let nextPage = 2;
  let stopPageExclusive = Number.POSITIVE_INFINITY;
  const workers = Array.from({ length: options.concurrency }, async () => {
    while (nextPage < stopPageExclusive) {
      const page = nextPage;
      nextPage += 1;
      if (page >= stopPageExclusive) {
        return;
      }

      const pageItems = await options.loadPage(page);
      if (pageItems.length === 0) {
        stopPageExclusive = Math.min(stopPageExclusive, page);
        return;
      }

      await options.writePage(pageItems, page);
      pages = Math.max(pages, page);
      items += pageItems.length;

      if (page % progressIntervalPages === 0 || pageItems.length < pageSize) {
        options.logger?.info(`Loaded ${options.progressLabel} ${page} (${items} items total)`);
        lastLoggedPage = Math.max(lastLoggedPage, page);
      }

      if (pageItems.length < pageSize) {
        stopPageExclusive = Math.min(stopPageExclusive, page + 1);
        return;
      }
    }
  });
  await Promise.all(workers);

  if (pages > 0 && lastLoggedPage !== pages) {
    options.logger?.info(`Loaded ${options.progressLabel} ${pages} (${items} items total)`);
  }

  return { pages, items };
}
