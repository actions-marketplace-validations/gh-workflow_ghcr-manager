import assert from "node:assert/strict";
import test from "node:test";
import { loadPackageVersionPage } from "../../../src/ingest/github/_package-version-page-load.js";

test("package version page loader requests the expected page", async () => {
  let seenUrl = "";

  const items = await loadPackageVersionPage(
    async (input, init) => {
      seenUrl = input;
      assert.equal((init?.headers as Record<string, string>)["X-GitHub-Api-Version"], "2022-11-28");
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return [
            {
              id: 7,
              name: "sha256:x",
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
              metadata: { container: { tags: ["latest"] } },
            },
          ];
        },
      };
    },
    "https://api.github.test",
    {
      owner: "acme",
      packageName: "example",
      token: "token",
      logger: { debug() {}, info() {}, warn() {}, error() {} },
    },
    3,
  );

  assert.equal(seenUrl, "https://api.github.test/orgs/acme/packages/container/example/versions?per_page=100&page=3");
  assert.equal(items[0]?.id, 7);
});

test("package version page loader surfaces fetch transport failures with page context", async () => {
  await assert.rejects(
    () =>
      loadPackageVersionPage(
        async () => {
          throw new TypeError("fetch failed");
        },
        "https://api.github.test",
        {
          owner: "acme",
          packageName: "example",
          token: "token",
          logger: { debug() {}, info() {}, warn() {}, error() {} },
        },
        9,
      ),
    /GitHub Packages request for page 9 failed - fetch failed/,
  );
});
