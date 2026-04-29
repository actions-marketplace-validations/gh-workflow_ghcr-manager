import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptedManifestMediaTypes,
  buildFetchTransportErrorMessage,
  withFetchRetry,
} from "../../../src/ingest/github/_shared.js";

test("shared GitHub ingest constants include OCI artifact manifests", () => {
  assert.match(acceptedManifestMediaTypes, /application\/vnd\.oci\.artifact\.manifest\.v1\+json/);
});

test("shared retry helper retries and then succeeds", async () => {
  let attempts = 0;
  const warnings: string[] = [];
  const result = await withFetchRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("fetch failed");
      }
      return "ok";
    },
    {
      label: "test request",
      logger: {
        debug() {},
        info() {},
        warn(message) {
          warnings.push(message);
        },
        error() {},
      },
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.match(warnings[0] ?? "", /test request failed on attempt 1\/4; retrying in 1000ms - fetch failed/);
});

test("shared transport error formatter includes nested cause details", () => {
  const transportError = new TypeError("fetch failed", {
    cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
  });

  assert.equal(
    buildFetchTransportErrorMessage(transportError, "request failed"),
    "request failed - fetch failed - socket hang up (ECONNRESET)",
  );
});
