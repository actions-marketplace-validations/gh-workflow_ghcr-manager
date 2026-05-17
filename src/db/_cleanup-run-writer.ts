import type Database from "better-sqlite3";
import type { DeletePlan } from "./_planner-repository.js";

export class CleanupRunWriter {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  persistCleanupRun(scanId: number, plan: DeletePlan, options: { dryRun: boolean; cleanupStartedAt: string }): number {
    return this.#database.transaction(() => {
      const cleanupRunId = this.#insertCleanupRun(scanId, plan, options);
      for (const rootDecision of plan.rootDecisions) {
        this.#database
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
                validation_reason,
                blocking_version_id,
                blocking_digest,
                overlap_digest,
                overlap_manifest_kind
              )
              VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            cleanupRunId,
            scanId,
            rootDecision.versionId,
            rootDecision.digest,
            rootDecision.manifestKind ?? null,
            rootDecision.selectionMode,
            rootDecision.selectionReason,
            rootDecision.validationStatus,
            rootDecision.validationReason,
            rootDecision.blockingVersionId ?? null,
            rootDecision.blockingDigest ?? null,
            rootDecision.overlapDigest ?? null,
            rootDecision.overlapManifestKind ?? null
          );
      }

      for (const protectedRoot of plan.protectedRoots) {
        this.#database
          .prepare(
            `
              INSERT INTO cleanup_protected_roots(
                cleanup_run_id,
                scan_id,
                version_id,
                digest,
                reason,
                blocks_json
              )
              VALUES(?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            cleanupRunId,
            scanId,
            protectedRoot.versionId,
            protectedRoot.digest,
            protectedRoot.reason,
            JSON.stringify(protectedRoot.blocks)
          );
      }

      return cleanupRunId;
    })();
  }

  #insertCleanupRun(scanId: number, plan: DeletePlan, options: { dryRun: boolean; cleanupStartedAt: string }): number {
    const result = this.#database
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
      .run(
        scanId,
        options.cleanupStartedAt,
        options.dryRun ? 1 : 0,
        JSON.stringify(plan.plannerInputs),
        plan.validationSummary.directTargetTagCount,
        plan.validationSummary.directTargetRootCount,
        plan.validationSummary.deleteRootCandidateCount,
        plan.validationSummary.untagOnlyRootCount,
        plan.validationSummary.fullyDeletableRootCount,
        plan.validationSummary.blockedDeleteRootCount,
        plan.validationSummary.protectedRootCount
      );

    return Number(result.lastInsertRowid);
  }
}
