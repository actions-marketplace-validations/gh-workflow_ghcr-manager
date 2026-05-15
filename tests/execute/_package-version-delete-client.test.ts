import assert from "node:assert/strict";
import test from "node:test";
import { deletePackageVersionForOrg } from "../../src/execute/_package-version-delete-client.js";

test("deletePackageVersionForOrg deletes a package version via the org endpoint", async () => {
  const calls: Array<{ url: string; method?: string }> = [];

  await deletePackageVersionForOrg(
    "acme",
    "example",
    42,
    "token",
    {
      debug() {},
      info() {},
      warn() {},
      error() {}
    },
    {
      githubApiBaseUrl: "https://api.github.test",
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method
        });
        return {
          ok: true,
          status: 204,
          headers: new Headers(),
          async json() {
            return {};
          }
        };
      }
    }
  );

  assert.deepEqual(calls, [
    {
      url: "https://api.github.test/orgs/acme/packages/container/example/versions/42",
      method: "DELETE"
    }
  ]);
});

test("deletePackageVersionForOrg surfaces GitHub error details", async () => {
  await assert.rejects(
    () =>
      deletePackageVersionForOrg(
        "acme",
        "example",
        42,
        "token",
        {
          debug() {},
          info() {},
          warn() {},
          error() {}
        },
        {
          githubApiBaseUrl: "https://api.github.test",
          fetchImpl: async () => ({
            ok: false,
            status: 404,
            headers: new Headers({ "content-type": "application/json" }),
            async json() {
              return {
                message: "Not Found",
                documentation_url: "https://docs.github.com/rest/packages/packages"
              };
            }
          })
        }
      ),
    /GitHub package delete request failed for version 42 - status 404 - Not Found - https:\/\/docs\.github\.com\/rest\/packages\/packages/
  );
});
