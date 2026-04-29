import assert from "node:assert/strict";
import test from "node:test";
import { manifestFetchConcurrency, packageVersionPageFetchConcurrency } from "../../src/tuning/index.js";

test("tuning exports ingest concurrency constants", () => {
  assert.equal(packageVersionPageFetchConcurrency, 4);
  assert.equal(manifestFetchConcurrency, 16);
});
