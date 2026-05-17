import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleCleanup } from "../../src/cli/_cleanup-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../helpers/index.js";

test("handleCleanup dry-run does not require a token", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);
  database.close();

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handleCleanup([
        "--db",
        databasePath,
        "--owner",
        "acme",
        "--package",
        "example",
        "--dry-run",
        "--delete-untagged"
      ]),
      0
    );
  } finally {
    console.log = originalLog;
  }

  const plan = JSON.parse(writes[0] as string) as { plannerInputs: { deleteUntagged: boolean } };
  assert.equal(plan.plannerInputs.deleteUntagged, true);

  const persistedDatabase = openDatabase(databasePath);
  const cleanupRun = persistedDatabase
    .prepare(
      `
        SELECT dry_run, direct_target_root_count
        FROM cleanup_runs
        ORDER BY cleanup_run_id DESC
        LIMIT 1
      `
    )
    .get() as {
    dry_run: number;
    direct_target_root_count: number;
  };
  assert.equal(cleanupRun.dry_run, 1);
  assert.equal(cleanupRun.direct_target_root_count, 1);
  persistedDatabase.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});

test("handleCleanup live mode requires a token", async () => {
  await assert.rejects(
    () => handleCleanup(["--db", "scan.sqlite", "--owner", "acme", "--package", "example", "--delete-untagged"]),
    /missing required option: --token/
  );
});

test("handleCleanup live mode persists a cleanup run before execution", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ghcr-manager-"));
  const databasePath = join(tempDirectory, "scan.sqlite");
  const database = openDatabase(databasePath);
  const writer = new ScanWriter(database);
  await importFileScan("tests/fixtures/sample-package.json", writer);
  database.close();

  const originalLog = console.log;
  const writes: string[] = [];
  console.log = (message?: unknown) => {
    writes.push(String(message));
  };

  try {
    assert.equal(
      await handleCleanup([
        "--db",
        databasePath,
        "--owner",
        "acme",
        "--package",
        "example",
        "--token",
        "token",
        "--keep-n-tagged",
        "2"
      ]),
      0
    );
  } finally {
    console.log = originalLog;
  }

  const summary = JSON.parse(writes[0] as string) as { deletedPackageVersions: unknown[]; untaggedTags: unknown[] };
  assert.deepEqual(summary.deletedPackageVersions, []);
  assert.deepEqual(summary.untaggedTags, []);

  const persistedDatabase = openDatabase(databasePath);
  const cleanupRun = persistedDatabase
    .prepare(
      `
        SELECT dry_run, direct_target_root_count
        FROM cleanup_runs
        ORDER BY cleanup_run_id DESC
        LIMIT 1
      `
    )
    .get() as {
    dry_run: number;
    direct_target_root_count: number;
  };
  assert.equal(cleanupRun.dry_run, 0);
  assert.equal(cleanupRun.direct_target_root_count, 0);
  persistedDatabase.close();
  rmSync(tempDirectory, { recursive: true, force: true });
});
