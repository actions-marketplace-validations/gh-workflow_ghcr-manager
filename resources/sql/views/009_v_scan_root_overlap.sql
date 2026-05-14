DROP VIEW IF EXISTS v_scan_root_overlap;

CREATE VIEW v_scan_root_overlap AS
SELECT
  source.scan_id,
  source.owner,
  source.package_name,
  source.root_version_id AS source_version_id,
  source.root_digest AS source_digest,
  source.root_manifest_kind AS source_manifest_kind,
  overlapping.root_version_id AS overlapping_version_id,
  overlapping.root_digest AS overlapping_digest,
  overlapping.root_manifest_kind AS overlapping_manifest_kind,
  source.member_digest AS overlap_digest,
  source.member_manifest_kind AS overlap_manifest_kind,
  source.hops_from_root AS hops_source_to_overlap_manifest,
  overlapping.hops_from_root AS hops_overlapping_root_to_overlap_manifest
FROM v_scan_root_closure source
JOIN v_scan_root_closure overlapping
  ON overlapping.scan_id = source.scan_id
 AND overlapping.member_digest = source.member_digest
 AND overlapping.root_digest <> source.root_digest
;
