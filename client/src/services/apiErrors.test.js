import assert from "node:assert/strict";
import test from "node:test";
import { request } from "./api.js";
import { NETWORK_ERROR_MESSAGE } from "./apiErrors.js";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => null, removeItem: () => {} };

function response(status, body, jsonError = false) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (jsonError) throw new SyntaxError("not JSON");
      return body;
    },
  };
}

test("API request normalizes network failure without showing the browser error", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(request("/auth/login"), (error) => {
    assert.equal(error.code, "NETWORK_ERROR");
    assert.equal(error.message, NETWORK_ERROR_MESSAGE);
    assert.notEqual(error.message, "Failed to fetch");
    return true;
  });
});

test("auth and API response errors map only recognized response codes", async () => {
  const cases = [
    [response(401, { code: "INVALID_CREDENTIALS" }), "INVALID_CREDENTIALS"],
    [response(409, { code: "DUPLICATE_ACCOUNT" }), "DUPLICATE_ACCOUNT"],
    [response(400, { code: "VALIDATION_ERROR", fields: { email: "Enter a valid email." } }), "VALIDATION_ERROR"],
    [response(429, { code: "RATE_LIMITED" }), "RATE_LIMITED"],
    [response(503, { code: "DATABASE_UNAVAILABLE", message: "safe database message" }), "DATABASE_UNAVAILABLE"],
    [response(503, { message: "MongoServerError: private details" }), "SERVER_ERROR"],
    [response(200, null, true), "UNEXPECTED_RESPONSE"],
  ];
  for (const [mockResponse, code] of cases) {
    globalThis.fetch = async () => mockResponse;
    await assert.rejects(request("/auth/register"), (error) => {
      assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /MongoServerError|private details/);
      return true;
    });
  }
  globalThis.fetch = async () => response(400, { code: "SOME_UNKNOWN_CODE", message: "A safe request message." });
  await assert.rejects(request("/auth/register"), (error) => {
    assert.equal(error.code, "SOME_UNKNOWN_CODE");
    assert.equal(error.message, "A safe request message.");
    return true;
  });
});

test("API request accepts JSON arrays returned by scoped list endpoints", async () => {
  globalThis.fetch = async () => response(200, [{ _id: "decision-id", title: "Keep workspace context" }]);
  const result = await request("/decisions?workspaceId=workspace&projectId=project");
  assert.deepEqual(result, [{ _id: "decision-id", title: "Keep workspace context" }]);
});

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});
