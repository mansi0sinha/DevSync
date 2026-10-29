const assert = require("node:assert/strict");
const test = require("node:test");
const { validateRuntimeConfig } = require("../src/config/runtime");

const base = {
  NODE_ENV: "development",
  PORT: "5000",
  MONGODB_URI: "mongodb://127.0.0.1:27017/devsync",
  JWT_SECRET: "development-secret-for-test-only",
};

test("runtime config accepts valid local and production settings", () => {
  assert.equal(validateRuntimeConfig(base), true);
  assert.equal(validateRuntimeConfig({
    ...base,
    NODE_ENV: "production",
    MONGODB_URI: "mongodb+srv://db.example.test/devsync",
    JWT_SECRET: "a-production-secret-with-more-than-thirty-two-characters",
  }), true);
  assert.equal(validateRuntimeConfig({
    ...base,
    MONGODB_URI: "mongodb://db-a.example.test:27017,db-b.example.test:27017/devsync?replicaSet=rs0",
  }), true);
});

test("runtime config requires Mongo and a JWT secret without revealing values", () => {
  assert.throws(() => validateRuntimeConfig({ ...base, MONGODB_URI: undefined }), /MONGODB_URI is required/);
  assert.throws(() => validateRuntimeConfig({ ...base, MONGODB_URI: "" }), /MONGODB_URI is required/);
  assert.throws(() => validateRuntimeConfig({ ...base, JWT_SECRET: "" }), /JWT_SECRET/);
});

test("Mongo URI validation rejects malformed values with sanitized diagnostics", () => {
  for (const MONGODB_URI of [
    "postgres://db.example.test/devsync",
    "mongodb+srv://",
    "mongodb://db.example.test:invalid/devsync",
    "mongodb://user:unescaped@password@db.example.test/devsync",
    " mongodb://db.example.test/devsync",
  ]) {
    assert.throws(
      () => validateRuntimeConfig({ ...base, MONGODB_URI }),
      (error) => {
        assert.match(error.message, /MONGODB_URI/);
        assert.doesNotMatch(error.message, /unescaped|password|db\.example/);
        return true;
      },
    );
  }
});

test("production rejects weak secrets and invalid ports", () => {
  const production = { ...base, NODE_ENV: "production", JWT_SECRET: "short" };
  assert.throws(() => validateRuntimeConfig(production), /at least 32 characters/);
  assert.throws(() => validateRuntimeConfig({ ...base, PORT: "70000" }), /PORT/);
});
