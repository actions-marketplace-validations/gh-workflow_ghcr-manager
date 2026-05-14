#!/usr/bin/env node

import assert from "node:assert/strict";

export function assertValidationContract(plan) {
  assert.ok(plan.validationSummary, "validationSummary must be present");
  assert.ok(Array.isArray(plan.rootDecisions), "rootDecisions must be present");
  assert.ok(Array.isArray(plan.protectedRoots), "protectedRoots must be present");

  assert.equal(plan.validationSummary.directTargetTagCount, plan.directTargetTags.length);
  assert.equal(plan.validationSummary.directTargetRootCount, plan.directTargetRoots.length);
  assert.equal(plan.validationSummary.fullyDeletableRootCount, plan.fullyDeletableRoots.length);
  assert.equal(plan.validationSummary.protectedRootCount, plan.protectedRoots.length);

  const deleteRootCandidateCount = plan.directTargetRoots.filter((root) => root.selectionMode === "delete-root").length;
  const untagOnlyRootCount = plan.directTargetRoots.filter((root) => root.selectionMode === "untag-only").length;
  assert.equal(plan.validationSummary.deleteRootCandidateCount, deleteRootCandidateCount);
  assert.equal(plan.validationSummary.untagOnlyRootCount, untagOnlyRootCount);

  assert.equal(plan.rootDecisions.length, plan.directTargetRoots.length);
  const directTargetDigestSet = new Set(plan.directTargetRoots.map((root) => root.digest));
  const fullyDeletableDigestSet = new Set(plan.fullyDeletableRoots.map((root) => root.digest));
  const blockedDigestSet = new Set(plan.blockedRoots.map((root) => root.blockedDigest));

  let blockedDecisionCount = 0;
  for (const decision of plan.rootDecisions) {
    assert.ok(directTargetDigestSet.has(decision.digest), "rootDecisions must only reference direct target roots");
    if (decision.validationStatus === "fully-deletable") {
      assert.ok(
        fullyDeletableDigestSet.has(decision.digest),
        "fully-deletable root decisions must correspond to fully deletable roots"
      );
    }
    if (decision.validationStatus === "blocked") {
      blockedDecisionCount += 1;
      assert.ok(blockedDigestSet.has(decision.digest), "blocked root decisions must correspond to blocked roots");
    }
    if (decision.validationStatus === "untag-only") {
      assert.equal(decision.selectionMode, "untag-only");
    }
  }
  assert.equal(plan.validationSummary.blockedDeleteRootCount, blockedDecisionCount);

  for (const protectedRoot of plan.protectedRoots) {
    assert.ok(Array.isArray(protectedRoot.blocks));
    assert.ok(protectedRoot.blocks.length > 0, "protected roots must explain at least one blocked root");
    for (const block of protectedRoot.blocks) {
      assert.ok(
        blockedDigestSet.has(block.blockedDigest),
        "protected root block entries must correspond to blocked root digests"
      );
    }
  }
}
