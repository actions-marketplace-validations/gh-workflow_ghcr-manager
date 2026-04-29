import type Database from "better-sqlite3";

interface _DigestRow {
  digest: string;
}

interface _ManifestEdgeRow {
  parent_digest: string;
  child_digest: string;
}

export function rebuildManifestReachability(database: Database.Database): void {
  const manifestDigests = _loadManifestDigests(database);
  const childDigestsByParent = new Map<string, Set<string>>();
  const parentDigestsByChild = new Map<string, Set<string>>();

  for (const digest of manifestDigests) {
    childDigestsByParent.set(digest, new Set());
    parentDigestsByChild.set(digest, new Set());
  }

  for (const manifestEdge of _loadManifestEdges(database)) {
    childDigestsByParent.get(manifestEdge.parent_digest)?.add(manifestEdge.child_digest);
    parentDigestsByChild.get(manifestEdge.child_digest)?.add(manifestEdge.parent_digest);
  }

  const remainingChildrenCount = new Map<string, number>();
  const descendantDistancesByDigest = new Map<string, Map<string, number>>();
  const readyDigests: string[] = [];

  for (const digest of manifestDigests) {
    const childCount = childDigestsByParent.get(digest)?.size ?? 0;
    remainingChildrenCount.set(digest, childCount);
    if (childCount === 0) {
      readyDigests.push(digest);
    }
  }

  while (readyDigests.length > 0) {
    const digest = readyDigests.shift();
    if (!digest) {
      continue;
    }

    const distances = new Map<string, number>([[digest, 0]]);
    for (const childDigest of childDigestsByParent.get(digest) ?? []) {
      _setMinDistance(distances, childDigest, 1);

      const childDistances = descendantDistancesByDigest.get(childDigest);
      if (!childDistances) {
        throw new Error(`manifest reachability build missing child results for ${childDigest}`);
      }

      for (const [descendantDigest, childDistance] of childDistances) {
        if (descendantDigest === childDigest) {
          continue;
        }

        _setMinDistance(distances, descendantDigest, childDistance + 1);
      }
    }

    descendantDistancesByDigest.set(digest, distances);
    for (const parentDigest of parentDigestsByChild.get(digest) ?? []) {
      const nextCount = (remainingChildrenCount.get(parentDigest) ?? 0) - 1;
      remainingChildrenCount.set(parentDigest, nextCount);
      if (nextCount === 0) {
        readyDigests.push(parentDigest);
      }
    }
  }

  if (descendantDistancesByDigest.size !== manifestDigests.length) {
    throw new Error("manifest reachability build detected a cycle in manifest_edges");
  }

  const insertRow = database.prepare(
    `
      INSERT OR REPLACE INTO manifest_reachability(ancestor_digest, descendant_digest, min_distance)
      VALUES(?, ?, ?)
    `,
  );

  const rebuild = database.transaction(() => {
    database.exec("DELETE FROM manifest_reachability");

    for (const digest of manifestDigests) {
      for (const [descendantDigest, distance] of descendantDistancesByDigest.get(digest) ?? []) {
        insertRow.run(digest, descendantDigest, distance);
      }
    }
  });

  rebuild();
}

function _loadManifestDigests(database: Database.Database): string[] {
  const rows = database.prepare("SELECT digest FROM manifests ORDER BY digest").all() as _DigestRow[];
  return rows.map((row) => row.digest);
}

function _loadManifestEdges(database: Database.Database): _ManifestEdgeRow[] {
  return database
    .prepare(
      `
        SELECT DISTINCT parent_digest, child_digest
        FROM manifest_edges
        ORDER BY parent_digest, child_digest
      `,
    )
    .all() as _ManifestEdgeRow[];
}

function _setMinDistance(distances: Map<string, number>, digest: string, distance: number): void {
  const currentDistance = distances.get(digest);
  if (currentDistance === undefined || distance < currentDistance) {
    distances.set(digest, distance);
  }
}
