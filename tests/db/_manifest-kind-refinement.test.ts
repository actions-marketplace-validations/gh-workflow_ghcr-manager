import assert from "node:assert/strict";
import test from "node:test";
import { ManifestKinds } from "../../src/core/index.js";
import { refineManifestKinds } from "../../src/db/_manifest-kind-refinement.js";
import { ScanWriter, openDatabase } from "../../src/db/index.js";

test("refineManifestKinds upgrades generic indexes with direct image children to cross-arch", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);

  writer.startScan("acme", "example", "2026-05-22T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:index",
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifestKind: ManifestKinds.indexManifest
  });
  writer.insertTag({ versionId: 1, tag: "latest" });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:image",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  writer.insertManifestDescriptor({
    parentDigest: "sha256:index",
    childDigest: "sha256:image",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    platform: { os: "linux", architecture: "amd64" }
  });

  refineManifestKinds(database, writer.getActiveScanId());

  const row = database.prepare("SELECT manifest_kind FROM manifests WHERE digest = 'sha256:index'").get() as {
    manifest_kind: string;
  };
  assert.equal(row.manifest_kind, ManifestKinds.crossArchManifest);
  database.close();
});

test("refineManifestKinds leaves helper-tagged indexes as generic indexes", () => {
  const database = openDatabase(":memory:");
  const writer = new ScanWriter(database);

  writer.startScan("acme", "example", "2026-05-22T10:00:00.000Z", {
    rawJson: JSON.stringify({ visibility: "private" })
  });
  writer.insertPackageVersion({
    versionId: 1,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 1,
    digest: "sha256:index",
    mediaType: "application/vnd.oci.image.index.v1+json",
    manifestKind: ManifestKinds.indexManifest
  });
  writer.insertTag({
    versionId: 1,
    tag: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.sig"
  });
  writer.insertPackageVersion({
    versionId: 2,
    createdAt: "2026-05-22T09:00:00.000Z",
    updatedAt: "2026-05-22T09:00:00.000Z"
  });
  writer.insertManifest({
    versionId: 2,
    digest: "sha256:image",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    manifestKind: ManifestKinds.imageManifest
  });
  writer.insertManifestDescriptor({
    parentDigest: "sha256:index",
    childDigest: "sha256:image",
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    platform: { os: "linux", architecture: "amd64" }
  });

  refineManifestKinds(database, writer.getActiveScanId());

  const row = database.prepare("SELECT manifest_kind FROM manifests WHERE digest = 'sha256:index'").get() as {
    manifest_kind: string;
  };
  assert.equal(row.manifest_kind, ManifestKinds.indexManifest);
  database.close();
});
