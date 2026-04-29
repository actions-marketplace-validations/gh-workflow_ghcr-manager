import assert from "node:assert/strict";
import test from "node:test";
import { handleScan } from "../../src/cli/_scan-command.js";

test("handleScan requires an owner for GitHub scans", async () => {
  await assert.rejects(
    () => handleScan(["--db", "scan.sqlite", "--log-level", "silent", "--package", "example"]),
    /missing required option: --owner/,
  );
});
