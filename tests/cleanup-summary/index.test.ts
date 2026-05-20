import assert from "node:assert/strict";
import test from "node:test";
import { buildCleanupSummary, renderCleanupSummaryMarkdown } from "../../src/cleanup-summary/index.js";

test("cleanup-summary index exports summary builders", () => {
  assert.equal(typeof buildCleanupSummary, "function");
  assert.equal(typeof renderCleanupSummaryMarkdown, "function");
});
