import { ScanWriter, SnapshotRepository } from "../../db/index.js";
import { loadManifestGraph } from "./_manifest-client.js";
import { buildTags, loadPackageVersions } from "./_packages-client.js";
import { defaultFetch, type GitHubScanOptions } from "./_shared.js";

export { type GitHubScanOptions } from "./_shared.js";

export async function importGitHubScan(
  options: GitHubScanOptions,
  writer: ScanWriter,
  repository: SnapshotRepository,
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const githubApiBaseUrl = options.githubApiBaseUrl ?? "https://api.github.com";
  const registryBaseUrl = options.registryBaseUrl ?? "https://ghcr.io";
  const scannedAt = new Date().toISOString();
  const packageName = `${options.owner}/${options.packageName}`;
  const logger = options.logger;

  writer.resetScan(packageName, scannedAt);
  logger?.info(`Starting GitHub package scan for ${packageName}`);

  const packageVersions = await loadPackageVersions(fetchImpl, githubApiBaseUrl, options);
  const tags = buildTags(packageVersions);
  for (const version of packageVersions) {
    writer.insertPackageVersion(version);
  }
  for (const tag of tags) {
    writer.insertTag(tag);
  }
  logger?.info(`Loaded ${packageVersions.length} package versions and ${tags.length} tags`);

  const digests = repository.listPackageVersionDigests();
  logger?.info(`Fetching manifests for ${digests.length} package versions`);
  let completed = 0;
  for (const digest of digests) {
    logger?.debug(`Fetching manifest ${completed + 1}/${digests.length}: ${digest}`);
    const manifest = await loadManifestGraph(fetchImpl, registryBaseUrl, digest, options);
    writer.insertManifest(manifest.record);
    for (const child of manifest.childRecords) {
      writer.insertManifest(child);
    }
    for (const edge of manifest.edgeRecords) {
      writer.insertManifestEdge(edge);
    }
    completed += 1;
    if (completed === digests.length || completed % 25 === 0) {
      logger?.info(`Fetched manifests ${completed}/${digests.length}`);
    }
  }
  logger?.info(`Completed GitHub package scan for ${packageName}`);
}
