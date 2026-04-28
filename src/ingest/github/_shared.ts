export interface GitHubScanOptions {
  owner: string;
  packageName: string;
  token?: string;
  githubApiBaseUrl?: string;
  registryBaseUrl?: string;
  username?: string;
  fetchImpl?: FetchLike;
  logger?: GitHubScanLogger;
}

export interface GitHubScanLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<FetchLikeResponse>;

export const acceptedManifestMediaTypes = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.oci.artifact.manifest.v1+json",
].join(", ");

export async function defaultFetch(input: string, init?: RequestInit): Promise<FetchLikeResponse> {
  return fetch(input, init);
}
