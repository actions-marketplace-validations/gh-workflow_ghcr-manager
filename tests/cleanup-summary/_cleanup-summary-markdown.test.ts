import assert from "node:assert/strict";
import test from "node:test";
import { renderCleanupSummaryMarkdown } from "../../src/cleanup-summary/index.js";

test("renderCleanupSummaryMarkdown renders sections and truncates long lists", () => {
  const markdown = renderCleanupSummaryMarkdown(
    {
      command: "cleanup",
      owner: "acme",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      dryRun: true,
      plannerInputs: { deleteTags: ["a", "b"], useRegex: true },
      directTargetTags: ["a", "b", "c"],
      collateralTags: [],
      fullyDeletableRoots: [
        {
          versionId: 101,
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          rootTags: ["a", "b", "c"],
          matchedTags: ["a"],
          selectionMode: "delete-root",
          selectionReason: "delete-tags-partial-tag-match",
          validationStatus: "fully-deletable",
          validationReasonCode: "fully-deletable-no-retained-overlap",
          validationReason: "No retained overlap"
        }
      ],
      untagOnlyRoots: [],
      blockedRoots: [],
      affectedManifests: [{ digest: "sha256:a" }, { digest: "sha256:b" }, { digest: "sha256:c" }],
      deletedPackageVersions: [],
      untaggedTags: [],
      unsupportedUntagRoots: []
    },
    {
      maxDirectTargetTags: 2,
      maxRootsPerSection: 10,
      maxTagsPerRoot: 2
    }
  );

  assert.match(markdown, /## Cleanup Summary/);
  assert.match(markdown, /\| 📦 Package \| `acme\/example` \|/);
  assert.match(markdown, /<summary>⚙️ Cleanup filter<\/summary>/);
  assert.match(markdown, /<summary>🏷️ Matched tags<\/summary>/);
  assert.match(markdown, /<summary>🗑️ Fully deletable roots<\/summary>/);
  assert.match(markdown, /\| 📄 Affected manifests \| 3 \|/);
  assert.match(markdown, /Showing first 2 of 3 matched tags/);
  assert.match(markdown, /sha256:aaaaaaaa\.\.\.aaaaaaaa/);
  assert.match(markdown, /a, b, \+1 more/);
  assert.doesNotMatch(markdown, /<summary>🔗 Untag-only roots<\/summary>/);
  assert.doesNotMatch(markdown, /<summary>🛡️ Blocked roots<\/summary>/);
});

test("renderCleanupSummaryMarkdown renders blocked, untag-only, and live-effect details", () => {
  const markdown = renderCleanupSummaryMarkdown(
    {
      command: "cleanup",
      owner: "acme`team",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      dryRun: false,
      plannerInputs: { deleteUntagged: true },
      directTargetTags: [],
      collateralTags: [],
      fullyDeletableRoots: [],
      untagOnlyRoots: [
        {
          versionId: 201,
          digest: "sha256:short",
          rootTags: [],
          matchedTags: ["keep|me"],
          selectionMode: "untag-only",
          selectionReason: "delete-tags-partial-tag-match",
          validationStatus: "untag-only",
          validationReasonCode: "untag-only-partial-tag-match",
          validationReason: "detaches"
        }
      ],
      blockedRoots: [
        {
          versionId: 202,
          digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          rootTags: ["line1\nline2"],
          matchedTags: [],
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "blocked",
          validationReasonCode: "blocked-overlap-with-retained-root",
          validationReason: "blocked",
          blockingDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          overlapDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        },
        {
          versionId: 203,
          digest: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          rootTags: [],
          matchedTags: [],
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "blocked",
          validationReasonCode: "blocked-overlap-with-retained-root",
          validationReason: "blocked",
          blockingDigest: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        }
      ],
      affectedManifests: [],
      deletedPackageVersions: [
        { versionId: 202, digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
      ],
      untaggedTags: [
        {
          tag: "keep|me",
          sourceVersionId: 201,
          sourceDigest: "sha256:short",
          detachedVersionId: 301,
          detachedDigest: "sha256:detached"
        }
      ],
      unsupportedUntagRoots: [
        {
          versionId: 999,
          digest: "sha256:unsupported",
          reason: "unsupported"
        }
      ]
    },
    {
      maxDirectTargetTags: 5,
      maxRootsPerSection: 5,
      maxTagsPerRoot: 5
    }
  );

  assert.match(markdown, /`acme\\`team\/example`/);
  assert.match(markdown, /<summary>🔗 Untag-only roots<\/summary>/);
  assert.match(markdown, /<summary>🛡️ Blocked roots<\/summary>/);
  assert.match(markdown, /\(untagged\)/);
  assert.match(markdown, /keep\\\|me/);
  assert.match(markdown, /line1 line2/);
  assert.match(markdown, /Selected tags detach; root remains/);
  assert.match(markdown, /Blocked by sha256:cccccccc\.\.\.cccccccc via sha256:dddddddd\.\.\.dddddddd/);
  assert.match(markdown, /`sha256:short`/);
  assert.match(markdown, /### Applied changes/);
  assert.match(markdown, /\| 📄 Affected manifests \| 0 \|/);
  assert.match(markdown, /Deleted package versions: 1/);
  assert.match(markdown, /Detached tags: 1/);
  assert.match(markdown, /Unsupported untag roots: 1/);
});

test("renderCleanupSummaryMarkdown notes when a root section is truncated", () => {
  const markdown = renderCleanupSummaryMarkdown(
    {
      command: "cleanup",
      owner: "acme",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      dryRun: true,
      plannerInputs: { deleteTags: ["a"] },
      directTargetTags: ["a"],
      collateralTags: [],
      fullyDeletableRoots: [
        {
          versionId: 101,
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          rootTags: ["a"],
          matchedTags: ["a"],
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "fully-deletable",
          validationReasonCode: "fully-deletable-no-retained-overlap",
          validationReason: "No retained overlap"
        },
        {
          versionId: 102,
          digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          rootTags: ["a"],
          matchedTags: ["a"],
          selectionMode: "delete-root",
          selectionReason: "delete-tags-all-tags-selected",
          validationStatus: "fully-deletable",
          validationReasonCode: "fully-deletable-no-retained-overlap",
          validationReason: "No retained overlap"
        }
      ],
      untagOnlyRoots: [],
      blockedRoots: [],
      affectedManifests: [{ digest: "sha256:a" }, { digest: "sha256:b" }],
      deletedPackageVersions: [],
      untaggedTags: [],
      unsupportedUntagRoots: []
    },
    {
      maxDirectTargetTags: 5,
      maxRootsPerSection: 1,
      maxTagsPerRoot: 5
    }
  );

  assert.match(markdown, /Showing first 1 of 2 🗑️ fully deletable roots\./i);
});

test("renderCleanupSummaryMarkdown does not show digest-tag helper tags in user-facing markdown", () => {
  const markdown = renderCleanupSummaryMarkdown(
    {
      command: "cleanup",
      owner: "acme",
      packageName: "example",
      scanCompletedAt: "2026-05-20T10:00:00.000Z",
      dryRun: true,
      plannerInputs: { deleteTags: [".*"], useRegex: true },
      directTargetTags: ["release-1"],
      collateralTags: [],
      fullyDeletableRoots: [],
      untagOnlyRoots: [],
      blockedRoots: [],
      affectedManifests: [],
      deletedPackageVersions: [],
      untaggedTags: [],
      unsupportedUntagRoots: []
    },
    {}
  );

  assert.doesNotMatch(markdown, /Digest-tag helper tags/);
  assert.doesNotMatch(markdown, /helper\/referrer artifacts, not ordinary user-facing image tags/);
});
