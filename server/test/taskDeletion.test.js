const assert = require("node:assert/strict");
const test = require("node:test");
const { createResourceDeletionService } = require("../src/services/resourceDeletion");

function model(rows = [], fail = false) {
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => key === "$or"
    ? value.some((condition) => matches(row, condition))
    : String(row[key]) === String(value));
  return {
    rows,
    async findOne(filter) { return this.rows.find((row) => matches(row, filter)) || null; },
    async updateMany(filter, update) {
      if (fail) throw new Error("cleanup failed");
      for (const row of this.rows) if (matches(row, filter)) Object.assign(row, update.$set);
    },
    async deleteMany(filter) { this.rows = this.rows.filter((row) => !Object.entries(filter).every(([key, value]) => String(row[key]) === String(value))); },
    async deleteOne(filter) {
      const before = this.rows.length;
      this.rows = this.rows.filter((row) => !matches(row, filter));
      return { deletedCount: before - this.rows.length };
    },
  };
}

function fixture({ failDecisionCleanup = false } = {}) {
  const models = {
    Task: model([{ _id: "task", workspace: "ws", project: "project", title: "Keep audit" }, { _id: "other", workspace: "other-ws", project: "other-project" }]),
    Discussion: model([{ _id: "discussion", workspace: "ws", project: "project", linkedTask: "task" }, { _id: "other-discussion", workspace: "other-ws", project: "other-project", linkedTask: "task" }]),
    Decision: model([{ _id: "decision", workspace: "ws", projectRef: "project", linkedTask: "task", taskId: "task" }, { _id: "other-decision", workspace: "other-ws", projectRef: "other-project", linkedTask: "task" }], failDecisionCleanup),
    Notification: model([{ _id: "notification", workspace: "ws", project: "project", entityType: "task", entityId: "task" }]),
    Workspace: model(), Project: model(), Activity: model([{ _id: "activity", workspace: "ws", project: "project", entityId: "task" }]),
    Upload: model(), UploadQuota: model(), WorkspaceInvitation: model(), GitHubWebhookDelivery: model(),
  };
  return { models, service: createResourceDeletionService({ models, storageDirectory: "C:/managed" }) };
}

test("task cleanup unlinks only same-project dependents, removes notifications, and keeps audit activity", async () => {
  const { models, service } = fixture();
  await service.deleteTask("ws", "project", "task");
  assert.equal(models.Task.rows.some((item) => item._id === "task"), false);
  assert.equal(models.Discussion.rows[0].linkedTask, null);
  assert.equal(models.Decision.rows[0].linkedTask, null);
  assert.equal(models.Decision.rows[0].taskId, "");
  assert.equal(models.Notification.rows.length, 0);
  assert.equal(models.Activity.rows.length, 1);
  assert.equal(models.Discussion.rows[1].linkedTask, "task");
  assert.equal(models.Decision.rows[1].linkedTask, "task");
});

test("task remains when dependent cleanup fails, and retry completes safely", async () => {
  const state = fixture({ failDecisionCleanup: true });
  await assert.rejects(state.service.deleteTask("ws", "project", "task"), /cleanup failed/);
  assert.equal(state.models.Task.rows.some((item) => item._id === "task"), true);
  state.models.Decision.updateMany = async (_filter, update) => Object.assign(state.models.Decision.rows[0], update.$set);
  await state.service.deleteTask("ws", "project", "task");
  assert.equal(state.models.Task.rows.some((item) => item._id === "task"), false);
});
