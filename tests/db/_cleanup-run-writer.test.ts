import assert from "node:assert/strict";
import test from "node:test";
import { CleanupRunWriter, ScanWriter, openDatabase } from "../../src/db/index.js";
import type { DeletePlan } from "../../src/db/index.js";

test("cleanup run writer stores planner decisions and protected roots", () => {
  const database = openDatabase(":memory:");
  const scanWriter = new ScanWriter(database);
  const cleanupRunWriter = new CleanupRunWriter(database);

  scanWriter.resetScan("acme", "example", "2026-05-17T09:00:00.000Z");
  scanWriter.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-17T08:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z"
  });
  scanWriter.insertPackageVersion({
    versionId: 102,
    createdAt: "2026-05-17T08:05:00.000Z",
    updatedAt: "2026-05-17T08:05:00.000Z"
  });
  scanWriter.markScanCompleted("2026-05-17T09:00:00.000Z");
  const scanId = scanWriter.getActiveScanId();

  const plan: DeletePlan = {
    owner: "acme",
    packageName: "example",
    scanCompletedAt: "2026-05-17T09:00:00.000Z",
    plannerInputs: {
      deleteUntagged: false,
      deleteTags: ["delete-me"],
      excludeTags: ["keep-me"]
    },
    validationSummary: {
      directTargetTagCount: 1,
      directTargetRootCount: 1,
      deleteRootCandidateCount: 1,
      untagOnlyRootCount: 0,
      fullyDeletableRootCount: 0,
      blockedDeleteRootCount: 1,
      protectedRootCount: 1
    },
    directTargetTags: ["delete-me"],
    directTargetRoots: [
      {
        versionId: 101,
        digest: "sha256:delete-root",
        manifestKind: "image_manifest",
        reason: "delete-tags-exact-tag-match",
        selectionMode: "delete-root"
      }
    ],
    rootDecisions: [
      {
        versionId: 101,
        digest: "sha256:delete-root",
        manifestKind: "image_manifest",
        selectionMode: "delete-root",
        selectionReason: "delete-tags-exact-tag-match",
        validationStatus: "blocked",
        validationReason: "blocked because retained root sha256:keep-root still requires shared manifest sha256:shared",
        blockingVersionId: 102,
        blockingDigest: "sha256:keep-root",
        overlapDigest: "sha256:shared",
        overlapManifestKind: "image_manifest"
      }
    ],
    protectedRoots: [
      {
        versionId: 102,
        digest: "sha256:keep-root",
        reason: "retained root still requires shared manifest members",
        blocks: [
          {
            blockedVersionId: 101,
            blockedDigest: "sha256:delete-root",
            overlapDigest: "sha256:shared",
            overlapManifestKind: "image_manifest"
          }
        ]
      }
    ],
    closureManifests: [],
    blockedRoots: [],
    fullyDeletableRoots: [],
    collateralTags: []
  };

  const cleanupRunId = cleanupRunWriter.persistCleanupRun(scanId, plan, {
    dryRun: true,
    cleanupStartedAt: "2026-05-17T09:01:00.000Z"
  });

  const cleanupRun = database
    .prepare(
      `
        SELECT scan_id, cleanup_started_at, dry_run, planner_inputs_json, protected_root_count
        FROM cleanup_runs
        WHERE cleanup_run_id = ?
      `
    )
    .get(cleanupRunId) as {
    scan_id: number;
    cleanup_started_at: string;
    dry_run: number;
    planner_inputs_json: string;
    protected_root_count: number;
  };

  assert.equal(cleanupRun.scan_id, scanId);
  assert.equal(cleanupRun.cleanup_started_at, "2026-05-17T09:01:00.000Z");
  assert.equal(cleanupRun.dry_run, 1);
  assert.deepEqual(JSON.parse(cleanupRun.planner_inputs_json), plan.plannerInputs);
  assert.equal(cleanupRun.protected_root_count, 1);

  const rootDecision = database
    .prepare(
      `
        SELECT digest, validation_status, blocking_version_id, overlap_digest
        FROM cleanup_root_decisions
        WHERE cleanup_run_id = ?
          AND version_id = 101
      `
    )
    .get(cleanupRunId) as {
    digest: string;
    validation_status: string;
    blocking_version_id: number;
    overlap_digest: string;
  };
  assert.equal(rootDecision.digest, "sha256:delete-root");
  assert.equal(rootDecision.validation_status, "blocked");
  assert.equal(rootDecision.blocking_version_id, 102);
  assert.equal(rootDecision.overlap_digest, "sha256:shared");

  const protectedRoot = database
    .prepare(
      `
        SELECT digest, reason, blocks_json
        FROM cleanup_protected_roots
        WHERE cleanup_run_id = ?
          AND version_id = 102
      `
    )
    .get(cleanupRunId) as {
    digest: string;
    reason: string;
    blocks_json: string;
  };
  assert.equal(protectedRoot.digest, "sha256:keep-root");
  assert.equal(protectedRoot.reason, "retained root still requires shared manifest members");
  assert.deepEqual(JSON.parse(protectedRoot.blocks_json), plan.protectedRoots[0]?.blocks);

  database.close();
});

test("cleanup audit rows must use the same scan as their cleanup run", () => {
  const database = openDatabase(":memory:");
  const scanWriter = new ScanWriter(database);

  scanWriter.resetScan("acme", "example", "2026-05-17T09:00:00.000Z");
  scanWriter.insertPackageVersion({
    versionId: 101,
    createdAt: "2026-05-17T08:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z"
  });
  scanWriter.markScanCompleted("2026-05-17T09:00:00.000Z");
  const firstScanId = scanWriter.getActiveScanId();

  scanWriter.resetScan("acme", "example", "2026-05-17T10:00:00.000Z");
  scanWriter.insertPackageVersion({
    versionId: 201,
    createdAt: "2026-05-17T09:30:00.000Z",
    updatedAt: "2026-05-17T09:30:00.000Z"
  });
  scanWriter.markScanCompleted("2026-05-17T10:00:00.000Z");
  const secondScanId = scanWriter.getActiveScanId();

  const cleanupRunId = Number(
    database
      .prepare(
        `
          INSERT INTO cleanup_runs(
            scan_id,
            cleanup_started_at,
            dry_run,
            planner_inputs_json,
            direct_target_tag_count,
            direct_target_root_count,
            delete_root_candidate_count,
            untag_only_root_count,
            fully_deletable_root_count,
            blocked_delete_root_count,
            protected_root_count
          )
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(firstScanId, "2026-05-17T10:01:00.000Z", 1, "{}", 0, 0, 0, 0, 0, 0, 0).lastInsertRowid
  );

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO cleanup_root_decisions(
              cleanup_run_id,
              scan_id,
              version_id,
              digest,
              manifest_kind,
              selection_mode,
              selection_reason,
              validation_status,
              validation_reason
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          cleanupRunId,
          secondScanId,
          201,
          "sha256:wrong-scan",
          "image_manifest",
          "delete-root",
          "test",
          "fully-deletable",
          "test"
        ),
    /FOREIGN KEY constraint failed/
  );

  database.close();
});
