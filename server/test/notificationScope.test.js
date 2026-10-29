const assert = require("node:assert/strict");
const test = require("node:test");
const { canReadNotification, notificationEntityFilter } = require("../src/utils/notificationScope");
const { buildNotificationFilters, getNextNotificationCursor, NOTIFICATION_LIST_FIELDS } = require("../src/utils/notificationQueries");

const access = { recipientId: "user-a", workspaceIds: ["workspace-a", "workspace-b"], projectIds: ["project-a", "project-b"], resourceIds: { task: ["task-a"], discussion: ["discussion-a"], decision: ["decision-a"], scopes: { task: [{ workspace: "workspace-b", project: "project-b", ids: ["task-a"] }], discussion: [{ workspace: "workspace-a", project: "project-a", ids: ["discussion-a"] }], decision: [{ workspace: "workspace-a", project: "project-b", ids: ["decision-a"] }] } } };

test("notification visibility requires recipient, current membership scope, and a live resource", () => {
  const notification = { recipient: "user-a", workspace: "workspace-b", project: "project-b", entityType: "task", entityId: "task-a" };
  assert.equal(canReadNotification(notification, access), true);
  assert.equal(canReadNotification({ ...notification, recipient: "user-b" }, access), false);
  assert.equal(canReadNotification({ ...notification, workspace: "revoked-workspace" }, access), false);
  assert.equal(canReadNotification({ ...notification, project: "deleted-project" }, access), false);
  assert.equal(canReadNotification({ ...notification, entityId: "deleted-task" }, access), false);
  assert.equal(canReadNotification({ ...notification, project: "project-a" }, access), false);
  assert.equal(canReadNotification({ ...notification, recipient: undefined }, access), false);
});

test("notification list projection includes identity fields used by the privacy check and UI", () => {
  const fields = new Set(NOTIFICATION_LIST_FIELDS.split(/\s+/));
  for (const field of ["recipient", "title", "message", "workspace", "project", "entityType", "entityId", "readAt", "createdAt"]) {
    assert.ok(fields.has(field), `notification projection should include ${field}`);
  }
});

test("notification list and unread queries share the live-resource type/id constraint", () => {
  const filter = notificationEntityFilter(access.resourceIds);
  assert.deepEqual(filter, { $or: [
    { entityType: "task", workspace: "workspace-b", project: "project-b", entityId: { $in: ["task-a"] } },
    { entityType: "discussion", workspace: "workspace-a", project: "project-a", entityId: { $in: ["discussion-a"] } },
    { entityType: "decision", workspace: "workspace-a", project: "project-b", entityId: { $in: ["decision-a"] } },
  ] });
});

test("older-page cursor never narrows the global unread count", () => {
  const cursor = { _id: "notification-cursor", createdAt: new Date("2026-01-01T00:00:00Z") };
  const filters = buildNotificationFilters({ recipientId: "user-a", workspaceIds: ["workspace-a"], projectIds: ["project-a"], resourceIds: access.resourceIds, beforeCursor: cursor });
  assert.equal(filters.list.$and[1].$or.length, 2);
  assert.equal(Object.hasOwn(filters.unread, "$and"), false);
  assert.deepEqual(filters.list.$and[0].$or, filters.unread.$or);
  assert.equal(filters.unread.readAt, null);
  assert.equal(filters.cursor.recipient, "user-a");
});

test("notification pagination returns a cursor only for a full page", () => {
  assert.equal(getNextNotificationCursor([{ _id: "n1" }, { _id: "n2" }], 2), "n2");
  assert.equal(getNextNotificationCursor([{ _id: "n1" }], 2), null);
  assert.equal(getNextNotificationCursor([], 2), null);
});
