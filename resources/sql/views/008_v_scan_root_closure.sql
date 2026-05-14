DROP VIEW IF EXISTS v_scan_root_closure;

CREATE VIEW v_scan_root_closure AS
SELECT
  rm.scan_id,
  rm.owner,
  rm.package_name,
  rm.root_version_id,
  rm.root_digest,
  rm.root_manifest_kind,
  rm.root_version_id AS member_version_id,
  rm.root_digest AS member_digest,
  rm.root_manifest_kind AS member_manifest_kind,
  0 AS hops_from_root,
  'root' AS member_role
FROM v_scan_root_manifests rm

UNION ALL

SELECT
  rm.scan_id,
  rm.owner,
  rm.package_name,
  rm.root_version_id,
  rm.root_digest,
  rm.root_manifest_kind,
  m.version_id AS member_version_id,
  m.digest AS member_digest,
  m.manifest_kind AS member_manifest_kind,
  mr.min_distance AS hops_from_root,
  'descendant' AS member_role
FROM v_scan_root_manifests rm
JOIN manifest_reachability mr
  ON mr.scan_id = rm.scan_id
 AND mr.ancestor_digest = rm.root_digest
 AND mr.descendant_digest <> rm.root_digest
JOIN manifests m
  ON m.scan_id = rm.scan_id
 AND m.digest = mr.descendant_digest
;
