interface _PlanRootRow {
  version_id: number;
  root_digest: string;
  root_manifest_kind: string | null;
  direct_target_reason: DeletePlanSelectionReason;
  selection_mode: DeletePlanSelectionMode;
}

interface _PlanTagRow {
  target_tag: string;
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
  block_reason: DeletePlanBlockReasonCode;
}

export interface PlannerLogger {
  trace(message: string): void;
  debug(message: string): void;
  warn?(message: string): void;
}

export interface ScanRow {
  scan_id: number;
  owner: string;
  package_name: string;
  scan_completed_at: string;
}

export type DeletePlanSelectionMode = "delete-root" | "untag-only";

export type DeletePlanSelectionReason =
  | "delete-tags-all-tags-selected"
  | "delete-tags-partial-tag-match"
  | "delete-untagged"
  | "keep-n-tagged-overflow"
  | "keep-n-untagged-overflow";

export type DeletePlanBlockReasonCode = "overlap-with-retained-root";

export interface DeletePlanRoot {
  versionId: number;
  digest: string;
  manifestKind?: string;
  reason: DeletePlanSelectionReason;
  selectionMode: DeletePlanSelectionMode;
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
  reason: DeletePlanBlockReasonCode;
}

export interface DeletePlanRootDecision {
  versionId: number;
  digest: string;
  manifestKind?: string;
  selectionMode: DeletePlanSelectionMode;
  selectionReason: DeletePlanSelectionReason;
  validationStatus: "fully-deletable" | "blocked" | "untag-only";
  validationReasonCode:
    | "untag-only-partial-tag-match"
    | "fully-deletable-no-retained-overlap"
    | "blocked-overlap-with-retained-root";
  validationReason: string;
  blockingVersionId?: number;
  blockingDigest?: string;
  overlapDigest?: string;
  overlapManifestKind?: string;
}

export interface DeletePlanProtectedRoot {
  versionId: number;
  digest: string;
  blocks: Array<{
    blockedVersionId: number;
    blockedDigest: string;
    blockReasonCode: DeletePlanBlockReasonCode;
    overlapDigest: string;
    overlapManifestKind?: string;
  }>;
}

export interface PlanArtifacts {
  closureManifests: DeletePlanClosureManifest[];
  blockedRoots: DeletePlanBlockedRoot[];
  fullyDeletableRoots: DeletePlanRoot[];
}

export interface DeletePlan {
  owner: string;
  packageName: string;
  scanCompletedAt: string;
  plannerInputs: {
    deleteUntagged?: boolean;
    deleteGhostImages?: boolean;
    deletePartialImages?: boolean;
    deleteOrphanedImages?: boolean;
    deleteTags?: string[];
    excludeTags?: string[];
    keepNTagged?: number;
    keepNUntagged?: number;
    useRegex?: boolean;
    olderThan?: string;
    cutoffTimestamp?: string;
  };
  directTargetTags: string[];
  directTargetRoots: DeletePlanRoot[];
  rootDecisions: DeletePlanRootDecision[];
  protectedRoots: DeletePlanProtectedRoot[];
  closureManifests: DeletePlanClosureManifest[];
  blockedRoots: DeletePlanBlockedRoot[];
  fullyDeletableRoots: DeletePlanRoot[];
  collateralTags: string[];
}

export const silentPlannerLogger: PlannerLogger = {
  trace() {},
  debug() {}
};

export function mapPlanRootRow(row: _PlanRootRow): DeletePlanRoot {
  return {
    versionId: row.version_id,
    digest: row.root_digest,
    manifestKind: row.root_manifest_kind ?? undefined,
    reason: row.direct_target_reason,
    selectionMode: row.selection_mode
  };
}

export function mapPlanTagRows(rows: _PlanTagRow[]): string[] {
  return rows.map((row) => row.target_tag);
}

export function mapClosureManifestRow(row: _ClosureManifestRow): DeletePlanClosureManifest {
  return {
    sourceVersionId: row.source_version_id,
    sourceDigest: row.source_digest,
    memberVersionId: row.member_version_id,
    memberDigest: row.member_digest,
    memberManifestKind: row.member_manifest_kind ?? undefined,
    hopsFromRoot: row.hops_from_root,
    memberRole: row.member_role
  };
}

export function mapBlockedRootRow(row: _BlockedRootRow): DeletePlanBlockedRoot {
  return {
    blockedVersionId: row.blocked_version_id,
    blockedDigest: row.blocked_digest,
    blockingVersionId: row.blocking_version_id,
    blockingDigest: row.blocking_digest,
    overlapDigest: row.overlap_digest,
    overlapManifestKind: row.overlap_manifest_kind ?? undefined,
    reason: row.block_reason
  };
}
