#!/usr/bin/env node

import Database from "better-sqlite3";

const scenario = process.argv[2];
const fixture = process.argv[3];
const databasePath = process.argv[4];

if (!scenario || !fixture || !databasePath) {
  throw new Error("usage: node tools/resolve-test-registry-validation.mjs <scenario> <fixture> <db-path>");
}

if (scenario === "delete-untagged") {
  process.stdout.write("--delete-untagged\n");
  process.exit(0);
}

if (fixture !== "complex") {
  throw new Error(`scenario '${scenario}' requires fixture 'complex'`);
}

const database = new Database(databasePath, { readonly: true });
const rows = database
  .prepare(
    `
      SELECT t.tag, pv.created_at
      FROM tags t
      JOIN package_versions pv
        ON pv.scan_id = t.scan_id
       AND pv.version_id = t.version_id
      WHERE t.tag IN ('alpha', 'beta', 'gamma')
      ORDER BY t.tag
    `
  )
  .all();
database.close();

const createdAtByTag = Object.fromEntries(rows.map((row) => [row.tag, row.created_at]));
for (const tag of ["alpha", "beta", "gamma"]) {
  if (!createdAtByTag[tag]) {
    throw new Error(`complex fixture database is missing tag '${tag}'`);
  }
}

const olderThan = _resolveOlderThanBetween(createdAtByTag.beta, createdAtByTag.gamma, new Date());

const args = ["--delete-tag", "alpha", "--delete-tag", "beta", "--delete-tag", "gamma", "--older-than", olderThan];
if (scenario === "complex-tag-age-window-exclude-beta") {
  args.push("--exclude-tag", "beta");
} else if (scenario !== "complex-tag-age-window") {
  throw new Error(`unknown validation scenario: ${scenario}`);
}

for (const arg of args) {
  process.stdout.write(`${arg}\n`);
}

function _resolveOlderThanBetween(olderCreatedAt, youngerCreatedAt, now) {
  const olderAgeMinutes = (now.getTime() - new Date(olderCreatedAt).getTime()) / 60000;
  const youngerAgeMinutes = (now.getTime() - new Date(youngerCreatedAt).getTime()) / 60000;
  const candidateMinutes = Math.floor(youngerAgeMinutes) + 1;

  if (candidateMinutes >= olderAgeMinutes) {
    throw new Error(
      `unable to derive whole-minute older-than window between ${olderCreatedAt} and ${youngerCreatedAt}`
    );
  }

  return `${candidateMinutes} minutes`;
}
