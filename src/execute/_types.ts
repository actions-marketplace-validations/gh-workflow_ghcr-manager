import type { DeletePlan } from "../db/index.js";

export interface DeletePackageVersionOperation {
  versionId: number;
  digest: string;
}

export interface UnsupportedUntagRoot {
  versionId: number;
  digest: string;
  reason: string;
}

export interface DeleteExecutionSummary {
  owner: string;
  packageName: string;
  scanCompletedAt: string;
  plannerInputs: DeletePlan["plannerInputs"];
  deletedPackageVersions: DeletePackageVersionOperation[];
  blockedRoots: DeletePlan["blockedRoots"];
  unsupportedUntagRoots: UnsupportedUntagRoot[];
}

export interface DeleteExecutionOptions {
  token: string;
  logger: DeleteExecutionLogger;
  githubApiBaseUrl?: string;
  fetchImpl?: DeleteExecutionFetchLike;
}

export interface DeleteExecutionLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface DeleteExecutionFetchLikeResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
}

export type DeleteExecutionFetchLike = (input: string, init?: RequestInit) => Promise<DeleteExecutionFetchLikeResponse>;
