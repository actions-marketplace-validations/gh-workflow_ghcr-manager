#!/usr/bin/env node

import { scenarios } from "./test-scenarios/_definitions.mjs";

const scenarioId = process.argv[2];
const executor = process.argv[3];
const repositoryName = process.argv[4];

if (!scenarioId || !executor || !repositoryName) {
  throw new Error("usage: node tools/resolve-test-scenario.mjs <scenario> <executor> <repository-name>");
}

const scenario = scenarios[scenarioId];
if (!scenario) {
  throw new Error(`unknown scenario: ${scenarioId}`);
}

if (!scenario.supportedExecutors.includes(executor)) {
  throw new Error(`scenario '${scenarioId}' does not support executor '${executor}'`);
}

process.stdout.write(
  JSON.stringify({
    scenarioId: scenario.id,
    executor,
    packageName: `${repositoryName}-${scenario.packageSuffix}`,
    seedStrategy: scenario.seedStrategy,
    ghcrManagerArgs: scenario.ghcrManagerArgs,
    dataaxiomInputs: scenario.dataaxiomInputs
  })
);
