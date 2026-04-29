import assert from "node:assert/strict";
import test from "node:test";
import { ingestParallelPaginated } from "../../../src/ingest/github/_parallel-paginated-ingest.js";

test("parallel paginated ingest loads later pages concurrently", async () => {
  const loadedPages: number[] = [];
  let activeLoads = 0;
  let maxActiveLoads = 0;

  const result = await ingestParallelPaginated({
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    async loadPage(page) {
      activeLoads += 1;
      maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
      await new Promise((resolve) => setTimeout(resolve, page === 1 ? 1 : 5));
      activeLoads -= 1;

      if (page === 1) {
        return Array.from({ length: 100 }, (_, index) => index);
      }
      if (page === 2) {
        return [100];
      }
      return [];
    },
    writePage(_pageItems, page) {
      loadedPages.push(page);
    },
  });

  assert.deepEqual(result, { pages: 2, items: 101 });
  assert.deepEqual(
    loadedPages.sort((left, right) => left - right),
    [1, 2],
  );
  assert.ok(maxActiveLoads > 1);
});
