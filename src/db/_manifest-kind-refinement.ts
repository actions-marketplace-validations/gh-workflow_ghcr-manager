import type Database from "better-sqlite3";
import { ManifestKinds } from "../core/index.js";

const _refineManifestKindsStatementByDatabase = new WeakMap<Database.Database, Database.Statement>();

export function refineManifestKinds(database: Database.Database, scanId: number): void {
  _refineManifestKindsStatement(database).run(ManifestKinds.crossArchManifest, scanId, ManifestKinds.indexManifest);
}

function _refineManifestKindsStatement(database: Database.Database): Database.Statement {
  const cached = _refineManifestKindsStatementByDatabase.get(database);
  if (cached) {
    return cached;
  }

  const statement = database.prepare(`
    UPDATE manifests AS parent
    SET manifest_kind = ?
    WHERE parent.scan_id = ?
      AND parent.manifest_kind = ?
      AND parent.media_type IN (
        'application/vnd.oci.image.index.v1+json',
        'application/vnd.docker.distribution.manifest.list.v2+json'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM tags helper_tag
        WHERE helper_tag.scan_id = parent.scan_id
          AND helper_tag.version_id = parent.version_id
          AND helper_tag.is_digest_tag = 1
      )
      AND EXISTS (
        SELECT 1
        FROM manifest_descriptors descriptor
        JOIN manifests child
          ON child.scan_id = descriptor.scan_id
         AND child.digest = descriptor.child_digest
        WHERE descriptor.scan_id = parent.scan_id
          AND descriptor.parent_digest = parent.digest
          AND child.media_type IN (
            'application/vnd.oci.image.manifest.v1+json',
            'application/vnd.docker.distribution.manifest.v2+json'
          )
      )
  `);
  _refineManifestKindsStatementByDatabase.set(database, statement);
  return statement;
}
