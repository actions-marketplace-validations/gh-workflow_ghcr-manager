import assert from "node:assert/strict";
import test from "node:test";
import {
  ghcrRegistryBaseUrl,
  githubApiBaseUrl,
  manifestFetchConcurrency,
  packageVersionPageFetchConcurrency
} from "../../src/config/index.js";

test("config exports ingest concurrency constants and fixed service URLs", () => {
  assert.equal(typeof packageVersionPageFetchConcurrency, "number");
  assert.ok(packageVersionPageFetchConcurrency >= 1);
  assert.equal(typeof manifestFetchConcurrency, "number");
  assert.ok(manifestFetchConcurrency >= 1);
  assert.equal(githubApiBaseUrl, "https://api.github.com");
  assert.equal(ghcrRegistryBaseUrl, "https://ghcr.io");
});
