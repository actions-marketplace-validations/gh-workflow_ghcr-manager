DROP VIEW IF EXISTS v_manifests_related_manifests;

CREATE VIEW v_manifests_related_manifests AS
WITH source_manifests AS (
  SELECT
    m.scan_id,
    lsp.owner,
    lsp.package_name,
    m.digest AS source_manifest_digest,
    m.media_type AS source_media_type
  FROM manifests m
  JOIN v_latest_scan_per_package lsp
    ON lsp.scan_id = m.scan_id
),
related_manifests AS (
  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.source_manifest_digest,
    sm.source_media_type,
    sm.source_manifest_digest AS related_manifest_digest,
    sm.source_media_type AS related_media_type,
    0 AS hops_manifest_to_related_manifest
  FROM source_manifests sm

  UNION

  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.source_manifest_digest,
    sm.source_media_type,
    r.descendant_digest AS related_manifest_digest,
    m.media_type AS related_media_type,
    r.min_distance AS hops_manifest_to_related_manifest
  FROM source_manifests sm
  JOIN manifest_reachability r
    ON r.scan_id = sm.scan_id
   AND r.ancestor_digest = sm.source_manifest_digest
  JOIN manifests m
    ON m.scan_id = sm.scan_id
   AND m.digest = r.descendant_digest

  UNION

  SELECT
    sm.scan_id,
    sm.owner,
    sm.package_name,
    sm.source_manifest_digest,
    sm.source_media_type,
    r.ancestor_digest AS related_manifest_digest,
    m.media_type AS related_media_type,
    r.min_distance AS hops_manifest_to_related_manifest
  FROM source_manifests sm
  JOIN manifest_reachability r
    ON r.scan_id = sm.scan_id
   AND r.descendant_digest = sm.source_manifest_digest
  JOIN manifests m
    ON m.scan_id = sm.scan_id
   AND m.digest = r.ancestor_digest
),
closest_related_manifests AS (
  SELECT
    scan_id,
    owner,
    package_name,
    source_manifest_digest,
    source_media_type,
    related_manifest_digest,
    related_media_type,
    MIN(hops_manifest_to_related_manifest) AS hops_manifest_to_related_manifest
  FROM related_manifests
  GROUP BY
    scan_id,
    owner,
    package_name,
    source_manifest_digest,
    source_media_type,
    related_manifest_digest,
    related_media_type
)
SELECT
  crm.scan_id,
  crm.owner,
  crm.package_name,
  crm.source_manifest_digest,
  crm.source_media_type,
  st.tag AS source_tag,
  st.version_id AS source_version_id,
  crm.related_manifest_digest,
  crm.related_media_type,
  crm.hops_manifest_to_related_manifest,
  rt.tag AS related_tag,
  rt.version_id AS related_version_id
FROM closest_related_manifests crm
LEFT JOIN tags st
  ON st.scan_id = crm.scan_id
 AND st.digest = crm.source_manifest_digest
LEFT JOIN tags rt
  ON rt.scan_id = crm.scan_id
 AND rt.digest = crm.related_manifest_digest;
