const assert = require("node:assert/strict");
const test = require("node:test");
const { createResourceDeletionService } = require("../src/services/resourceDeletion");

function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = document[key];
    if (expected && typeof expected === "object" && Array.isArray(expected.$in)) return expected.$in.map(String).includes(String(actual));
    if (expected && typeof expected === "object" && Array.isArray(expected.$nin)) return !expected.$nin.map(String).includes(String(actual));
    return String(actual) === String(expected);
  });
}

function fakeModel(documents = []) {
  return {
    documents,
    find(filter) {
      const result = this.documents.filter((document) => matches(document, filter));
      return { select() { return this; }, lean: async () => result };
    },
    async deleteMany(filter) { this.documents = this.documents.filter((document) => !matches(document, filter)); return { acknowledged: true }; },
    async deleteOne(filter) { this.documents = this.documents.filter((document) => !matches(document, filter)); return { acknowledged: true }; },
    async updateOne(filter, update) { const found = this.documents.find((document) => matches(document, filter)); if (found) Object.assign(found, update.$set); return { acknowledged: true }; },
  };
}

function fixture(fileSystem = { unlink: async () => {} }) {
  const models = {
    Workspace: fakeModel([{ _id: "ws" }]),
    Project: fakeModel([{ _id: "proj", workspace: "ws" }]),
    Task: fakeModel([{ _id: "task", workspace: "ws", project: "proj" }]),
    Discussion: fakeModel([{ _id: "discussion", workspace: "ws", project: "proj" }]),
    Decision: fakeModel([{ _id: "decision", workspace: "ws", projectRef: "proj" }]),
    Activity: fakeModel([{ _id: "activity", workspace: "ws", project: "proj" }]),
    Notification: fakeModel([{ _id: "notification", workspace: "ws", project: "proj" }]),
    Upload: fakeModel([{ _id: "upload", workspace: "ws", project: "proj", uploadedBy: "user", size: 12, filename: "123e4567-e89b-12d3-a456-426614174000.pdf" }]),
    UploadQuota: fakeModel([{ _id: "quota", workspace: "ws", user: "user", usedBytes: 12, reservedBytes: 0 }]),
    WorkspaceInvitation: fakeModel([{ _id: "invite", workspace: "ws" }]),
    GitHubWebhookDelivery: fakeModel([{ _id: "delivery", workspace: "ws", project: "proj" }]),
  };
  return { models, service: createResourceDeletionService({ models, storageDirectory: "C:/managed-uploads", fileSystem }) };
}

test("project cleanup removes scoped records and managed files, and can safely repeat", async () => {
  const unlinked = [];
  const { models, service } = fixture({ unlink: async (file) => unlinked.push(file) });
  await service.deleteProject("ws", { _id: "proj" });
  await service.deleteProject("ws", { _id: "proj" });
  for (const name of ["Project", "Task", "Discussion", "Decision", "Activity", "Notification", "Upload", "GitHubWebhookDelivery"]) assert.equal(models[name].documents.length, 0, `${name} cleanup`);
  assert.equal(models.UploadQuota.documents[0].usedBytes, 0);
  assert.equal(unlinked.length, 1);
});

test("file cleanup failure retains the project and upload metadata for retry", async () => {
  const { models, service } = fixture({ unlink: async () => { const error = new Error("storage unavailable"); error.code = "EIO"; throw error; } });
  await assert.rejects(service.deleteProject("ws", { _id: "proj" }));
  assert.equal(models.Project.documents.length, 1);
  assert.equal(models.Upload.documents.length, 1);
});

test("workspace cleanup cascades through projects and workspace-scoped records", async () => {
  const { models, service } = fixture();
  await service.deleteWorkspace({ _id: "ws" });
  for (const name of Object.keys(models)) assert.equal(models[name].documents.length, 0, `${name} cleanup`);
});
