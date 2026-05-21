import assert from "node:assert/strict";
import test from "node:test";
import { digestFromDigestTag, isDigestTag } from "../../src/core/index.js";

test("isDigestTag recognizes sha256-prefixed helper tags", () => {
  const digestHex = "a".repeat(64);
  assert.equal(isDigestTag(`sha256-${digestHex}`), true);
  assert.equal(isDigestTag(`sha256-${digestHex}.sig`), true);
  assert.equal(isDigestTag("latest"), false);
  assert.equal(isDigestTag("sha256-abc"), false);
});

test("digestFromDigestTag returns the referenced parent digest", () => {
  const digestHex = "abcdef0123456789".repeat(4);
  assert.equal(digestFromDigestTag(`sha256-${digestHex}.att`), `sha256:${digestHex}`);
  assert.equal(digestFromDigestTag("release-1"), null);
});
