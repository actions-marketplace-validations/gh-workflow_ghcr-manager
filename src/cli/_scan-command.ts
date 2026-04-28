import { ScanWriter, SnapshotRepository, openDatabase } from "../db/index.js";
import { importFileScan } from "../ingest/file/index.js";
import { importGitHubScan } from "../ingest/github/index.js";
import { findOption, requireOption, resolveLogLevel, resolveOptionalGitHubToken } from "./_args.js";
import { createLogger } from "./_logger.js";

export async function handleScan(args: string[]): Promise<number> {
  const databasePath = requireOption(args, "--db");
  const logger = createLogger(resolveLogLevel(args));
  const database = openDatabase(databasePath);
  const repository = new SnapshotRepository(database);
  const writer = new ScanWriter(database);
  await _importScan(args, writer, repository, logger);
  const metadata = repository.getPackageMetadata();
  console.log(
    JSON.stringify(
      {
        packageName: metadata.packageName,
        scannedAt: metadata.scannedAt,
        packageVersions: repository.countPackageVersions(),
        tags: repository.countTags(),
        manifests: repository.countManifests(),
        manifestEdges: repository.countManifestEdges(),
      },
      null,
      2,
    ),
  );

  database.close();
  return 0;
}

async function _importScan(
  args: string[],
  writer: ScanWriter,
  repository: SnapshotRepository,
  logger: ReturnType<typeof createLogger>,
) {
  const source = findOption(args, "--source") ?? "file";
  switch (source) {
    case "file": {
      const snapshotPath = requireOption(args, "--snapshot");
      logger.info(`Importing file snapshot from ${snapshotPath}`);
      await importFileScan(snapshotPath, writer);
      logger.info(`Completed file snapshot import from ${snapshotPath}`);
      return;
    }
    case "github":
      return importGitHubScan(
        {
          owner: requireOption(args, "--owner"),
          packageName: requireOption(args, "--package"),
          token: resolveOptionalGitHubToken(args),
          logger,
        },
        writer,
        repository,
      );
    default:
      throw new Error(`unknown scan source: ${source}`);
  }
}
