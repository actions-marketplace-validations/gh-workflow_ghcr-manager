import assert from "node:assert/strict";
import test from "node:test";
import type { ScanWriter } from "../../../src/db/index.js";
import { ingestPackageVersions } from "../../../src/ingest/github/_packages-client.js";

test("package client writes package versions and tags with bounded parallel page fetches", async () => {
  const insertedVersionIds: number[] = [];
  const insertedTags: string[] = [];
  const insertedPayloadVersionIds: number[] = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;

  const writer = {
    insertPackageVersion(version: { versionId: number }) {
      insertedVersionIds.push(version.versionId);
    },
    insertPackageVersionPayload(versionId: number) {
      insertedPayloadVersionIds.push(versionId);
    },
    insertTag(tag: { tag: string }) {
      insertedTags.push(tag.tag);
    }
  } as unknown as ScanWriter;

  const counts = await ingestPackageVersions(
    async (input) => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      const page = Number(new URL(input).searchParams.get("page"));
      await new Promise((resolve) => setTimeout(resolve, page === 1 ? 1 : 5));
      activeRequests -= 1;

      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          if (page === 1) {
            return Array.from({ length: 100 }, (_, index) => ({
              id: index + 1,
              name: `sha256:${index + 1}`,
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
              metadata: { container: { tags: [`tag-${index + 1}`] } }
            }));
          }
          if (page === 2) {
            return [
              {
                id: 101,
                name: "sha256:101",
                created_at: "2026-04-01T00:00:00.000Z",
                updated_at: "2026-04-01T00:00:00.000Z",
                metadata: { container: { tags: ["tag-101"] } }
              }
            ];
          }
          return [];
        }
      };
    },
    "https://api.github.test",
    {
      owner: "acme",
      packageName: "example",
      token: "token",
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    },
    writer
  );

  assert.deepEqual(counts, { packageVersions: 101, tags: 101 });
  assert.equal(insertedVersionIds.length, 101);
  assert.equal(insertedPayloadVersionIds.length, 101);
  assert.equal(insertedTags.length, 101);
  assert.ok(maxActiveRequests > 1);
});

test("package client surfaces GitHub error details", async () => {
  const writer = {
    insertPackageVersion() {},
    insertPackageVersionPayload() {},
    insertTag() {}
  } as unknown as ScanWriter;

  await assert.rejects(
    () =>
      ingestPackageVersions(
        async () => ({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          async json() {
            return {
              message: "Requires authentication",
              documentation_url: "https://docs.github.com/rest/packages/packages"
            };
          }
        }),
        "https://api.github.test",
        {
          owner: "acme",
          packageName: "example",
          token: "token",
          logger: { debug() {}, info() {}, warn() {}, error() {} }
        },
        writer
      ),
    /GitHub Packages request failed - status 401 - Requires authentication - https:\/\/docs\.github\.com\/rest\/packages\/packages/
  );
});

test("package client aborts when page 1 changes during the scan", async () => {
  const writer = {
    insertPackageVersion() {},
    insertPackageVersionPayload() {},
    insertTag() {}
  } as unknown as ScanWriter;

  let firstPageLoadCount = 0;

  await assert.rejects(
    () =>
      ingestPackageVersions(
        async (input) => {
          const page = Number(new URL(input).searchParams.get("page"));
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            async json() {
              if (page === 1) {
                firstPageLoadCount += 1;
                return [
                  {
                    id: firstPageLoadCount === 1 ? 1 : 2,
                    name: "sha256:index",
                    created_at: "2026-04-01T00:00:00.000Z",
                    updated_at: "2026-04-01T00:00:00.000Z",
                    metadata: { container: { tags: ["latest"] } }
                  }
                ];
              }
              return [];
            }
          };
        },
        "https://api.github.test",
        {
          owner: "acme",
          packageName: "example",
          token: "token",
          logger: { debug() {}, info() {}, warn() {}, error() {} }
        },
        writer
      ),
    /GitHub package-version page 1 changed while scanning acme\/example; aborting scan/
  );
});

test("package client surfaces fetch transport failures with page context", async () => {
  const writer = {
    insertPackageVersion() {},
    insertPackageVersionPayload() {},
    insertTag() {}
  } as unknown as ScanWriter;

  await assert.rejects(
    () =>
      ingestPackageVersions(
        async () => {
          throw new TypeError("fetch failed");
        },
        "https://api.github.test",
        {
          owner: "acme",
          packageName: "example",
          token: "token",
          logger: { debug() {}, info() {}, warn() {}, error() {} }
        },
        writer
      ),
    /GitHub Packages request for page 1 failed - fetch failed/
  );
});
