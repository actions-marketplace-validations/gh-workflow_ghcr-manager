DROP VIEW IF EXISTS v_missing_digests;

CREATE VIEW v_missing_digests AS
SELECT DISTINCT
    lsp.scan_id,
    lsp.owner,
    lsp.package_name,
    d.child_digest AS missing_digest,
    d.parent_digest AS anchor_digest
FROM manifest_descriptors d
         JOIN v_latest_scan_per_package lsp ON lsp.scan_id = d.scan_id
         LEFT JOIN manifests m
                   ON m.scan_id = d.scan_id
                       AND m.digest = d.child_digest
WHERE m.digest IS NULL

UNION

SELECT DISTINCT
    lsp.scan_id,
    lsp.owner,
    lsp.package_name,
    mf.subject_digest AS missing_digest,
    mf.digest AS anchor_digest
FROM manifests mf
         JOIN v_latest_scan_per_package lsp ON lsp.scan_id = mf.scan_id
         LEFT JOIN manifests m
                   ON m.scan_id = mf.scan_id
                       AND m.digest = mf.subject_digest
WHERE mf.subject_digest IS NOT NULL
  AND m.digest IS NULL
;
