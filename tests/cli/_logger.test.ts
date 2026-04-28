import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough } from "node:stream";
import { createLogger, isLogLevel } from "../../src/cli/_logger.js";

test("isLogLevel accepts known values", () => {
  assert.equal(isLogLevel("debug"), true);
  assert.equal(isLogLevel("silent"), true);
  assert.equal(isLogLevel("verbose"), false);
});

test("logger writes messages at or above the configured threshold", () => {
  const sink = new PassThrough();
  let output = "";
  sink.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });

  const logger = createLogger("info", sink);
  logger.debug("hidden");
  logger.info("visible");
  logger.warn("also visible");

  assert.match(output, /INFO visible/);
  assert.match(output, /WARN also visible/);
  assert.doesNotMatch(output, /DEBUG hidden/);
});

test("silent logger suppresses all output", () => {
  const sink = new PassThrough();
  let output = "";
  sink.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });

  const logger = createLogger("silent", sink);
  logger.error("hidden");

  assert.equal(output, "");
});
