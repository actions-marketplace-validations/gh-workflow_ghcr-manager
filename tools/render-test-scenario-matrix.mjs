#!/usr/bin/env node

import { scenarioMatrix } from "./test-scenarios/_definitions.mjs";

process.stdout.write(JSON.stringify({ include: scenarioMatrix }));
