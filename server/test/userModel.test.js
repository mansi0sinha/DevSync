const assert = require("node:assert/strict");
const test = require("node:test");
const User = require("../src/models/User");

test("new registrations pass user model validation with the blank username default", async () => {
  const user = new User({
    name: "Example User",
    email: "example@example.test",
    password: "test-only-password-hash",
  });

  await user.validate();
  assert.equal(user.username, "");
});

test("non-empty usernames retain the profile format and length validation", async () => {
  const base = { name: "Example User", email: "example@example.test", password: "test-only-password-hash" };
  for (const username of ["ab", "has space", "x".repeat(26)]) {
    const user = new User({ ...base, username });
    await assert.rejects(user.validate(), (error) => {
      assert.equal(error.name, "ValidationError");
      assert.ok(error.errors.username);
      return true;
    });
  }
});
