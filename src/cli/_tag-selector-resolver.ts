import type Database from "better-sqlite3";
import type { PlanCommandInputs } from "./_planner-options.js";

export function resolveTagSelectors(database: Database.Database, inputs: PlanCommandInputs): PlanCommandInputs {
  if (
    inputs.deleteTags.length === 0 &&
    inputs.excludeTags.length === 0 &&
    !inputs.deleteGhostImages &&
    !inputs.deleteOrphanedImages
  ) {
    return inputs;
  }

  const availableTags = _listLatestPackageTags(database, inputs.owner, inputs.packageName);
  return {
    ...inputs,
    deleteTags: inputs.deleteGhostImages
      ? _listLatestGhostTags(database, inputs.owner, inputs.packageName, inputs.cutoffTimestamp)
      : inputs.deleteOrphanedImages
        ? _listLatestOrphanedTags(database, inputs.owner, inputs.packageName, inputs.cutoffTimestamp)
        : _resolveSelectors(availableTags, inputs.deleteTags, inputs.useRegex),
    excludeTags: _resolveSelectors(availableTags, inputs.excludeTags, inputs.useRegex)
  };
}

function _listLatestPackageTags(database: Database.Database, owner: string, packageName: string): string[] {
  const rows = database
    .prepare(
      `
        SELECT t.tag
        FROM tags t
        INNER JOIN v_latest_scan_per_package latest_scan ON latest_scan.scan_id = t.scan_id
        WHERE latest_scan.owner = ?
          AND latest_scan.package_name = ?
        ORDER BY t.tag
      `
    )
    .all(owner, packageName) as Array<{ tag: string }>;
  return rows.map((row) => row.tag);
}

function _resolveSelectors(availableTags: string[], selectors: string[], useRegex: boolean): string[] {
  const resolved = new Set<string>();
  for (const selector of selectors) {
    const matcher = useRegex ? _buildRegexMatcher(selector) : _buildWildcardMatcher(selector);
    for (const tag of availableTags) {
      if (matcher(tag)) {
        resolved.add(tag);
      }
    }
  }
  return [...resolved];
}

function _listLatestGhostTags(
  database: Database.Database,
  owner: string,
  packageName: string,
  cutoffTimestamp?: string
): string[] {
  const rows = database
    .prepare(
      `
        WITH ghost_roots AS (
          SELECT
            srm.scan_id,
            srm.root_version_id AS version_id
          FROM v_scan_root_manifests srm
          JOIN package_versions pv
            ON pv.scan_id = srm.scan_id
           AND pv.version_id = srm.root_version_id
          JOIN manifest_descriptors md
            ON md.scan_id = srm.scan_id
           AND md.parent_digest = srm.root_digest
          LEFT JOIN v_missing_digests vmd
            ON vmd.scan_id = md.scan_id
           AND vmd.anchor_digest = md.parent_digest
           AND vmd.missing_digest = md.child_digest
          WHERE srm.owner = ?
            AND srm.package_name = ?
            AND srm.root_manifest_kind = 'image_index'
            AND srm.is_tagged = 1
            AND srm.has_ancestor = 0
            AND (? IS NULL OR pv.created_at < ?)
          GROUP BY srm.scan_id, srm.root_version_id
          HAVING COUNT(*) > 0
             AND COUNT(vmd.missing_digest) = COUNT(*)
        )
        SELECT DISTINCT t.tag
        FROM ghost_roots gr
        JOIN tags t
          ON t.scan_id = gr.scan_id
         AND t.version_id = gr.version_id
        ORDER BY t.tag
      `
    )
    .all(owner, packageName, cutoffTimestamp ?? null, cutoffTimestamp ?? null) as Array<{ tag: string }>;
  return rows.map((row) => row.tag);
}

// Some OCI tooling publishes companion artifacts such as signatures or attestations under
// digest-derived tags in the same repository, for example `sha256-<digest>.sig`, while the
// actual relationship is the artifact's subject/referrer link to the parent digest.
//
// Public references:
// - Sigstore Cosign example pushing `sha256-<digest>.sig`:
//   https://docs.sigstore.dev/cosign/signing/other_types/
// - OCI referrers / subject model:
//   https://github.com/opencontainers/distribution-spec/blob/main/spec.md
//
// This resolver intentionally mirrors the `delete-orphaned-images` behavior from
// `dataaxiom/ghcr-cleanup-action`, but keeps the check narrow and local to the current package
// scan: derive the parent digest from the tag, then treat the tag as orphaned only when that
// digest is absent from the scanned manifests for the same package.
function _listLatestOrphanedTags(
  database: Database.Database,
  owner: string,
  packageName: string,
  cutoffTimestamp?: string
): string[] {
  const rows = database
    .prepare(
      `
        SELECT DISTINCT dtr.tag
        FROM v_digest_derived_tag_relations dtr
        INNER JOIN package_versions pv
          ON pv.scan_id = dtr.scan_id
         AND pv.version_id = dtr.artifact_version_id
        WHERE dtr.owner = ?
          AND dtr.package_name = ?
          AND dtr.parent_exists = 0
          AND (? IS NULL OR pv.created_at < ?)
        ORDER BY dtr.tag
      `
    )
    .all(owner, packageName, cutoffTimestamp ?? null, cutoffTimestamp ?? null) as Array<{ tag: string }>;
  return rows.map((row) => row.tag);
}

function _buildRegexMatcher(selector: string): (tag: string) => boolean {
  const pattern = new RegExp(selector);
  return (tag) => pattern.test(tag);
}

function _buildWildcardMatcher(selector: string): (tag: string) => boolean {
  const escaped = selector
    .replaceAll(/[|\\{}()[\]^$+.]/g, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".");
  const pattern = new RegExp(`^${escaped}$`);
  return (tag) => pattern.test(tag);
}
