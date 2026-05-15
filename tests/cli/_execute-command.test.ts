import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleExecute } from "../../src/cli/_execute-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../helpers/index.js";

test("handleExecute requires a token", async () => {
  await assert.rejects(
    () => handleExecute(["--db", "scan.sqlite", "--owner", "acme", "--package", "example", "--delete-untagged"]),
    /missing required option: --token/
  );
});

test("handleExecute deletes fully deletable roots and prints a summary", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);
  database.close();

  const fetchCalls: Array<{ url: string; method?: string }> = [];
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const writes: string[] = [];
  globalThis.fetch = async (input, init) => {
    fetchCalls.push({ url: String(input), method: init?.method });
    return {
      ok: true,
      status: 204,
      headers: new Headers(),
      async json() {
        return {};
      }
    } as Response;
  };
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handleExecute([
        "--db",
        databasePath,
        "--owner",
        "acme",
        "--package",
        "example",
        "--token",
        "token",
        "--delete-untagged"
      ]),
      0
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  assert.deepEqual(fetchCalls, [
    {
      url: "https://api.github.com/orgs/acme/packages/container/example/versions/104",
      method: "DELETE"
    }
  ]);
  const summary = JSON.parse(writes[0] as string) as {
    deletedPackageVersions: Array<{ versionId: number; digest: string }>;
    unsupportedUntagRoots: Array<unknown>;
  };
  assert.deepEqual(summary.deletedPackageVersions, [{ versionId: 104, digest: "sha256:untagged-old" }]);
  assert.deepEqual(summary.unsupportedUntagRoots, []);
});

test("handleExecute aborts before mutation when the plan contains untag-only roots", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  writer.resetScan("acme", "example", "2026-05-15T00:00:00.000Z");
  writer.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 101,
    digest: "sha256:index-shared",
    manifestKind: "image_manifest",
    mediaType: "application/vnd.oci.image.manifest.v1+json"
  });
  writer.insertTag({
    tag: "latest",
    versionId: 101
  });
  writer.insertTag({
    tag: "keep-me",
    versionId: 101
  });
  writer.markScanCompleted("2026-05-15T00:00:00.000Z");
  database.close();

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  globalThis.fetch = async () => {
    fetchCallCount += 1;
    return {
      ok: true,
      status: 204,
      headers: new Headers(),
      async json() {
        return {};
      }
    } as Response;
  };

  try {
    await assert.rejects(
      () =>
        handleExecute([
          "--db",
          databasePath,
          "--owner",
          "acme",
          "--package",
          "example",
          "--token",
          "token",
          "--delete-tag",
          "latest"
        ]),
      /execution does not yet support untag-only roots: sha256:index-shared/
    );
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  assert.equal(fetchCallCount, 0);
});
