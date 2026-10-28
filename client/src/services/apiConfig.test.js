import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiConfig } from "./apiConfig.js";

test("development defaults to the local API and socket origin", () => {
  assert.deepEqual(resolveApiConfig({ isProduction: false }), {
    apiBaseUrl: "http://localhost:5000/api",
    apiOrigin: "http://localhost:5000",
  });
});

test("production uses the configured HTTPS API origin for REST and sockets", () => {
  assert.deepEqual(resolveApiConfig({ configuredUrl: "https://api.example.test/api", isProduction: true }), {
    apiBaseUrl: "https://api.example.test/api",
    apiOrigin: "https://api.example.test",
  });
});

test("production fails clearly when the API URL is missing or insecure", () => {
  assert.throws(() => resolveApiConfig({ isProduction: true }), /VITE_API_BASE_URL must be set/);
  assert.throws(() => resolveApiConfig({ configuredUrl: "http://api.example.test/api", isProduction: true }), /must use HTTPS/);
});

test("API URL rejects non-origin paths, credentials, and unsupported schemes", () => {
  for (const configuredUrl of [
    "https://user:pass@api.example.test/api",
    "https://api.example.test/v1/api",
    "ftp://api.example.test/api",
    "https://api.example.test/api?token=x",
  ]) {
    assert.throws(() => resolveApiConfig({ configuredUrl, isProduction: false }));
  }
});
