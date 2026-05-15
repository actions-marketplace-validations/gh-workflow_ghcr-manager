#!/usr/bin/env node

const fixture = process.argv[2];
const selection = process.argv[3];

if (!fixture || !selection) {
  throw new Error("usage: node tools/list-test-registry-validation-scenarios.mjs <fixture> <selection>");
}

const scenariosByFixture = {
  single: ["delete-untagged"],
  complex: [
    "delete-untagged",
    "complex-tag-age-window",
    "complex-tag-age-window-exclude-beta",
    "complex-tag-age-window-keep-1",
    "complex-shared-platform-tags-keep-1"
  ]
};

const scenarios = scenariosByFixture[fixture];
if (!scenarios) {
  throw new Error(`unknown fixture: ${fixture}`);
}

if (selection === "all") {
  for (const scenario of scenarios) {
    process.stdout.write(`${scenario}\n`);
  }
  process.exit(0);
}

if (!scenarios.includes(selection)) {
  throw new Error(`scenario '${selection}' is not valid for fixture '${fixture}'`);
}

process.stdout.write(`${selection}\n`);
