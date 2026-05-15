import type { DeletePlan } from "../db/index.js";
import { deletePackageVersionForOrg } from "./_package-version-delete-client.js";
import {
  type DeleteExecutionOptions,
  type DeleteExecutionSummary,
  type DeletePackageVersionOperation,
  type UnsupportedUntagRoot
} from "./_types.js";

export async function executeDeletePlan(
  plan: DeletePlan,
  options: DeleteExecutionOptions
): Promise<DeleteExecutionSummary> {
  const unsupportedUntagRoots = _listUnsupportedUntagRoots(plan);
  if (unsupportedUntagRoots.length > 0) {
    throw new Error(
      `execution does not yet support untag-only roots: ${unsupportedUntagRoots.map((root) => root.digest).join(", ")}`
    );
  }

  const deletedPackageVersions: DeletePackageVersionOperation[] = [];
  for (const root of plan.fullyDeletableRoots) {
    options.logger.info(
      `Deleting package version ${root.versionId} for ${plan.owner}/${plan.packageName} (${root.digest})`
    );
    await deletePackageVersionForOrg(plan.owner, plan.packageName, root.versionId, options.token, options.logger, {
      githubApiBaseUrl: options.githubApiBaseUrl,
      fetchImpl: options.fetchImpl
    });
    deletedPackageVersions.push({
      versionId: root.versionId,
      digest: root.digest
    });
  }

  return {
    owner: plan.owner,
    packageName: plan.packageName,
    scanCompletedAt: plan.scanCompletedAt,
    plannerInputs: plan.plannerInputs,
    deletedPackageVersions,
    blockedRoots: plan.blockedRoots,
    unsupportedUntagRoots
  };
}

function _listUnsupportedUntagRoots(plan: DeletePlan): UnsupportedUntagRoot[] {
  return plan.rootDecisions
    .filter((decision) => decision.validationStatus === "untag-only")
    .map((decision) => ({
      versionId: decision.versionId,
      digest: decision.digest,
      reason: decision.validationReason
    }));
}
