#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const scenario = process.argv[2];
const databasePath = process.argv[3];
const owner = process.argv[4];
const packageName = process.argv[5];

if (!scenario || !databasePath || !owner || !packageName) {
  throw new Error("usage: node tools/resolve-test-registry-execution.mjs <scenario> <db-path> <owner> <package-name>");
}

if (scenario === "delete-untagged") {
  process.stdout.write(
    JSON.stringify({
      args: ["--delete-untagged"]
    })
  );
  process.exit(0);
}

if (scenario !== "first-fully-deletable-tagged-root") {
  throw new Error(`unknown execution scenario: ${scenario}`);
}

const database = new Database(databasePath, { readonly: true });
const rows = database
  .prepare(
    `
      SELECT DISTINCT tag
      FROM tags
      WHERE tag NOT LIKE 'sha256-%'
      ORDER BY tag
    `
  )
  .all();
database.close();

if (rows.length === 0) {
  throw new Error("No candidate tags found in scanned fixture DB.");
}

for (const row of rows) {
  const candidateTag = row.tag;
  const plan = JSON.parse(
    execFileSync(
      "ghcr-manager",
      ["plan", "--db", databasePath, "--owner", owner, "--package", packageName, "--delete-tag", candidateTag],
      {
        encoding: "utf8"
      }
    )
  );
  if (_isExecutableTaggedDeletePlan(plan)) {
    process.stdout.write(
      JSON.stringify({
        args: ["--delete-tag", candidateTag],
        selectedTag: candidateTag
      })
    );
    process.exit(0);
  }
}

throw new Error("Could not find a fully deletable exact-match tag plan in the scanned fixture DB.");

function _isExecutableTaggedDeletePlan(plan) {
  return (
    Array.isArray(plan.fullyDeletableRoots) &&
    plan.fullyDeletableRoots.length > 0 &&
    Array.isArray(plan.rootDecisions) &&
    plan.rootDecisions.every((decision) => decision.validationStatus !== "untag-only")
  );
}
