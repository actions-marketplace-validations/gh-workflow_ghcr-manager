#!/usr/bin/env node
/* global console, process */

import Database from "better-sqlite3";
import { existsSync } from "node:fs";

const dbPath = process.argv[2];

if (!dbPath) {
  console.error("Usage: tools/db-has-non-public-scans.mjs <db-path>");
  process.exit(1);
}

if (!existsSync(dbPath)) {
  process.stdout.write("false");
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });
const hasPackageScansTable = db
  .prepare("SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = 'package_scans'")
  .get();
if (!hasPackageScansTable) {
  db.close();
  process.stdout.write("false");
  process.exit(0);
}
const row = db.prepare("SELECT EXISTS(SELECT 1 FROM package_scans WHERE is_public = 0) AS has_non_public_scan").get();
db.close();

process.stdout.write(row?.has_non_public_scan === 1 ? "true" : "false");
