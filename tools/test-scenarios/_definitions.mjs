export const scenarios = {
  "delete-untagged-noop": {
    id: "delete-untagged-noop",
    packageSuffix: "scenario--delete-untagged-noop",
    seedStrategy: "delete-untagged-noop",
    supportedExecutors: ["ghcr-manager", "ghcr-cleanup-action"],
    ghcrManagerArgs: ["--delete-untagged"],
    dataaxiomInputs: {
      "delete-untagged": "true"
    }
  },
  "tagged-fully-deletable": {
    id: "tagged-fully-deletable",
    packageSuffix: "scenario--tagged-fully-deletable",
    seedStrategy: "tagged-fully-deletable",
    supportedExecutors: ["ghcr-manager", "ghcr-cleanup-action"],
    ghcrManagerArgs: ["--delete-tag", "{deleteTag}"],
    dataaxiomInputs: {
      "delete-tags": "{deleteTag}"
    },
    tagNames: {
      deleteTag: "delete-me"
    }
  },
  "untag-only-single-shared-root": {
    id: "untag-only-single-shared-root",
    packageSuffix: "scenario--untag-only-single-shared-root",
    seedStrategy: "untag-only-single-shared-root",
    supportedExecutors: ["ghcr-manager", "ghcr-cleanup-action"],
    ghcrManagerArgs: ["--delete-tag", "{deleteTag}"],
    dataaxiomInputs: {
      "delete-tags": "{deleteTag}"
    },
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    }
  },
  "untag-only-multiarch-shared-root": {
    id: "untag-only-multiarch-shared-root",
    packageSuffix: "scenario--untag-only-multiarch-shared-root",
    seedStrategy: "untag-only-multiarch-shared-root",
    supportedExecutors: ["ghcr-manager", "ghcr-cleanup-action"],
    ghcrManagerArgs: ["--delete-tag", "{deleteTag}"],
    dataaxiomInputs: {
      "delete-tags": "{deleteTag}"
    },
    tagNames: {
      deleteTag: "delete-me",
      keepTag: "keep-me"
    }
  }
};
