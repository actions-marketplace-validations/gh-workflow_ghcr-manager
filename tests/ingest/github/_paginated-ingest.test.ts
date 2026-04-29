import assert from "node:assert/strict";
import test from "node:test";
import { ingestPaginated } from "../../../src/ingest/github/_paginated-ingest.js";

test("paginated ingest writes each page and reports progress", async () => {
  const writtenPages: number[] = [];
  const writtenItems: number[] = [];
  const progressMessages: string[] = [];

  const result = await ingestPaginated<number>({
    logger: {
      debug() {},
      info(message) {
        progressMessages.push(message);
      },
      warn() {},
      error() {},
    },
    async loadPage(page) {
      if (page === 1) {
        return Array.from({ length: 100 }, (_, index) => index + 1);
      }
      if (page === 2) {
        return [101];
      }
      return [];
    },
    writePage(pageItems, page) {
      writtenPages.push(page);
      writtenItems.push(...pageItems);
    },
  });

  assert.deepEqual(writtenPages, [1, 2]);
  assert.equal(writtenItems.length, 101);
  assert.deepEqual(progressMessages, [
    "Loaded GitHub package-version pages 1 (100 items total)",
    "Loaded GitHub package-version pages 2 (101 items total)",
  ]);
  assert.deepEqual(result, { pages: 2, items: 101 });
});
