import type Database from "better-sqlite3";

interface _ScanRow {
  scan_id: number;
  owner: string;
  package_name: string;
  scan_completed_at: string;
}

interface _PlanRootRow {
  version_id: number;
  root_digest: string;
  root_manifest_kind: string | null;
  direct_target_reason: string;
  selection_mode: string;
}

interface _ClosureManifestRow {
  source_version_id: number;
  source_digest: string;
  member_version_id: number;
  member_digest: string;
  member_manifest_kind: string | null;
  hops_from_root: number;
  member_role: string;
}

interface _BlockedRootRow {
  blocked_version_id: number;
  blocked_digest: string;
  blocking_version_id: number;
  blocking_digest: string;
  overlap_digest: string;
  overlap_manifest_kind: string | null;
  block_reason: string;
}

export interface DeletePlanRoot {
  versionId: number;
  digest: string;
  manifestKind?: string;
  reason: string;
  selectionMode: string;
}

export interface DeletePlanClosureManifest {
  sourceVersionId: number;
  sourceDigest: string;
  memberVersionId: number;
  memberDigest: string;
  memberManifestKind?: string;
  hopsFromRoot: number;
  memberRole: string;
}

export interface DeletePlanBlockedRoot {
  blockedVersionId: number;
  blockedDigest: string;
  blockingVersionId: number;
  blockingDigest: string;
  overlapDigest: string;
  overlapManifestKind?: string;
  reason: string;
}

export interface DeletePlan {
  owner: string;
  packageName: string;
  scanCompletedAt: string;
  plannerInputs: {
    deleteUntagged: boolean;
  };
  directTargetTags: string[];
  directTargetRoots: DeletePlanRoot[];
  closureManifests: DeletePlanClosureManifest[];
  blockedRoots: DeletePlanBlockedRoot[];
  fullyDeletableRoots: DeletePlanRoot[];
  collateralTags: string[];
}

export class PlannerRepository {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
  }

  getDeleteUntaggedPlan(owner: string, packageName: string): DeletePlan {
    const scan = this.#getLatestCompletedScan(owner, packageName);
    const directTargetRoots = this.#listDeleteUntaggedDirectTargetRoots(scan.scan_id);
    const blockedRoots = this.#listBlockedRoots(scan.scan_id);
    const blockedVersionIds = new Set(blockedRoots.map((root) => root.blockedVersionId));
    const fullyDeletableRoots = directTargetRoots.filter((root) => !blockedVersionIds.has(root.versionId));

    return {
      owner: scan.owner,
      packageName: scan.package_name,
      scanCompletedAt: scan.scan_completed_at,
      plannerInputs: {
        deleteUntagged: true
      },
      directTargetTags: [],
      directTargetRoots,
      closureManifests: this.#listClosureManifests(scan.scan_id),
      blockedRoots,
      fullyDeletableRoots,
      collateralTags: []
    };
  }

  #getLatestCompletedScan(owner: string, packageName: string): _ScanRow {
    const row = this.#database
      .prepare(
        `
          SELECT scan_id, owner, package_name, scan_completed_at
          FROM package_scans
          WHERE owner = ?
            AND package_name = ?
            AND status = 'completed'
            AND scan_completed_at IS NOT NULL
          ORDER BY scan_completed_at DESC, scan_id DESC
          LIMIT 1
        `
      )
      .get(owner, packageName) as _ScanRow | undefined;
    if (!row) {
      throw new Error(`database does not contain completed package scan for ${owner}/${packageName}`);
    }

    return row;
  }

  #listDeleteUntaggedDirectTargetRoots(scanId: number): DeletePlanRoot[] {
    const rows = this.#database
      .prepare(
        `
          SELECT
            root_version_id AS version_id,
            root_digest,
            root_manifest_kind,
            'delete-untagged' AS direct_target_reason,
            'delete-root' AS selection_mode
          FROM v_scan_root_manifests
          WHERE scan_id = ?
            AND is_tagged = 0
            AND has_ancestor = 0
          ORDER BY root_digest
        `
      )
      .all(scanId) as _PlanRootRow[];

    return rows.map((row) => ({
      versionId: row.version_id,
      digest: row.root_digest,
      manifestKind: row.root_manifest_kind ?? undefined,
      reason: row.direct_target_reason,
      selectionMode: row.selection_mode
    }));
  }

  #listClosureManifests(scanId: number): DeletePlanClosureManifest[] {
    const rows = this.#database
      .prepare(
        `
          WITH direct_target_roots AS (
            SELECT root_version_id, root_digest
            FROM v_scan_root_manifests
            WHERE scan_id = ?
              AND is_tagged = 0
              AND has_ancestor = 0
          )
          SELECT
            c.root_version_id AS source_version_id,
            c.root_digest AS source_digest,
            c.member_version_id,
            c.member_digest,
            c.member_manifest_kind,
            c.hops_from_root,
            c.member_role
          FROM v_scan_root_closure c
          JOIN direct_target_roots dtr
            ON dtr.root_version_id = c.root_version_id
           AND dtr.root_digest = c.root_digest
          WHERE c.scan_id = ?
          ORDER BY c.root_digest, c.hops_from_root, c.member_digest
        `
      )
      .all(scanId, scanId) as _ClosureManifestRow[];

    return rows.map((row) => ({
      sourceVersionId: row.source_version_id,
      sourceDigest: row.source_digest,
      memberVersionId: row.member_version_id,
      memberDigest: row.member_digest,
      memberManifestKind: row.member_manifest_kind ?? undefined,
      hopsFromRoot: row.hops_from_root,
      memberRole: row.member_role
    }));
  }

  #listBlockedRoots(scanId: number): DeletePlanBlockedRoot[] {
    const rows = this.#database
      .prepare(
        `
          WITH direct_target_roots AS (
            SELECT
              root_version_id,
              root_digest
            FROM v_scan_root_manifests
            WHERE scan_id = ?
              AND is_tagged = 0
              AND has_ancestor = 0
          ),
          retained_roots AS (
            SELECT
              root_version_id,
              root_digest
            FROM v_scan_root_manifests
            WHERE scan_id = ?
              AND has_ancestor = 0
              AND root_digest NOT IN (SELECT root_digest FROM direct_target_roots)
          ),
          ranked_blocks AS (
            SELECT
              dtr.root_version_id AS blocked_version_id,
              dtr.root_digest AS blocked_digest,
              rr.root_version_id AS blocking_version_id,
              rr.root_digest AS blocking_digest,
              overlap.overlap_digest,
              overlap.overlap_manifest_kind,
              'overlap-with-retained-root' AS block_reason,
              ROW_NUMBER() OVER (
                PARTITION BY dtr.root_digest, rr.root_digest
                ORDER BY
                  overlap.hops_source_to_overlap_manifest,
                  overlap.hops_overlapping_root_to_overlap_manifest,
                  overlap.overlap_digest
              ) AS rn
            FROM direct_target_roots dtr
            JOIN v_scan_root_overlap overlap
              ON overlap.scan_id = ?
             AND overlap.source_digest = dtr.root_digest
            JOIN retained_roots rr
              ON rr.root_digest = overlap.overlapping_digest
          )
          SELECT
            blocked_version_id,
            blocked_digest,
            blocking_version_id,
            blocking_digest,
            overlap_digest,
            overlap_manifest_kind,
            block_reason
          FROM ranked_blocks
          WHERE rn = 1
          ORDER BY blocked_digest, blocking_digest, overlap_digest
        `
      )
      .all(scanId, scanId, scanId) as _BlockedRootRow[];

    return rows.map((row) => ({
      blockedVersionId: row.blocked_version_id,
      blockedDigest: row.blocked_digest,
      blockingVersionId: row.blocking_version_id,
      blockingDigest: row.blocking_digest,
      overlapDigest: row.overlap_digest,
      overlapManifestKind: row.overlap_manifest_kind ?? undefined,
      reason: row.block_reason
    }));
  }
}
