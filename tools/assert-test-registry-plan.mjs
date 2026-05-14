#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

const scenario = process.argv[2];
const fixture = process.argv[3];
const databasePath = process.argv[4];
const planPath = process.argv[5];

if (!scenario || !fixture || !databasePath || !planPath) {
  throw new Error("usage: node tools/assert-test-registry-plan.mjs <scenario> <single|complex> <db-path> <plan-path>");
}

const plan = JSON.parse(readFileSync(planPath, "utf8"));
assert.match(plan.packageName, new RegExp(`-test--${fixture}$`));
assert.ok(plan.scanCompletedAt, "scanCompletedAt must be populated");
assert.deepEqual(plan.collateralTags, []);

switch (scenario) {
  case "delete-untagged":
    _assertDeleteUntaggedPlan(fixture, plan);
    break;
  case "complex-tag-age-window":
    _assertComplexAgeWindowPlan(plan, databasePath, []);
    break;
  case "complex-tag-age-window-exclude-beta":
    _assertComplexAgeWindowPlan(plan, databasePath, ["beta"]);
    break;
  default:
    throw new Error(`unknown validation scenario: ${scenario}`);
}

console.error(`validated scenario '${scenario}' for fixture '${fixture}'`);

function _assertDeleteUntaggedPlan(fixture, plan) {
  assert.equal(plan.plannerInputs?.deleteUntagged, true);
  assert.deepEqual(plan.directTargetTags, []);

  if (fixture === "single") {
    assert.deepEqual(plan.directTargetRoots, []);
    assert.deepEqual(plan.closureManifests, []);
    assert.deepEqual(plan.blockedRoots, []);
    assert.deepEqual(plan.fullyDeletableRoots, []);
    return;
  }

  if (fixture === "complex") {
    assert.ok(plan.directTargetRoots.length > 0, "complex fixture must have direct target roots");
    assert.equal(plan.fullyDeletableRoots.length, 0, "complex fixture must have zero fully deletable roots");
    assert.ok(plan.blockedRoots.length > 0, "complex fixture must have blocked roots");
    assert.ok(plan.closureManifests.length >= plan.directTargetRoots.length, "complex fixture must have closure rows");

    for (const root of plan.directTargetRoots) {
      assert.equal(root.reason, "delete-untagged");
      assert.equal(root.selectionMode, "delete-root");
    }

    const directTargetDigests = new Set(plan.directTargetRoots.map((root) => root.digest));
    const closureSourceDigests = new Set(plan.closureManifests.map((manifest) => manifest.sourceDigest));
    const blockedDigests = new Set(plan.blockedRoots.map((root) => root.blockedDigest));

    assert.deepEqual(
      [...closureSourceDigests].sort(),
      [...directTargetDigests].sort(),
      "complex closure rows must cover every direct target root"
    );
    assert.deepEqual(
      [...blockedDigests].sort(),
      [...directTargetDigests].sort(),
      "complex direct target roots must all be blocked"
    );

    for (const blockedRoot of plan.blockedRoots) {
      assert.equal(blockedRoot.reason, "overlap-with-retained-root");
      assert.ok(
        directTargetDigests.has(blockedRoot.blockedDigest),
        "blocked root digest must come from the direct target set"
      );
    }
  }
}

function _assertComplexAgeWindowPlan(plan, databasePath, excludedTags) {
  assert.equal(plan.plannerInputs?.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs?.deleteTags, ["alpha", "beta", "gamma"]);
  assert.deepEqual(plan.plannerInputs?.excludeTags, excludedTags);
  assert.equal(typeof plan.plannerInputs?.olderThan, "string");
  assert.equal(typeof plan.plannerInputs?.cutoffTimestamp, "string");

  const database = new Database(databasePath, { readonly: true });
  const selectedRows = database
    .prepare(
      `
        SELECT t.tag, m.digest
        FROM tags t
        JOIN manifests m
          ON m.scan_id = t.scan_id
         AND m.version_id = t.version_id
        JOIN package_versions pv
          ON pv.scan_id = t.scan_id
         AND pv.version_id = t.version_id
        WHERE t.tag IN ('alpha', 'beta', 'gamma')
          AND pv.created_at < ?
        ORDER BY t.tag
      `
    )
    .all(plan.plannerInputs.cutoffTimestamp)
    .filter((row) => !excludedTags.includes(row.tag));
  database.close();

  const expectedTags = selectedRows.map((row) => row.tag);
  const expectedDigests = [...new Set(selectedRows.map((row) => row.digest))].sort();
  assert.deepEqual(plan.directTargetTags, expectedTags);
  assert.deepEqual(
    plan.directTargetRoots.map((root) => root.digest),
    expectedDigests
  );
  for (const root of plan.directTargetRoots) {
    assert.equal(root.reason, "delete-tags-all-tags-selected");
    assert.equal(root.selectionMode, "delete-root");
  }

  const directTargetDigests = new Set(plan.directTargetRoots.map((root) => root.digest));
  const closureSourceDigests = new Set(plan.closureManifests.map((manifest) => manifest.sourceDigest));
  const blockedDigests = new Set(plan.blockedRoots.map((root) => root.blockedDigest));

  assert.deepEqual(
    [...closureSourceDigests].sort(),
    [...directTargetDigests].sort(),
    "age-window closure rows must cover every direct target root"
  );
  assert.deepEqual(
    [...blockedDigests].sort(),
    [...directTargetDigests].sort(),
    "age-window direct target roots must all be blocked by retained roots"
  );
  assert.deepEqual(plan.fullyDeletableRoots, []);
}
