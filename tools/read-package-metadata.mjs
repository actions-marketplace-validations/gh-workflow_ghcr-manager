#!/usr/bin/env node
/* global console, fetch, process */

import { loadPackageMetadata } from "../dist/ingest/github/index.js";

const owner = process.argv[2];
const packageName = process.argv[3];
const token = process.argv[4];

if (!owner || !packageName || !token) {
  console.error("Usage: tools/read-package-metadata.mjs <owner> <package-name> <token>");
  process.exit(1);
}

const metadata = await loadPackageMetadata(fetch, {
  owner,
  packageName,
  token,
  logger: {
    debug() {},
    info() {},
    warn(message) {
      console.error(message);
    },
    error(message) {
      console.error(message);
    }
  }
});

process.stdout.write(metadata.rawJson);
