const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const User = require("../src/models/User");

process.env.JWT_SECRET = "devsync-auth-test-secret";
const originalFindOne = User.findOne;
User.findOne = () => ({ select: async () => null });
const missingUserFindOne = User.findOne;

const app = express();
app.use(express.json());
app.use("/api/auth", require("../src/routes/authRoutes"));
app.use(require("../src/middleware/requestErrorMiddleware"));
const server = http.createServer(app);

test("auth endpoints reject malformed input and rate-limit repeated login attempts", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    User.findOne = originalFindOne;
    return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const post = (path, rawBody, contentType = "application/json") => new Promise((resolve, reject) => {
    const body = Buffer.from(rawBody);
    const req = http.request({
      host: "127.0.0.1", port: server.address().port, path, method: "POST",
      headers: { "content-type": contentType, "content-length": body.length },
    }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end(body);
  });
  const postWithJSON = (path, data) => new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(data));
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path, method: "POST", headers: { "content-type": "application/json", "content-length": body.length } }, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.end(body);
  });

  assert.equal(await post("/api/auth/login", "{bad json"), 400);
  assert.equal(await post("/api/auth/login", "null"), 400);
  assert.equal(await post("/api/auth/login", JSON.stringify({ email: ["a@example.test"], password: { value: "password" } })), 400);
  const invalidCredentials = await postWithJSON("/api/auth/login", { email: "missing@example.test", password: "password123" });
  assert.equal(invalidCredentials.status, 401);
  assert.equal(invalidCredentials.body.code, "INVALID_CREDENTIALS");
  assert.match(invalidCredentials.body.message, /Email or password is incorrect/);

  User.findOne = async () => ({ _id: "existing-user" });
  const duplicateAccount = await postWithJSON("/api/auth/register", { name: "Existing User", email: "existing@example.test", password: "password123" });
  assert.equal(duplicateAccount.status, 409);
  assert.equal(duplicateAccount.body.code, "DUPLICATE_ACCOUNT");
  assert.equal(duplicateAccount.body.fields.email, "An account with this email already exists.");
  User.findOne = missingUserFindOne;

  const invalidRegistration = await postWithJSON("/api/auth/register", { name: 42, email: "a@example.test", password: "password123" });
  assert.equal(invalidRegistration.status, 400);
  assert.equal(invalidRegistration.body.code, "VALIDATION_ERROR");
  assert.equal(invalidRegistration.body.fields.name, "Enter your name.");
  assert.equal(await post("/api/auth/register", JSON.stringify({ name: "A", email: "not-an-email", password: "password123" })), 400);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal(await post("/api/auth/register", JSON.stringify({ name: 42, email: "a@example.test", password: "password123" })), 400);
  }
  const throttledRegistration = await postWithJSON("/api/auth/register", { name: 42, email: "a@example.test", password: "password123" });
  assert.equal(throttledRegistration.status, 429);
  assert.equal(throttledRegistration.body.code, "RATE_LIMITED");

  let remainingAllowed = 8; // Two invalid login requests already reached the login handler.
  while (remainingAllowed > 0) {
    assert.equal(await post("/api/auth/login", JSON.stringify({ email: "missing@example.test", password: "password123" })), 401);
    remainingAllowed -= 1;
  }
  const throttledLogin = await postWithJSON("/api/auth/login", { email: "missing@example.test", password: "password123" });
  assert.equal(throttledLogin.status, 429);
  assert.equal(throttledLogin.body.code, "RATE_LIMITED");
});
