const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { connectDB, diagnoseMongoError, isDatabaseUnavailableError } = require("../src/config/db");

test("Mongo connection failures receive safe diagnostics by common category", () => {
  assert.match(diagnoseMongoError(Object.assign(new Error("socket closed"), { code: "ECONNRESET" })), /network connection failed/);
  assert.match(diagnoseMongoError(Object.assign(new Error("lookup"), { code: "ENOTFOUND" })), /DNS lookup failed/);
  assert.match(diagnoseMongoError(Object.assign(new Error("TLS handshake"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" })), /TLS negotiation failed/);
  assert.match(diagnoseMongoError(Object.assign(new Error("Authentication failed"), { code: 18 })), /authentication failed/);
  assert.match(diagnoseMongoError(Object.assign(new Error("Server selection timed out"), { name: "MongoServerSelectionError" })), /cluster is unavailable/);
  const diagnostic = diagnoseMongoError(new Error("mongodb+srv://user:secret@private.example/db?retryWrites=true"));
  assert.doesNotMatch(diagnostic, /private\.example|secret|mongodb\+srv/i);
  assert.match(diagnoseMongoError(new Error("Operation users.findOne() buffering timed out after 10000ms")), /temporarily unavailable/);
});

test("transient MongoDB errors are classified as unavailable without exposing error text", () => {
  assert.equal(isDatabaseUnavailableError(Object.assign(new Error("connection reset"), { code: "ECONNRESET" })), true);
  assert.equal(isDatabaseUnavailableError(Object.assign(new Error("server selection timed out"), { name: "MongoServerSelectionError" })), true);
  assert.equal(isDatabaseUnavailableError(new Error("Operation users.findOne() buffering timed out after 10000ms")), true);
  assert.equal(isDatabaseUnavailableError(new Error("A normal application validation error")), false);
});

test("startup connection retries are bounded and reject with a sanitized error", async () => {
  const originalUri = process.env.MONGODB_URI;
  const originalConnect = mongoose.connect;
  const originalDisconnect = mongoose.disconnect;
  let attempts = 0;
  process.env.MONGODB_URI = "mongodb://user:secret@localhost/devsync";
  mongoose.connect = async () => {
    attempts += 1;
    throw Object.assign(new Error("ECONNRESET mongodb://user:secret@localhost/devsync"), { code: "ECONNRESET" });
  };
  mongoose.disconnect = async () => mongoose;
  try {
    await assert.rejects(connectDB({ attempts: 2, retryDelays: [0] }), (error) => {
      assert.equal(error.code, "MONGODB_STARTUP_FAILED");
      assert.match(error.message, /network connection failed/);
      assert.doesNotMatch(error.message, /secret|localhost|devsync/i);
      return true;
    });
    assert.equal(attempts, 2);
  } finally {
    mongoose.connect = originalConnect;
    mongoose.disconnect = originalDisconnect;
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  }
});
