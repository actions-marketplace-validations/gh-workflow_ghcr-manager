import assert from "node:assert/strict";
import test from "node:test";
import { ghcrRegistryBaseUrl, githubApiBaseUrl, githubApiVersion } from "../../src/config/index.js";

test("service constants expose the fixed GitHub and GHCR endpoints", () => {
  assert.equal(githubApiBaseUrl, "https://api.github.com");
  assert.equal(githubApiVersion, "2022-11-28");
  assert.equal(ghcrRegistryBaseUrl, "https://ghcr.io");
});
