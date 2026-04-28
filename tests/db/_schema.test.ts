import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import { openDatabase } from "../../src/db/index.js";
import { initializeSchema } from "../../src/db/_schema.js";

test("initializeSchema creates expected tables", () => {
  const database = new Database(":memory:");
  initializeSchema(database);

  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
    name: string;
  }>;

  assert.deepEqual(
    tables.map((row) => row.name),
    ["manifest_edges", "manifests", "package_scans", "package_versions", "tags"],
  );

  database.close();
});

test("schema enforces key relationships for tags and manifest edges", () => {
  const database = openDatabase(":memory:");

  database
    .prepare(
      `
        INSERT INTO package_versions(version_id, digest, created_at, updated_at, metadata_json)
        VALUES(1, 'sha256:version', '2026-04-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z', '{}')
      `,
    )
    .run();
  database
    .prepare(
      `
        INSERT INTO manifests(digest, media_type, artifact_type, platform_os, platform_architecture, platform_variant)
        VALUES('sha256:parent', 'application/vnd.oci.image.manifest.v1+json', NULL, NULL, NULL, NULL)
      `,
    )
    .run();
  database
    .prepare(
      `
        INSERT INTO manifests(digest, media_type, artifact_type, platform_os, platform_architecture, platform_variant)
        VALUES('sha256:child', 'application/vnd.oci.image.manifest.v1+json', NULL, NULL, NULL, NULL)
      `,
    )
    .run();

  database.prepare(`INSERT INTO tags(tag, digest, version_id) VALUES('latest', 'sha256:version', 1)`).run();
  database
    .prepare(
      `
        INSERT INTO manifest_edges(parent_digest, child_digest, edge_kind)
        VALUES('sha256:parent', 'sha256:child', 'image-child')
      `,
    )
    .run();

  assert.throws(
    () => database.prepare(`INSERT INTO tags(tag, digest, version_id) VALUES('broken', 'sha256:missing', 1)`).run(),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO manifest_edges(parent_digest, child_digest, edge_kind)
            VALUES('sha256:missing', 'sha256:child', 'image-child')
          `,
        )
        .run(),
    /FOREIGN KEY constraint failed/,
  );

  database.close();
});
