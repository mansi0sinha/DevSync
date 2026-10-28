const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const User = require("../src/models/User");

process.env.JWT_SECRET = "devsync-auth-test-secret";
const originalFindOne = User.findOne;
User.findOne = () => ({ select: async () => null });

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

  assert.equal(await post("/api/auth/login", "{bad json"), 400);
  assert.equal(await post("/api/auth/login", "null"), 400);
  assert.equal(await post("/api/auth/login", JSON.stringify({ email: ["a@example.test"], password: { value: "password" } })), 400);
  assert.equal(await post("/api/auth/register", JSON.stringify({ name: 42, email: "a@example.test", password: "password123" })), 400);
  assert.equal(await post("/api/auth/register", JSON.stringify({ name: "A", email: "not-an-email", password: "password123" })), 400);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal(await post("/api/auth/register", JSON.stringify({ name: 42, email: "a@example.test", password: "password123" })), 400);
  }
  assert.equal(await post("/api/auth/register", JSON.stringify({ name: 42, email: "a@example.test", password: "password123" })), 429);

  let remainingAllowed = 9; // One invalid login object reached the login handler and counts as an attempt.
  while (remainingAllowed > 0) {
    assert.equal(await post("/api/auth/login", JSON.stringify({ email: "missing@example.test", password: "password123" })), 401);
    remainingAllowed -= 1;
  }
  assert.equal(await post("/api/auth/login", JSON.stringify({ email: "missing@example.test", password: "password123" })), 429);
});
