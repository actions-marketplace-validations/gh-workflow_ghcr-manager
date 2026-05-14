#!/usr/bin/env node

import assert from "node:assert/strict";
import { loadAgeWindowSelectedRows, loadCombinedTaggedRows } from "./_test-registry-plan-db.mjs";

export function assertDeleteUntaggedPlan(fixture, plan) {
  assert.equal(plan.plannerInputs?.deleteUntagged, true);
  assert.deepEqual(plan.directTargetTags, []);

  if (fixture === "single") {
    assert.deepEqual(plan.directTargetRoots, []);
    assert.deepEqual(plan.closureManifests, []);
    assert.deepEqual(plan.blockedRoots, []);
    assert.deepEqual(plan.fullyDeletableRoots, []);
    assert.deepEqual(plan.rootDecisions, []);
    assert.deepEqual(plan.protectedRoots, []);
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
    assert.equal(plan.validationSummary.blockedDeleteRootCount, plan.directTargetRoots.length);
    assert.ok(plan.protectedRoots.length > 0, "complex fixture must report protected roots");

    for (const blockedRoot of plan.blockedRoots) {
      assert.equal(blockedRoot.reason, "overlap-with-retained-root");
      assert.ok(
        directTargetDigests.has(blockedRoot.blockedDigest),
        "blocked root digest must come from the direct target set"
      );
    }
  }
}

export function assertComplexAgeWindowPlan(plan, databasePath, excludedTags) {
  assert.equal(plan.plannerInputs?.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs?.deleteTags, ["alpha", "beta", "gamma"]);
  assert.deepEqual(plan.plannerInputs?.excludeTags, excludedTags);
  assert.equal(typeof plan.plannerInputs?.olderThan, "string");
  assert.equal(typeof plan.plannerInputs?.cutoffTimestamp, "string");

  const selectedRows = loadAgeWindowSelectedRows(databasePath, plan.plannerInputs.cutoffTimestamp, excludedTags);
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
  assert.ok(plan.protectedRoots.length > 0, "age-window scenario must expose protected roots");
  assert.deepEqual(plan.fullyDeletableRoots, []);
}

export function assertCombinedTaggedKeepPlan(plan, databasePath, options) {
  assert.equal(plan.plannerInputs?.deleteUntagged, false);
  assert.deepEqual(plan.plannerInputs?.deleteTags, options.deleteTags);
  assert.deepEqual(plan.plannerInputs?.excludeTags, options.excludeTags);
  assert.equal(plan.plannerInputs?.keepNTagged, options.keepNTagged);
  if (options.requireOlderThan) {
    assert.equal(typeof plan.plannerInputs?.olderThan, "string");
    assert.equal(typeof plan.plannerInputs?.cutoffTimestamp, "string");
  } else {
    assert.equal(plan.plannerInputs?.olderThan, undefined);
    assert.equal(plan.plannerInputs?.cutoffTimestamp, undefined);
  }

  const rows = loadCombinedTaggedRows(databasePath, plan.plannerInputs?.cutoffTimestamp);
  const rootsByVersionId = new Map();
  for (const row of rows) {
    let root = rootsByVersionId.get(row.version_id);
    if (!root) {
      root = {
        versionId: row.version_id,
        digest: row.digest,
        manifestKind: row.manifest_kind,
        createdAt: row.created_at,
        tags: []
      };
      rootsByVersionId.set(row.version_id, root);
    }
    root.tags.push(row.tag);
  }

  const eligibleRoots = [...rootsByVersionId.values()]
    .filter((root) => root.tags.some((tag) => options.deleteTags.includes(tag)))
    .filter((root) => !root.tags.some((tag) => options.excludeTags.includes(tag)));

  const expectedDirectTargetTags = eligibleRoots.flatMap((root) =>
    root.tags.filter((tag) => options.deleteTags.includes(tag))
  );
  expectedDirectTargetTags.sort();
  assert.deepEqual([...plan.directTargetTags].sort(), expectedDirectTargetTags);

  const rankedRoots = [...eligibleRoots].sort((left, right) => {
    const createdAtCompare = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }
    const versionIdCompare = right.versionId - left.versionId;
    if (versionIdCompare !== 0) {
      return versionIdCompare;
    }
    return right.digest.localeCompare(left.digest);
  });
  const selectedRoots = rankedRoots
    .slice(options.keepNTagged)
    .sort((left, right) => left.digest.localeCompare(right.digest));
  const expectedDirectTargetRoots = selectedRoots.map((root) => {
    const matchedTagCount = root.tags.filter((tag) => options.deleteTags.includes(tag)).length;
    const isFullMatch = matchedTagCount === root.tags.length;
    return {
      digest: root.digest,
      reason: isFullMatch ? "keep-n-tagged-overflow" : "delete-tags-partial-tag-match",
      selectionMode: isFullMatch ? "delete-root" : "untag-only"
    };
  });
  assert.deepEqual(
    plan.directTargetRoots.map((root) => ({
      digest: root.digest,
      reason: root.reason,
      selectionMode: root.selectionMode
    })),
    expectedDirectTargetRoots
  );

  const deleteRootDigests = new Set(
    expectedDirectTargetRoots.filter((root) => root.selectionMode === "delete-root").map((root) => root.digest)
  );
  if (deleteRootDigests.size === 0) {
    assert.deepEqual(plan.closureManifests, []);
    assert.deepEqual(plan.blockedRoots, []);
    assert.deepEqual(plan.fullyDeletableRoots, []);
    return;
  }

  const closureSourceDigests = new Set(plan.closureManifests.map((manifest) => manifest.sourceDigest));
  for (const digest of closureSourceDigests) {
    assert.ok(deleteRootDigests.has(digest), "closure source digest must come from the delete-root set");
  }
  const blockedDigests = new Set(plan.blockedRoots.map((root) => root.blockedDigest));
  for (const digest of blockedDigests) {
    assert.ok(deleteRootDigests.has(digest), "blocked digest must come from the delete-root set");
  }
  for (const root of plan.fullyDeletableRoots) {
    assert.ok(deleteRootDigests.has(root.digest), "fully deletable root must come from the delete-root set");
  }
  assert.equal(plan.validationSummary.fullyDeletableRootCount, plan.fullyDeletableRoots.length);
}
