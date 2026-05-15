import assert from "node:assert/strict";
import test from "node:test";
import type { DeletePlan } from "../../src/db/index.js";
import { executeDeletePlan } from "../../src/execute/index.js";

test("executeDeletePlan deletes fully deletable roots and returns a summary", async () => {
  const deletedVersionIds: number[] = [];
  const plan: DeletePlan = {
    owner: "acme",
    packageName: "example",
    scanCompletedAt: "2026-05-15T00:00:00.000Z",
    plannerInputs: {
      deleteUntagged: true,
      deleteTags: [],
      excludeTags: []
    },
    validationSummary: {
      directTargetTagCount: 0,
      directTargetRootCount: 1,
      deleteRootCandidateCount: 1,
      untagOnlyRootCount: 0,
      fullyDeletableRootCount: 1,
      blockedDeleteRootCount: 0,
      protectedRootCount: 0
    },
    directTargetTags: [],
    directTargetRoots: [
      {
        versionId: 104,
        digest: "sha256:untagged-old",
        reason: "delete-untagged",
        selectionMode: "delete-root"
      }
    ],
    rootDecisions: [
      {
        versionId: 104,
        digest: "sha256:untagged-old",
        selectionMode: "delete-root",
        selectionReason: "delete-untagged",
        validationStatus: "fully-deletable",
        validationReason: "root closure does not overlap any retained root"
      }
    ],
    protectedRoots: [],
    closureManifests: [],
    blockedRoots: [],
    fullyDeletableRoots: [
      {
        versionId: 104,
        digest: "sha256:untagged-old",
        reason: "delete-untagged",
        selectionMode: "delete-root"
      }
    ],
    collateralTags: []
  };

  const summary = await executeDeletePlan(plan, {
    token: "token",
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    githubApiBaseUrl: "https://api.github.test",
    fetchImpl: async (input) => {
      deletedVersionIds.push(Number(String(input).split("/").pop()));
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        async json() {
          return {};
        }
      };
    }
  });

  assert.deepEqual(deletedVersionIds, [104]);
  assert.deepEqual(summary.deletedPackageVersions, [{ versionId: 104, digest: "sha256:untagged-old" }]);
});

test("executeDeletePlan rejects untag-only roots before mutating", async () => {
  const plan: DeletePlan = {
    owner: "acme",
    packageName: "example",
    scanCompletedAt: "2026-05-15T00:00:00.000Z",
    plannerInputs: {
      deleteUntagged: false,
      deleteTags: ["latest"],
      excludeTags: []
    },
    validationSummary: {
      directTargetTagCount: 1,
      directTargetRootCount: 1,
      deleteRootCandidateCount: 0,
      untagOnlyRootCount: 1,
      fullyDeletableRootCount: 0,
      blockedDeleteRootCount: 0,
      protectedRootCount: 0
    },
    directTargetTags: ["latest"],
    directTargetRoots: [
      {
        versionId: 101,
        digest: "sha256:index-current",
        reason: "delete-tags-partial-tag-match",
        selectionMode: "untag-only"
      }
    ],
    rootDecisions: [
      {
        versionId: 101,
        digest: "sha256:index-current",
        selectionMode: "untag-only",
        selectionReason: "delete-tags-partial-tag-match",
        validationStatus: "untag-only",
        validationReason: "selected tags do not cover every tag on the root"
      }
    ],
    protectedRoots: [],
    closureManifests: [],
    blockedRoots: [],
    fullyDeletableRoots: [],
    collateralTags: []
  };

  let mutated = false;
  await assert.rejects(
    () =>
      executeDeletePlan(plan, {
        token: "token",
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {}
        },
        githubApiBaseUrl: "https://api.github.test",
        fetchImpl: async () => {
          mutated = true;
          return {
            ok: true,
            status: 204,
            headers: new Headers(),
            async json() {
              return {};
            }
          };
        }
      }),
    /execution does not yet support untag-only roots: sha256:index-current/
  );
  assert.equal(mutated, false);
});
