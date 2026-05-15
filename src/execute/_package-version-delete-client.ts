import {
  type DeleteExecutionFetchLike,
  type DeleteExecutionFetchLikeResponse,
  type DeleteExecutionLogger
} from "./_types.js";

const _DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com";
const _GITHUB_API_VERSION = "2022-11-28";
const _RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const _RETRY_LIMIT = 3;
const _RETRY_DELAY_MS = 1000;

export async function deletePackageVersionForOrg(
  owner: string,
  packageName: string,
  versionId: number,
  token: string,
  logger: DeleteExecutionLogger,
  runtime?: {
    githubApiBaseUrl?: string;
    fetchImpl?: DeleteExecutionFetchLike;
  }
): Promise<void> {
  const githubApiBaseUrl = runtime?.githubApiBaseUrl ?? _DEFAULT_GITHUB_API_BASE_URL;
  const fetchImpl = runtime?.fetchImpl ?? fetch;
  const url = new URL(
    `/orgs/${encodeURIComponent(owner)}/packages/container/${encodeURIComponent(packageName)}/versions/${versionId}`,
    githubApiBaseUrl
  ).toString();

  let attempt = 0;
  for (;;) {
    let response: DeleteExecutionFetchLikeResponse;
    try {
      response = await fetchImpl(url, {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "ghcr-manager",
          "X-GitHub-Api-Version": _GITHUB_API_VERSION
        }
      });
    } catch (error) {
      throw new Error(
        _buildTransportErrorMessage(error, `GitHub package delete request failed for version ${versionId}`),
        {
          cause: error
        }
      );
    }

    if (response.ok) {
      return;
    }

    const message = await _buildHttpErrorMessage(
      response,
      `GitHub package delete request failed for version ${versionId}`
    );
    attempt += 1;
    if (attempt > _RETRY_LIMIT || !_RETRYABLE_STATUS_CODES.has(response.status)) {
      throw new Error(message);
    }

    logger.warn(
      `GitHub package delete request for version ${versionId} failed on attempt ${attempt}/${_RETRY_LIMIT + 1}; retrying in ${_RETRY_DELAY_MS}ms - ${message}`
    );
    await _sleep(_RETRY_DELAY_MS);
  }
}

async function _buildHttpErrorMessage(response: DeleteExecutionFetchLikeResponse, fallback: string): Promise<string> {
  const details: string[] = [fallback, `status ${response.status}`];
  const body = await _readJsonErrorBody(response);
  const message = typeof body?.message === "string" ? body.message : undefined;
  const documentationUrl = typeof body?.documentation_url === "string" ? body.documentation_url : undefined;
  const authenticateHeader = response.headers.get("www-authenticate") ?? undefined;

  if (message) {
    details.push(message);
  }
  if (documentationUrl) {
    details.push(documentationUrl);
  }
  if (authenticateHeader) {
    details.push(`www-authenticate: ${authenticateHeader}`);
  }

  return details.join(" - ");
}

async function _readJsonErrorBody(response: DeleteExecutionFetchLikeResponse): Promise<
  | {
      message?: unknown;
      documentation_url?: unknown;
    }
  | undefined
> {
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (contentType && contentType !== "application/json" && !contentType.endsWith("+json")) {
    return undefined;
  }

  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      return body as { message?: unknown; documentation_url?: unknown };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function _buildTransportErrorMessage(error: unknown, fallback: string): string {
  const details = [fallback];
  if (error instanceof Error && error.message) {
    details.push(error.message);
  } else {
    details.push(String(error));
  }
  return details.join(" - ");
}

function _sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
