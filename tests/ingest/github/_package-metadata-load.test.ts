import assert from "node:assert/strict";
import test from "node:test";
import { loadPackageMetadata } from "../../../src/ingest/github/_package-metadata-load.js";

test("package metadata loader returns whether the package is public", async () => {
  const metadata = await loadPackageMetadata(
    async (input) => {
      assert.equal(input, "https://api.github.test/orgs/acme/packages/container/example");
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return {
            visibility: "internal"
          };
        }
      };
    },
    "https://api.github.test",
    {
      owner: "acme",
      packageName: "example",
      token: "token",
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    }
  );

  assert.deepEqual(metadata, { isPublic: false });
});

test("package metadata loader rejects unsupported visibility values", async () => {
  await assert.rejects(
    () =>
      loadPackageMetadata(
        async () => ({
          ok: true,
          status: 200,
          headers: new Headers(),
          async json() {
            return {
              visibility: "secret"
            };
          }
        }),
        "https://api.github.test",
        {
          owner: "acme",
          packageName: "example",
          token: "token",
          logger: { debug() {}, info() {}, warn() {}, error() {} }
        }
      ),
    /GitHub package metadata response did not include a supported visibility value/
  );
});
