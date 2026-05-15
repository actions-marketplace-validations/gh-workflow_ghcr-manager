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
    ghcrManagerArgs: ["--delete-tag", "delete-me"],
    dataaxiomInputs: {
      "delete-tags": "delete-me"
    }
  }
};
