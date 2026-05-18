import assert from "node:assert/strict";
import test from "node:test";
import { resolveGitHubActionsRunUrl } from "../../src/db/_github-actions-run-url.js";

test("resolveGitHubActionsRunUrl returns a run URL when the required GitHub env vars are present", () => {
  assert.equal(
    resolveGitHubActionsRunUrl({
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "acme/example",
      GITHUB_RUN_ID: "123456"
    }),
    "https://github.com/acme/example/actions/runs/123456"
  );
});

test("resolveGitHubActionsRunUrl returns null when any required GitHub env var is missing", () => {
  assert.equal(
    resolveGitHubActionsRunUrl({
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "acme/example"
    }),
    null
  );
});
