import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handlePlan } from "../../src/cli/_plan-command.js";
import { openDatabase, ScanWriter } from "../../src/db/index.js";
import { importFileScan } from "../helpers/index.js";

test("handlePlan requires the delete-untagged selector", async () => {
  await assert.rejects(
    () => handlePlan(["--db", "scan.sqlite", "--owner", "acme", "--package", "example"]),
    /missing required cleanup selector: --delete-untagged/
  );
});

test("handlePlan prints a delete-untagged plan for the selected package", async () => {
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
      await handlePlan(["--db", databasePath, "--owner", "acme", "--package", "example", "--delete-untagged"]),
      0
    );
  } finally {
    console.log = originalLog;
    rmSync(tempDirectory, { recursive: true, force: true });
  }

  assert.equal(writes.length, 1);
  const plan = JSON.parse(writes[0] as string) as {
    plannerInputs: { deleteUntagged: boolean };
    fullyDeletableRoots: Array<{ digest: string }>;
  };
  assert.equal(plan.plannerInputs.deleteUntagged, true);
  assert.equal(plan.fullyDeletableRoots.length, 1);
  assert.equal(plan.fullyDeletableRoots[0]?.digest, "sha256:untagged-old");
});
