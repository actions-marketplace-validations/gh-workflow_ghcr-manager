#!/usr/bin/env node

import Database from "better-sqlite3";

export function loadAgeWindowSelectedRows(databasePath, cutoffTimestamp, excludedTags) {
  const database = new Database(databasePath, { readonly: true });
  const selectedRows = database
    .prepare(
      `
        SELECT t.tag, m.digest
        FROM tags t
        JOIN manifests m
          ON m.scan_id = t.scan_id
         AND m.version_id = t.version_id
        JOIN package_versions pv
          ON pv.scan_id = t.scan_id
         AND pv.version_id = t.version_id
        WHERE t.tag IN ('alpha', 'beta', 'gamma')
          AND pv.created_at < ?
        ORDER BY t.tag
      `
    )
    .all(cutoffTimestamp)
    .filter((row) => !excludedTags.includes(row.tag));
  database.close();
  return selectedRows;
}

export function loadCombinedTaggedRows(databasePath, cutoffTimestamp) {
  const database = new Database(databasePath, { readonly: true });
  const rows = database
    .prepare(
      `
        SELECT t.tag, m.version_id, m.digest, m.manifest_kind, pv.created_at
        FROM tags t
        JOIN manifests m
          ON m.scan_id = t.scan_id
         AND m.version_id = t.version_id
        JOIN package_versions pv
          ON pv.scan_id = t.scan_id
         AND pv.version_id = t.version_id
        WHERE (
          ? IS NULL
          OR pv.created_at < ?
        )
        ORDER BY pv.created_at DESC, m.version_id DESC, m.digest DESC, t.tag
      `
    )
    .all(cutoffTimestamp ?? null, cutoffTimestamp ?? null);
  database.close();
  return rows;
}
