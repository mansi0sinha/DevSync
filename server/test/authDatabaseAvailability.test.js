const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const test = require("node:test");
const User = require("../src/models/User");
const authMiddleware = require("../src/middleware/authMiddleware");

const router = require("../src/routes/authRoutes");
const registerHandler = router.stack.find((layer) => layer.route?.path === "/register").route.stack.at(-1).handle;
const loginHandler = router.stack.find((layer) => layer.route?.path === "/login").route.stack.at(-1).handle;

test("registration and login succeed with the default username and stored password hash", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-registration-secret";
  let registeredUser;
  User.findOne = async () => null;
  User.create = async (input) => {
    const user = new User(input);
    await user.validate();
    registeredUser = user;
    return user;
  };
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await registerHandler({
      body: { name: "New User", email: "new@example.test", password: "test-password-123" },
    }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.success, true);
    assert.ok(response.body.token);
    assert.equal(response.body.user.email, "new@example.test");

    User.findOne = () => ({ select: async () => registeredUser });
    response.statusCode = 200;
    response.body = null;
    await loginHandler({
      body: { email: "new@example.test", password: "test-password-123" },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.token);
    assert.equal(response.body.user.email, "new@example.test");
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});

test("registration returns a safe retryable response when MongoDB lookup loses connection", async () => {
  const originalFindOne = User.findOne;
  const originalConsoleError = console.error;
  const logged = [];
  User.findOne = async () => {
    throw Object.assign(
      new Error("Server selection timed out mongodb+srv://user:do-not-log@cluster.example/devsync"),
      { name: "MongoServerSelectionError" },
    );
  };
  console.error = (...args) => logged.push(args.join(" "));

  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await registerHandler({
      body: { name: "Test User", email: "test@example.test", password: "test-password-123" },
    }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "DATABASE_UNAVAILABLE");
    assert.match(response.body.message, /try again shortly/i);
    assert.doesNotMatch(JSON.stringify(response.body), /do-not-log|cluster\.example|mongodb\+srv/i);
    assert.doesNotMatch(logged.join(" "), /do-not-log|cluster\.example|mongodb\+srv/i);
    assert.match(logged.join(" "), /MongoDB cluster is unavailable/);
  } finally {
    User.findOne = originalFindOne;
    console.error = originalConsoleError;
  }
});

test("session verification reports database outage as retryable, not invalid credentials", async () => {
  const originalFindById = User.findById;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalConsoleError = console.error;
  process.env.JWT_SECRET = "test-only-auth-database-secret";
  console.error = () => {};
  const userId = new mongoose.Types.ObjectId();
  const token = jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: "1m" });
  User.findById = () => ({
    select: async () => { throw Object.assign(new Error("connection reset"), { code: "ECONNRESET" }); },
  });
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await authMiddleware({ headers: { authorization: `Bearer ${token}` } }, response, () => {});
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "DATABASE_UNAVAILABLE");
    assert.doesNotMatch(response.body.message, /expired|invalid token/i);
  } finally {
    User.findById = originalFindById;
    console.error = originalConsoleError;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
