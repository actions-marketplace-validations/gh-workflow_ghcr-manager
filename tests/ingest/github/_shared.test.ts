import assert from "node:assert/strict";
import test from "node:test";
import { acceptedManifestMediaTypes, withFetchRetry } from "../../../src/ingest/github/_shared.js";

test("shared GitHub ingest constants include OCI artifact manifests", () => {
  assert.match(acceptedManifestMediaTypes, /application\/vnd\.oci\.artifact\.manifest\.v1\+json/);
});

test("shared retry helper retries and then succeeds", async () => {
  let attempts = 0;
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
        warn() {},
        error() {},
      },
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});
