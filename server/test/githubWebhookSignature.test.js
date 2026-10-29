const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { verifySignature, meetsTaskCompletionPolicy, normalizePayload } = require("../src/services/githubWebhookProcessor");

const secret = "test-webhook-secret";
const rawBody = Buffer.from('{"action":"opened","pull_request":{"number":123}}');
const signature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

test("GitHub webhook signature validates the exact raw body", () => {
  assert.equal(verifySignature(rawBody, signature, secret), true);
  assert.equal(verifySignature(Buffer.from(`${rawBody.toString()} `), signature, secret), false);
});

test("GitHub webhook signature rejects missing or malformed signatures", () => {
  assert.equal(verifySignature(rawBody, null, secret), false);
  assert.equal(verifySignature(rawBody, "sha1=abcd", secret), false);
  assert.equal(verifySignature(rawBody, signature, ""), false);
  assert.equal(verifySignature("not a buffer", signature, secret), false);
});

test("merged PR completion requires an in-review task and all acceptance criteria complete", () => {
  assert.equal(meetsTaskCompletionPolicy({ status: "in-review", acceptanceCriteria: [] }), true);
  assert.equal(meetsTaskCompletionPolicy({ status: "in-review", acceptanceCriteria: [{ completed: true }] }), true);
  assert.equal(meetsTaskCompletionPolicy({ status: "in-review", acceptanceCriteria: [{ completed: false }] }), false);
  assert.equal(meetsTaskCompletionPolicy({ status: "in-progress", acceptanceCriteria: [] }), false);
});

test("pull request review events distinguish approval from requested changes", () => {
  const base = { repository: { full_name: "owner/repo" }, action: "submitted", pull_request: { number: 123, title: "Fix", state: "open", merged: false, draft: false, updated_at: "2026-01-01T00:00:00Z" } };
  assert.equal(normalizePayload("pull_request_review", { ...base, review: { state: "changes_requested" } }).action, "review_changes_requested");
  assert.equal(normalizePayload("pull_request_review", { ...base, review: { state: "approved" } }).action, "review_approved");
  assert.equal(normalizePayload("pull_request_review", { ...base, review: { state: "commented" } }).action, "review_commented");
});
