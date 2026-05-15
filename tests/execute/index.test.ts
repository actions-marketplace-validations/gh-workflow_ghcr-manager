import assert from "node:assert/strict";
import test from "node:test";
import { executeDeletePlan } from "../../src/execute/index.js";

test("execute module exports executeDeletePlan", () => {
  assert.equal(typeof executeDeletePlan, "function");
});
