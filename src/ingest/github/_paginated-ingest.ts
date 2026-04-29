import type { GitHubScanLogger } from "./_shared.js";
import { paginatedIngestProgressIntervalPages } from "../../tuning/index.js";

const _DEFAULT_PAGE_SIZE = 100;
const _PROGRESS_LABEL = "GitHub package-version pages";

export interface PaginatedIngestOptions<T> {
  loadPage(page: number): Promise<T[]>;
  writePage(pageItems: T[], page: number): Promise<void> | void;
  logger: GitHubScanLogger;
}

export interface PaginatedIngestResult {
  pages: number;
  items: number;
}

export async function ingestPaginated<T>(options: PaginatedIngestOptions<T>): Promise<PaginatedIngestResult> {
  let pages = 0;
  let items = 0;
  let lastLoggedPage = 0;

  for (let page = 1; ; page += 1) {
    const pageItems = await options.loadPage(page);
    if (pageItems.length === 0) {
      break;
    }

    await options.writePage(pageItems, page);
    pages = page;
    items += pageItems.length;

    if (page === 1 || page % paginatedIngestProgressIntervalPages === 0 || pageItems.length < _DEFAULT_PAGE_SIZE) {
      options.logger.info(`Loaded ${_PROGRESS_LABEL} ${page} (${items} items total)`);
      lastLoggedPage = page;
    }

    if (pageItems.length < _DEFAULT_PAGE_SIZE) {
      break;
    }
  }

  if (pages > 0 && lastLoggedPage !== pages) {
    options.logger.info(`Loaded ${_PROGRESS_LABEL} ${pages} (${items} items total)`);
  }

  return { pages, items };
}
